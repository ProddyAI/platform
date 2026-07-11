"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import {
	Calendar,
	CalendarDays,
	Check,
	CheckCircle2,
	ChevronDown,
	Clock,
	Clock3,
	Download,
	FileDown,
	FileText,
	ListChecks,
	Loader2,
	Maximize2,
	MessageSquare,
	Minimize2,
	PlusCircle,
	RotateCw,
	Save,
	Send,
	Sparkles,
	X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useAiNotemakerStore } from "@/features/ai-notemaker/store/use-ai-notemaker-store";
import { useGetMessages } from "@/features/messages/api/use-get-messages";
import { useChannelId } from "@/hooks/use-channel-id";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import { exportToPDF, exportToWord } from "@/lib/client/export-utils";
import { cn } from "@/lib/utils";

type AiActionItem = {
	title?: string;
	assigneeName?: string | null;
	assigneeUserId?: string | null;
	priority?: string;
	selected?: boolean;
	pushed?: boolean;
};

type AiNotesData = {
	title?: string;
	summary?: string;
	actionItems?: AiActionItem[];
	decisions?: string[];
};

const PERIOD_LABELS: Record<string, string> = {
	"1h": "the last hour",
	"24h": "the last 24 hours",
	"7d": "the last 7 days",
	"30d": "the last 30 days",
	all: "all messages",
	since_last: "the period since the last generation",
};

export const AiNotemaker = ({
	variant: _variant = "toolbar",
	channelId: propChannelId,
	workspaceId: propWorkspaceId,
}: {
	variant?: "toolbar" | "default";
	channelId?: string;
	workspaceId?: string;
}) => {
	const router = useRouter();
	const hookChannelId = useChannelId();
	const hookWorkspaceId = useWorkspaceId();
	const channelId = (propChannelId || hookChannelId) as
		| Id<"channels">
		| undefined;
	const workspaceId = (propWorkspaceId || hookWorkspaceId) as
		| Id<"workspaces">
		| undefined;
	const { results: messages, status: messagesStatus } = useGetMessages({
		channelId,
	});

	const members = useQuery(api.workspace.members.get, { workspaceId }) || [];
	const chatNoteInfo = useQuery(
		api.content.meetingNotes.getChatNoteForChannel,
		channelId && workspaceId
			? { channelId: String(channelId), workspaceId }
			: "skip"
	);
	const createNote = useMutation(api.content.notes.create);
	const createBulkTasks = useMutation(api.planning.tasks.createBulkFromAI);
	const generateChatNotesAction = useAction(
		api.content.meetingNotes.generateChatNotes
	);
	const chatWithNotesAction = useAction(api.content.meetingNotes.chatWithNotes);
	const saveChatToMeetingNotes = useMutation(
		api.content.meetingNotes.saveChatNotesToHistory
	);

	const {
		isOpen,
		setIsOpen,
		triggerGeneration,
		isExpanded: isFocusMode,
		setIsExpanded: setIsFocusMode,
	} = useAiNotemakerStore();
	const [isLoading, setIsLoading] = useState(false);
	const [isSaving, setIsSaving] = useState(false);
	const [isCreatingTasks, setIsCreatingTasks] = useState(false);
	const [lastProcessedTrigger, setLastProcessedTrigger] = useState(0);
	const [notesData, setNotesData] = useState<AiNotesData | null>(null);
	const [editableTasks, setEditableTasks] = useState<AiActionItem[]>([]);
	const [transcriptString, setTranscriptString] = useState("");
	const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
	const [showPeriodPicker, setShowPeriodPicker] = useState(false);
	const [selectedPeriod, setSelectedPeriod] = useState<string>("24h");

	// Chat feature state
	const [chatInput, setChatInput] = useState("");
	const [chatHistory, setChatHistory] = useState<
		{ role: string; content: string }[]
	>([]);
	const [isChatting, setIsChatting] = useState(false);
	const chatEndRef = useRef<HTMLDivElement>(null);

	// Focus mode logic (simplified for flex layout)
	useEffect(() => {
		if (isOpen && isFocusMode) {
			// Optional: you can add logic here to hide the main chat if needed for focus mode
		}
	}, [isOpen, isFocusMode]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: re-run on new messages/typing state, not read directly
	useEffect(() => {
		if (chatEndRef.current) {
			chatEndRef.current.scrollIntoView({ behavior: "smooth" });
		}
	}, [chatHistory, isChatting]);

	useEffect(() => {
		if (
			triggerGeneration > lastProcessedTrigger &&
			messagesStatus !== "LoadingFirstPage"
		) {
			setLastProcessedTrigger(triggerGeneration);
			// Show period picker instead of immediately generating
			setShowPeriodPicker(true);
			setIsOpen(true);
		}
	}, [triggerGeneration, messagesStatus, lastProcessedTrigger, setIsOpen]);

	const getFilteredMessages = (period: string) => {
		if (!messages) return [];
		const now = Date.now();
		let cutoff = 0;
		if (period === "since_last" && chatNoteInfo?.lastGeneratedAt) {
			cutoff = chatNoteInfo.lastGeneratedAt;
		} else {
			const cutoffs: Record<string, number> = {
				"1h": now - 3600000,
				"24h": now - 86400000,
				"7d": now - 604800000,
				"30d": now - 2592000000,
				all: 0,
				since_last: 0, // fallback if no prior generation
			};
			cutoff = cutoffs[period] || 0;
		}
		return messages.filter((m) => m._creationTime >= cutoff).reverse();
	};

	const generateAiNotes = async (period?: string) => {
		const usePeriod = period || selectedPeriod;
		const filtered = getFilteredMessages(usePeriod);
		if (!filtered || filtered.length === 0) {
			toast.error(
				`No messages found for ${PERIOD_LABELS[usePeriod] || "the selected period"}.`
			);
			return;
		}

		setIsLoading(true);
		setIsOpen(true);
		setIsFocusMode(false);
		setChatHistory([]);
		setShowPeriodPicker(false);

		try {
			const cleanBody = (body: string) => {
				try {
					const parsed = JSON.parse(body);
					if (parsed.ops)
						return parsed.ops
							.map((op: { insert?: string }) =>
								typeof op.insert === "string" ? op.insert : ""
							)
							.join("");
					if (parsed.type) return `[${parsed.type.toUpperCase()} CONTENT]`;
					return body;
				} catch {
					return body.replace(/<[^>]*>/g, "");
				}
			};

			const transcript = filtered
				.map((m) => `${m.user?.name || "Unknown"}: ${cleanBody(m.body)}`)
				.join("\n");

			setTranscriptString(transcript);

			const membersContext = members
				.map(
					(m) =>
						`- ${m.user?.name || "Unknown"} (ID: ${m.user?._id || "Unknown"})`
				)
				.join("\n");

			const notes = await generateChatNotesAction({
				transcript,
				membersContext,
			});

			setNotesData(notes);
			setGeneratedAt(new Date());
			if (notes?.actionItems) {
				setEditableTasks(
					notes.actionItems.map((item) => ({ ...item, selected: true }))
				);
			}

			try {
				await saveChatToMeetingNotes({
					workspaceId: workspaceId as Id<"workspaces">,
					channelId,
					title: notes.title || undefined,
					transcript,
					summary: notes.summary || "",
					actionItems: (notes.actionItems || []).map((a) => {
						let label = a.title;
						if (a.assigneeName) label += ` → ${a.assigneeName}`;
						if (a.priority) label += ` [${a.priority}]`;
						return label;
					}),
					decisions: notes.decisions || [],
				});
				toast.success("Notes saved to Meeting Notes.");
			} catch (e) {
				console.error("Failed to save to meeting notes history:", e);
				toast.error("Notes generated but not saved to history.");
			}
		} catch (error) {
			console.error("Error:", error);
			toast.error(
				error instanceof Error ? error.message : "Failed to generate AI notes."
			);
		} finally {
			setIsLoading(false);
		}
	};

	const handleExport = (format: "pdf" | "word") => {
		if (!notesData) return;

		const data = {
			title: notesData.title || "Meeting Notes",
			summary: notesData.summary,
			actionItems: (notesData.actionItems || []).map(
				(a) =>
					`${a.title}${a.assigneeName ? ` (Assigned to: ${a.assigneeName})` : ""}`
			),
			decisions: notesData.decisions || [],
			date: generatedAt?.toLocaleString() || new Date().toLocaleString(),
		};

		if (format === "pdf") {
			exportToPDF(data);
		} else {
			exportToWord(data);
		}
	};

	const handleSaveToConvex = async () => {
		if (!notesData) return;
		setIsSaving(true);
		try {
			const textRep = `Summary:\n${notesData.summary}\n\nAction Items:\n${(notesData.actionItems || []).map((a) => `- ${a.title}`).join("\n")}\n\nDecisions:\n${(notesData.decisions || []).map((d: string) => `- ${d}`).join("\n")}`;
			const delta = JSON.stringify({ ops: [{ insert: textRep }] });

			await createNote({
				title: `AI Meeting Notes - ${new Date().toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}`,
				content: delta,
				workspaceId: workspaceId as Id<"workspaces">,
				channelId: channelId as Id<"channels">,
				icon: "✨",
				tags: ["AI", "Meeting"],
			});
			toast.success("Notes saved to channel library.");
		} catch (_error) {
			toast.error("Failed to save note.");
		} finally {
			setIsSaving(false);
		}
	};

	const handleCreateTasks = async () => {
		const selectedTasks = editableTasks.filter((t) => t.selected && !t.pushed);
		if (selectedTasks.length === 0) {
			toast.error("No tasks selected to push.");
			return;
		}
		setIsCreatingTasks(true);
		try {
			await createBulkTasks({
				workspaceId: workspaceId as Id<"workspaces">,
				tasks: selectedTasks.map((item) => ({
					title: item.title,
					assigneeUserId: (item.assigneeUserId || undefined) as
						| Id<"users">
						| undefined,
					priority: (item.priority || "medium") as "low" | "medium" | "high",
				})),
			});
			setEditableTasks((prev) =>
				prev.map((t) =>
					t.selected && !t.pushed ? { ...t, pushed: true, selected: false } : t
				)
			);
			toast.success(
				`${selectedTasks.length} ${selectedTasks.length === 1 ? "task" : "tasks"} added to Tasks Dashboard.`,
				{
					action: {
						label: "View in Tasks",
						onClick: () => router.push(`/workspace/${workspaceId}/tasks`),
					},
				}
			);
		} catch (_error) {
			toast.error("Failed to assign tasks.");
		} finally {
			setIsCreatingTasks(false);
		}
	};

	const handleChatSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!chatInput.trim() || !notesData) return;

		const message = chatInput.trim();
		setChatInput("");
		setChatHistory((prev) => [...prev, { role: "user", content: message }]);
		setIsChatting(true);

		try {
			const response = await chatWithNotesAction({
				transcript: transcriptString,
				notes: JSON.stringify(notesData),
				history: chatHistory,
				message,
			});

			setChatHistory((prev) => [
				...prev,
				{ role: "assistant", content: response },
			]);
		} catch (_error) {
			toast.error("AI failed to respond.");
		} finally {
			setIsChatting(false);
		}
	};

	if (!isOpen) return null;

	return (
		<>
			{isOpen && !isFocusMode && (
				<button
					aria-label="Close AI assistant"
					className="fixed inset-0 bg-black/50 z-[90] md:hidden"
					onClick={() => setIsOpen(false)}
					type="button"
				/>
			)}
			<div
				className={cn(
					"relative z-[100] bg-card shadow-xl transition-all duration-300 ease-in-out border-border flex flex-col pointer-events-auto h-full w-full overflow-hidden shrink-0"
				)}
			>
				<div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card flex-shrink-0 z-20 sticky top-0 shadow-sm">
					<div className="flex items-center gap-3">
						<div className="p-2 bg-secondary/10 border border-secondary/20 rounded-xl shadow-sm">
							<Sparkles className="size-5 text-secondary" />
						</div>
						<div>
							<h2 className="font-bold text-foreground text-lg tracking-tight">
								AI Meeting Assistant
							</h2>
							<p className="text-xs text-muted-foreground font-medium">
								Notes, action items, and decisions
							</p>
						</div>
					</div>
					<div className="flex items-center gap-2">
						{isFocusMode ? (
							<Button
								className="h-9 w-9 rounded-full hover:bg-muted text-muted-foreground transition-all hover:scale-105 active:scale-95"
								onClick={() => setIsFocusMode(false)}
								size="icon"
								title="Exit Focus Mode"
								variant="ghost"
							>
								<Minimize2 className="size-4" />
							</Button>
						) : (
							<Button
								className="h-9 w-9 rounded-full hover:bg-muted text-muted-foreground transition-all hover:scale-105 active:scale-95"
								onClick={() => setIsFocusMode(true)}
								size="icon"
								title="Enter Focus Mode"
								variant="ghost"
							>
								<Maximize2 className="size-4" />
							</Button>
						)}
						<div className="w-px h-5 bg-border mx-1" />
						<Button
							className="h-9 w-9 rounded-full hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-all hover:scale-105 active:scale-95"
							onClick={() => setIsOpen(false)}
							size="icon"
							title="Close AI Assistant"
							variant="ghost"
						>
							<X className="size-4" />
						</Button>
					</div>
				</div>

				<div
					className={cn(
						"flex-1 overflow-y-auto bg-muted/30 p-6 flex flex-col relative scroll-smooth",
						isFocusMode && "px-8 md:px-12 lg:px-16 py-10"
					)}
				>
					<div
						className={cn(
							"flex flex-col flex-1",
							isFocusMode && "max-w-5xl mx-auto w-full"
						)}
					>
						{showPeriodPicker ? (
							<div className="flex flex-col items-center justify-center h-full space-y-6 pt-8">
								<div className="p-3 bg-secondary/10 border border-secondary/20 rounded-xl shadow-sm">
									<Sparkles className="size-8 text-secondary" />
								</div>
								<div className="text-center space-y-1">
									<h3 className="text-lg font-bold text-foreground">
										Generate AI Notes
									</h3>
									<p className="text-sm text-muted-foreground">
										Select the time period to analyze
									</p>
								</div>
								<div className="w-full max-w-xs space-y-2">
									{[
										{ key: "1h", label: "Last 1 hour", Icon: Clock },
										{ key: "24h", label: "Last 24 hours", Icon: Clock3 },
										{ key: "7d", label: "Last 7 days", Icon: Calendar },
										{ key: "30d", label: "Last 30 days", Icon: CalendarDays },
										{ key: "all", label: "All messages", Icon: ListChecks },
									].map((opt) => {
										const count = getFilteredMessages(opt.key).length;
										const isSelected = selectedPeriod === opt.key;
										return (
											<button
												className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 ${
													isSelected
														? "border-secondary/40 bg-secondary/10 text-secondary"
														: "border-border bg-card hover:border-secondary/30 text-foreground"
												}`}
												disabled={count === 0}
												key={opt.key}
												onClick={() => {
													setSelectedPeriod(opt.key);
													generateAiNotes(opt.key);
												}}
												type="button"
											>
												<div className="flex items-center gap-3">
													<opt.Icon className="size-4" />
													<span className="text-sm font-medium">
														{opt.label}
													</span>
												</div>
												<span
													className={`text-xs font-semibold px-2 py-0.5 rounded-full ${count > 0 ? "bg-secondary/15 text-secondary" : "bg-muted text-muted-foreground"}`}
												>
													{count} msgs
												</span>
											</button>
										);
									})}
									{/* Since last generation — special option */}
									{chatNoteInfo?.lastGeneratedAt &&
										(() => {
											const count = getFilteredMessages("since_last").length;
											const ago = Math.round(
												(Date.now() - chatNoteInfo.lastGeneratedAt) / 60000
											);
											const agoText =
												ago < 60
													? `${ago}m ago`
													: ago < 1440
														? `${Math.round(ago / 60)}h ago`
														: `${Math.round(ago / 1440)}d ago`;
											return (
												<button
													className="w-full flex items-center justify-between px-4 py-3 rounded-2xl border transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 border-secondary/30 bg-secondary/5 text-secondary hover:border-secondary/40"
													disabled={count === 0}
													onClick={() => {
														setSelectedPeriod("since_last");
														generateAiNotes("since_last");
													}}
													type="button"
												>
													<div className="flex flex-col items-start gap-0.5">
														<div className="flex items-center gap-3">
															<RotateCw className="size-4" />
															<span className="text-sm font-medium">
																Since last generation
															</span>
														</div>
														<span className="text-xs opacity-70 ml-7">
															Generated {agoText}
														</span>
													</div>
													<span
														className={`text-xs font-semibold px-2 py-0.5 rounded-full ${count > 0 ? "bg-secondary/15 text-secondary" : "bg-muted text-muted-foreground"}`}
													>
														{count} new
													</span>
												</button>
											);
										})()}
								</div>
								{chatNoteInfo?.lastGeneratedAt && (
									<p className="text-xs text-muted-foreground text-center">
										Last generated:{" "}
										{new Date(chatNoteInfo.lastGeneratedAt).toLocaleString([], {
											month: "short",
											day: "numeric",
											hour: "2-digit",
											minute: "2-digit",
										})}
									</p>
								)}
								<button
									className="text-xs text-muted-foreground hover:text-foreground mt-1"
									onClick={() => setShowPeriodPicker(false)}
									type="button"
								>
									Cancel
								</button>
							</div>
						) : isLoading ? (
							<div className="flex flex-col items-center justify-center h-full space-y-6 pt-16">
								<div className="relative inline-flex">
									<Loader2 className="size-12 animate-spin motion-reduce:animate-none text-secondary relative z-10" />
									<Sparkles className="size-5 text-secondary/70 absolute -top-1 -right-3 animate-pulse motion-reduce:animate-none z-20" />
								</div>
								<div className="space-y-2 text-center">
									<p className="text-base text-foreground font-semibold tracking-tight">
										Generating notes…
									</p>
									<p className="text-sm text-muted-foreground animate-pulse motion-reduce:animate-none">
										Analyzing the transcript
									</p>
								</div>
							</div>
						) : notesData ? (
							<div className="space-y-10 flex-1 pb-12">
								{/* Summary Section */}
								<div className="space-y-4">
									<h3 className="text-xl font-bold text-foreground flex items-center gap-2.5">
										<FileText className="size-5 text-secondary" />
										Summary
									</h3>
									{generatedAt && (
										<p className="text-xs text-muted-foreground ml-7">
											Generated at{" "}
											{generatedAt.toLocaleTimeString([], {
												hour: "2-digit",
												minute: "2-digit",
											})}{" "}
											on {generatedAt.toLocaleDateString()}
										</p>
									)}
									<div className="bg-muted/40 border border-border rounded-2xl p-5 ml-7">
										<p className="text-foreground text-sm leading-relaxed font-medium">
											{notesData.summary}
										</p>
									</div>
								</div>

								{/* Grid for Actions and Decisions */}
								<div
									className={cn(
										"flex flex-col gap-8",
										isFocusMode && "grid grid-cols-12 items-start"
									)}
								>
									{/* Action Items */}
									{editableTasks && editableTasks.length > 0 && (
										<div
											className={cn(
												"space-y-4",
												isFocusMode && "col-span-12 lg:col-span-7"
											)}
										>
											<h3 className="text-xl font-bold text-foreground flex items-center gap-2.5">
												<CheckCircle2 className="size-5 text-secondary" />
												Action Items
											</h3>
											<div className="space-y-3">
												{editableTasks.map((item, i: number) => {
													const assignedMember = members.find(
														(m) => m.user._id === item.assigneeUserId
													);
													const isSelected = Boolean(item.selected);
													const isPushed = Boolean(item.pushed);
													const toggleSelected = () => {
														if (isPushed) return;
														const newTasks = [...editableTasks];
														newTasks[i] = {
															...newTasks[i],
															selected: !isSelected,
														};
														setEditableTasks(newTasks);
													};
													return (
														<div
															className={cn(
																"flex gap-3 p-4 bg-card border rounded-2xl transition-all duration-300 select-none",
																isPushed
																	? "border-border opacity-50"
																	: isSelected
																		? "border-secondary/30 shadow-sm hover:shadow-md hover:border-secondary/50"
																		: "border-border opacity-60 hover:opacity-100 hover:border-muted-foreground/30"
															)}
															key={i}
														>
															<div className="mt-0.5 flex-shrink-0">
																<Checkbox
																	aria-label={
																		isSelected
																			? `Deselect task: ${item.title}`
																			: `Select task: ${item.title}`
																	}
																	checked={isSelected}
																	disabled={isPushed}
																	onCheckedChange={toggleSelected}
																/>
															</div>
															<div className="flex-1 space-y-2">
																<div
																	className={cn(
																		"font-semibold leading-snug transition-colors flex items-center gap-2",
																		isSelected
																			? "text-foreground"
																			: "text-muted-foreground"
																	)}
																>
																	{item.title}
																	{isPushed && (
																		<span className="inline-flex items-center gap-1 text-xs font-medium text-secondary">
																			<Check className="size-3" />
																			Pushed
																		</span>
																	)}
																</div>
																<div className="flex flex-wrap items-center gap-2 text-xs">
																	{/* Assignee Dropdown */}
																	<DropdownMenu>
																		<DropdownMenuTrigger
																			asChild
																			disabled={isPushed}
																		>
																			<button
																				className="flex items-center gap-1.5 py-1 pl-1.5 pr-2.5 rounded-full border cursor-pointer transition-colors bg-muted border-border hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
																				type="button"
																			>
																				<div className="size-5 rounded-full bg-secondary/15 flex items-center justify-center text-xs font-bold text-secondary shadow-sm flex-shrink-0">
																					{(assignedMember
																						? assignedMember.user.name
																						: item.assigneeName ||
																							"U")[0].toUpperCase()}
																				</div>
																				<span className="text-xs font-semibold text-foreground">
																					{assignedMember
																						? assignedMember.user.name
																						: item.assigneeName
																							? `${item.assigneeName} (Unmapped)`
																							: "Unassigned"}
																				</span>
																				<ChevronDown className="size-3.5 text-muted-foreground ml-0.5" />
																			</button>
																		</DropdownMenuTrigger>
																		<DropdownMenuContent
																			align="start"
																			className="w-48"
																		>
																			<DropdownMenuItem
																				onClick={() => {
																					const newTasks = [...editableTasks];
																					newTasks[i] = {
																						...newTasks[i],
																						assigneeUserId: undefined,
																					};
																					setEditableTasks(newTasks);
																				}}
																			>
																				{item.assigneeName
																					? `${item.assigneeName} (Unmapped)`
																					: "Unassigned"}
																			</DropdownMenuItem>
																			{members.map((m) => (
																				<DropdownMenuItem
																					className="gap-2"
																					key={m.user._id}
																					onClick={() => {
																						const newTasks = [...editableTasks];
																						newTasks[i] = {
																							...newTasks[i],
																							assigneeUserId: m.user._id,
																						};
																						setEditableTasks(newTasks);
																					}}
																				>
																					<div className="size-4 rounded-full bg-secondary/15 flex items-center justify-center text-xs font-bold text-secondary">
																						{(m.user.name ||
																							"U")[0].toUpperCase()}
																					</div>
																					{m.user.name || "Unknown"}
																				</DropdownMenuItem>
																			))}
																		</DropdownMenuContent>
																	</DropdownMenu>

																	{/* Priority Dropdown */}
																	<DropdownMenu>
																		<DropdownMenuTrigger
																			asChild
																			disabled={isPushed}
																		>
																			<button
																				className={cn(
																					"flex items-center gap-1.5 py-1 pl-2.5 pr-2 rounded-full font-bold tracking-wide border cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed",
																					item.priority === "high"
																						? "bg-destructive/10 border-destructive/20 text-destructive hover:bg-destructive/15"
																						: item.priority === "medium"
																							? "bg-warning/10 border-warning/20 text-warning hover:bg-warning/15"
																							: "bg-success/10 border-success/20 text-success hover:bg-success/15"
																				)}
																				type="button"
																			>
																				{(
																					item.priority || "medium"
																				).toUpperCase()}
																				<ChevronDown className="size-3.5 opacity-60" />
																			</button>
																		</DropdownMenuTrigger>
																		<DropdownMenuContent
																			align="start"
																			className="w-28"
																		>
																			{["low", "medium", "high"].map(
																				(priorityLevel) => (
																					<DropdownMenuItem
																						className={cn(
																							"font-bold tracking-wide",
																							priorityLevel === "high"
																								? "text-destructive focus:text-destructive"
																								: priorityLevel === "medium"
																									? "text-secondary focus:text-secondary"
																									: "text-muted-foreground"
																						)}
																						key={priorityLevel}
																						onClick={() => {
																							const newTasks = [
																								...editableTasks,
																							];
																							newTasks[i] = {
																								...newTasks[i],
																								priority: priorityLevel,
																							};
																							setEditableTasks(newTasks);
																						}}
																					>
																						{priorityLevel.toUpperCase()}
																					</DropdownMenuItem>
																				)
																			)}
																		</DropdownMenuContent>
																	</DropdownMenu>
																</div>
															</div>
														</div>
													);
												})}
											</div>
										</div>
									)}

									{/* Decisions */}
									{notesData.decisions && notesData.decisions.length > 0 && (
										<div
											className={cn(
												"space-y-4",
												isFocusMode && "col-span-12 lg:col-span-5"
											)}
										>
											<h3 className="text-xl font-bold text-foreground flex items-center gap-2.5">
												<MessageSquare className="size-5 text-primary" />
												Key Decisions
											</h3>
											<div className="bg-card border border-border rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 p-5">
												<ul className="space-y-4 text-sm text-foreground">
													{notesData.decisions.map((d: string, i: number) => (
														<li className="flex gap-3 items-start" key={i}>
															<div className="mt-1.5 size-1.5 rounded-full bg-primary flex-shrink-0" />
															<span className="leading-relaxed font-medium">
																{d}
															</span>
														</li>
													))}
												</ul>
											</div>
										</div>
									)}
								</div>

								{/* Export Options (at the end of the intelligence section) */}
								{notesData && (
									<div className="flex items-center gap-3 bg-secondary/5 p-5 rounded-2xl border border-secondary/15 group hover:bg-secondary/10 transition-all duration-300">
										<div className="flex-1">
											<p className="text-sm font-bold text-foreground">
												Export notes
											</p>
											<p className="text-xs text-muted-foreground">
												Download these notes as a meeting-minutes document
											</p>
										</div>
										<div className="flex items-center gap-2">
											<Button
												className="h-10 px-4 gap-2 bg-card border-secondary/20 text-secondary hover:bg-secondary/10 hover:border-secondary/30 shadow-sm transition-all active:scale-95"
												onClick={() => handleExport("pdf")}
												variant="outline"
											>
												<FileDown className="size-4" />
												<span className="font-semibold">PDF</span>
											</Button>
											<Button
												className="h-10 px-4 gap-2 bg-card border-secondary/20 text-secondary hover:bg-secondary/10 hover:border-secondary/30 shadow-sm transition-all active:scale-95"
												onClick={() => handleExport("word")}
												variant="outline"
											>
												<Download className="size-4" />
												<span className="font-semibold">Word</span>
											</Button>
										</div>
									</div>
								)}

								{/* Chat History Divider */}
								{chatHistory.length > 0 && (
									<div
										className={cn(
											"pt-10 mt-6",
											isFocusMode ? "max-w-3xl mx-auto" : ""
										)}
									>
										<div className="flex items-center gap-4 mb-8">
											<div className="h-px bg-border flex-1" />
											<h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
												Follow-up Discussion
											</h3>
											<div className="h-px bg-border flex-1" />
										</div>
										<div className="space-y-6">
											{chatHistory.map((msg, i) => (
												<div
													className={cn(
														"flex flex-col",
														msg.role === "user" ? "items-end" : "items-start"
													)}
													key={i}
												>
													<div
														className={cn(
															"p-4 rounded-lg text-sm leading-relaxed max-w-[85%] shadow-sm",
															msg.role === "user"
																? "bg-secondary text-secondary-foreground rounded-br-sm"
																: "bg-card text-foreground rounded-bl-sm border border-border"
														)}
													>
														{msg.content}
													</div>
												</div>
											))}
											{isChatting && (
												<div className="mr-auto p-4 rounded-lg bg-card rounded-bl-sm border border-border shadow-sm">
													<div className="flex gap-1.5 items-center">
														<span
															className="w-2 h-2 rounded-full bg-muted-foreground animate-pulse motion-reduce:animate-none"
															style={{ animationDelay: "0ms" }}
														/>
														<span
															className="w-2 h-2 rounded-full bg-muted-foreground animate-pulse motion-reduce:animate-none"
															style={{ animationDelay: "150ms" }}
														/>
														<span
															className="w-2 h-2 rounded-full bg-muted-foreground animate-pulse motion-reduce:animate-none"
															style={{ animationDelay: "300ms" }}
														/>
													</div>
												</div>
											)}
											<div className="h-4" ref={chatEndRef} />
										</div>
									</div>
								)}
							</div>
						) : (
							<div className="flex flex-col items-center justify-center h-full text-center space-y-6 opacity-60 pt-20">
								<div className="size-24 rounded-full bg-muted flex items-center justify-center">
									<FileText className="size-10 text-muted-foreground" />
								</div>
								<div className="space-y-2">
									<h3 className="text-lg font-bold text-foreground">
										No notes yet
									</h3>
									<p className="text-sm text-muted-foreground max-w-sm">
										Generate notes, action items, and decisions from this
										channel&apos;s messages.
									</p>
								</div>
							</div>
						)}
					</div>
				</div>

				{/* Sticky Footer Controls */}
				{notesData && (
					<div className="border-t border-border bg-card flex-shrink-0 flex flex-col items-center w-full shadow-[0_-4px_20px_-15px_rgba(0,0,0,0.1)] z-20">
						<div
							className={cn(
								"w-full flex flex-col",
								isFocusMode && "max-w-5xl mx-auto px-4"
							)}
						>
							{/* Chat Input */}
							<form
								className="p-4 border-b border-border flex gap-3 bg-transparent"
								onSubmit={handleChatSubmit}
							>
								<Input
									className="bg-muted border-border h-12 rounded-lg px-5 shadow-inner transition-all hover:bg-muted/70 focus:bg-card text-sm"
									disabled={isChatting}
									onChange={(e) => setChatInput(e.target.value)}
									placeholder="Ask AI to refine notes or extract more details..."
									value={chatInput}
								/>
								<Button
									className="bg-secondary hover:bg-secondary/90 h-12 w-12 shadow-sm transition-all hover:scale-105 active:scale-95"
									disabled={isChatting || !chatInput.trim()}
									size="icon"
									type="submit"
								>
									<Send className="size-5 ml-0.5" />
								</Button>
							</form>

							{/* Action Buttons */}
							<div
								className={cn(
									"p-4 flex gap-3",
									isFocusMode ? "flex-row" : "flex-col"
								)}
							>
								<Button
									className={cn(
										"bg-primary hover:bg-primary/90 text-primary-foreground h-12 font-semibold shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-95 text-sm",
										isFocusMode ? "flex-1" : "w-full"
									)}
									disabled={
										isCreatingTasks ||
										!editableTasks.some((t) => t.selected && !t.pushed)
									}
									onClick={handleCreateTasks}
								>
									{isCreatingTasks ? (
										<Loader2 className="size-5 animate-spin mr-2" />
									) : (
										<PlusCircle className="size-5 mr-2" />
									)}
									Push to Tasks Dashboard
								</Button>
								<div
									className={cn(
										"flex gap-2",
										isFocusMode ? "w-auto" : "w-full"
									)}
								>
									<Button
										className="w-full px-8 h-12 bg-card border-2 border-border text-foreground hover:bg-muted hover:border-muted-foreground/30 font-semibold shadow-sm transition-all hover:-translate-y-0.5 active:translate-y-0 active:scale-95 text-sm"
										disabled={isSaving}
										onClick={handleSaveToConvex}
									>
										{isSaving ? (
											<Loader2 className="size-5 animate-spin mr-2" />
										) : (
											<Save className="size-5 mr-2" />
										)}
										Save Note
									</Button>
								</div>
							</div>
						</div>
					</div>
				)}
			</div>
		</>
	);
};
