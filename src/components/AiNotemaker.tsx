"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import {
	CheckCircle2,
	ChevronDown,
	Download,
	FileDown,
	FileText,
	Loader2,
	Maximize2,
	MessageSquare,
	Minimize2,
	PlusCircle,
	Save,
	Send,
	Sparkles,
	X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAiNotemakerStore } from "@/features/ai-notemaker/store/use-ai-notemaker-store";
import { useGetMessages } from "@/features/messages/api/use-get-messages";
import { useChannelId } from "@/hooks/use-channel-id";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import { exportToPDF, exportToWord } from "@/lib/export-utils";
import { cn } from "@/lib/utils";

export const AiNotemaker = ({
	variant = "toolbar",
	channelId: propChannelId,
	workspaceId: propWorkspaceId,
}: {
	variant?: "toolbar" | "default";
	channelId?: string;
	workspaceId?: string;
}) => {
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

	const members = useQuery(api.members.get, { workspaceId }) || [];
	const chatNoteInfo = useQuery(
		api.meetingNotes.getChatNoteForChannel,
		channelId && workspaceId
			? { channelId: String(channelId), workspaceId }
			: "skip"
	);
	const createNote = useMutation(api.notes.create);
	const createBulkTasks = useMutation(api.tasks.createBulkFromAI);
	const generateChatNotesAction = useAction(api.meetingNotes.generateChatNotes);
	const chatWithNotesAction = useAction(api.meetingNotes.chatWithNotes);
	const saveChatToMeetingNotes = useMutation(
		api.meetingNotes.saveChatNotesToHistory
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
	const [notesData, setNotesData] = useState<any | null>(null);
	const [editableTasks, setEditableTasks] = useState<any[]>([]);
	const [transcriptString, setTranscriptString] = useState("");
	const [generatedAt, setGeneratedAt] = useState<Date | null>(null);
	const [activeDropdown, setActiveDropdown] = useState<{
		index: number;
		type: "assignee" | "priority";
	} | null>(null);
	const [showPeriodPicker, setShowPeriodPicker] = useState(false);
	const [selectedPeriod, setSelectedPeriod] = useState<string>("24h");

	// Close dropdowns on outside click
	useEffect(() => {
		const handleClick = (e: MouseEvent) => {
			if (!(e.target as Element).closest(".custom-dropdown-container")) {
				setActiveDropdown(null);
			}
		};
		document.addEventListener("click", handleClick);
		return () => document.removeEventListener("click", handleClick);
	}, []);

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

	useEffect(() => {
		if (chatEndRef.current) {
			chatEndRef.current.scrollIntoView({ behavior: "smooth" });
		}
	}, []);

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
			toast.error(`No messages found for the selected period (${usePeriod}).`);
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
					(m: any) =>
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
					notes.actionItems.map((item: any) => ({ ...item, selected: true }))
				);
			}

			try {
				await saveChatToMeetingNotes({
					workspaceId: workspaceId as any,
					channelId: channelId,
					title: notes.title || undefined,
					transcript,
					summary: notes.summary || "",
					actionItems: (notes.actionItems || []).map(
						(a: {
							title: string;
							assigneeName?: string;
							priority?: string;
						}) => {
							let label = a.title;
							if (a.assigneeName) label += ` → ${a.assigneeName}`;
							if (a.priority) label += ` [${a.priority}]`;
							return label;
						}
					),
					decisions: notes.decisions || [],
				});
				toast.success("✅ Notes saved to Meeting Notes history!");
			} catch (e) {
				console.error("Failed to save to meeting notes history:", e);
				toast.error("Notes generated but failed to save to history.");
			}

			toast.success("AI Notes generated successfully!");
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
				(a: any) =>
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
			const textRep = `Summary:\n${notesData.summary}\n\nAction Items:\n${(notesData.actionItems || []).map((a: any) => `- ${a.title}`).join("\n")}\n\nDecisions:\n${(notesData.decisions || []).map((d: string) => `- ${d}`).join("\n")}`;
			const delta = JSON.stringify({ ops: [{ insert: textRep }] });

			await createNote({
				title: `AI Meeting Notes - ${new Date().toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}`,
				content: delta,
				workspaceId: workspaceId as any,
				channelId: channelId as any,
				icon: "✨",
				tags: ["AI", "Meeting"],
			});
			toast.success("Notes saved to channel library!");
		} catch (_error) {
			toast.error("Failed to save note to Convex.");
		} finally {
			setIsSaving(false);
		}
	};

	const handleCreateTasks = async () => {
		const selectedTasks = editableTasks.filter((t) => t.selected);
		if (selectedTasks.length === 0) {
			toast.error("No tasks selected to push.");
			return;
		}
		setIsCreatingTasks(true);
		try {
			await createBulkTasks({
				workspaceId: workspaceId as any,
				tasks: selectedTasks.map((item: any) => ({
					title: item.title,
					assigneeUserId: item.assigneeUserId || undefined,
					priority: item.priority || "medium",
				})),
			});
			toast.success(
				`${selectedTasks.length} Tasks successfully created and assigned!`
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
				message: message,
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
			<div
				className={cn(
					"bg-white shadow-xl z-20 transition-all duration-300 ease-in-out border-border flex flex-col pointer-events-auto h-full w-full overflow-hidden shrink-0"
				)}
			>
				<div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white/95 backdrop-blur-sm flex-shrink-0 z-20 sticky top-0 shadow-sm">
					<div className="flex items-center gap-3">
						<div className="p-2 bg-gradient-to-br from-indigo-50 to-blue-50 border border-blue-100/50 rounded-xl shadow-sm">
							<Sparkles className="size-5 text-blue-600" />
						</div>
						<div>
							<h2 className="font-bold text-gray-900 text-lg tracking-tight">
								AI Meeting Assistant
							</h2>
							<p className="text-xs text-gray-500 font-medium">
								Powered by Gemini
							</p>
						</div>
					</div>
					<div className="flex items-center gap-2">
						{isFocusMode ? (
							<Button
								className="h-9 w-9 rounded-full hover:bg-gray-100 text-gray-500 transition-all hover:scale-105 active:scale-95"
								onClick={() => setIsFocusMode(false)}
								size="icon"
								title="Exit Focus Mode"
								variant="ghost"
							>
								<Minimize2 className="size-4.5" />
							</Button>
						) : (
							<Button
								className="h-9 w-9 rounded-full hover:bg-gray-100 text-gray-500 transition-all hover:scale-105 active:scale-95"
								onClick={() => setIsFocusMode(true)}
								size="icon"
								title="Enter Focus Mode"
								variant="ghost"
							>
								<Maximize2 className="size-4.5" />
							</Button>
						)}
						<div className="w-px h-5 bg-gray-200 mx-1"></div>
						<Button
							className="h-9 w-9 rounded-full hover:bg-red-50 hover:text-red-600 text-gray-500 transition-all hover:scale-105 active:scale-95"
							onClick={() => setIsOpen(false)}
							size="icon"
							title="Close AI Assistant"
							variant="ghost"
						>
							<X className="size-4.5" />
						</Button>
					</div>
				</div>

				<div
					className={cn(
						"flex-1 overflow-y-auto bg-gray-50/30 p-6 flex flex-col relative scroll-smooth",
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
								<div className="p-3 bg-gradient-to-br from-indigo-50 to-blue-50 border border-blue-100/50 rounded-2xl shadow-sm">
									<Sparkles className="size-8 text-blue-600" />
								</div>
								<div className="text-center space-y-1">
									<h3 className="text-lg font-bold text-gray-900">
										Generate AI Notes
									</h3>
									<p className="text-sm text-gray-500">
										Select the time period to analyze
									</p>
								</div>
								<div className="w-full max-w-xs space-y-2">
									{[
										{ key: "1h", label: "Last 1 hour", icon: "⚡" },
										{ key: "24h", label: "Last 24 hours", icon: "📌" },
										{ key: "7d", label: "Last 7 days", icon: "📆" },
										{ key: "30d", label: "Last 30 days", icon: "📊" },
										{ key: "all", label: "All messages", icon: "📋" },
									].map((opt) => {
										const count = getFilteredMessages(opt.key).length;
										return (
											<button
												className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 ${
													selectedPeriod === opt.key
														? "border-blue-300 bg-blue-50 text-blue-700"
														: "border-gray-200 bg-white hover:border-gray-300 text-gray-700"
												}`}
												disabled={count === 0}
												key={opt.key}
												onClick={() => {
													setSelectedPeriod(opt.key);
													generateAiNotes(opt.key);
												}}
											>
												<div className="flex items-center gap-3">
													<span className="text-lg">{opt.icon}</span>
													<span className="text-sm font-medium">
														{opt.label}
													</span>
												</div>
												<span
													className={`text-xs font-semibold px-2 py-0.5 rounded-full ${count > 0 ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-400"}`}
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
													className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100 border-indigo-200 bg-indigo-50/50 text-indigo-700 hover:border-indigo-300`}
													disabled={count === 0}
													onClick={() => {
														setSelectedPeriod("since_last");
														generateAiNotes("since_last");
													}}
												>
													<div className="flex flex-col items-start gap-0.5">
														<div className="flex items-center gap-3">
															<span className="text-lg">🔄</span>
															<span className="text-sm font-medium">
																Since last generation
															</span>
														</div>
														<span className="text-[10px] text-indigo-400 ml-9">
															Generated {agoText}
														</span>
													</div>
													<span
														className={`text-xs font-semibold px-2 py-0.5 rounded-full ${count > 0 ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-400"}`}
													>
														{count} new
													</span>
												</button>
											);
										})()}
								</div>
								{chatNoteInfo?.lastGeneratedAt && (
									<p className="text-[11px] text-gray-400 text-center">
										✅ Last generated:{" "}
										{new Date(chatNoteInfo.lastGeneratedAt).toLocaleString([], {
											month: "short",
											day: "numeric",
											hour: "2-digit",
											minute: "2-digit",
										})}
									</p>
								)}
								<button
									className="text-xs text-gray-400 hover:text-gray-600 mt-1"
									onClick={() => setShowPeriodPicker(false)}
								>
									Cancel
								</button>
							</div>
						) : isLoading ? (
							<div className="flex flex-col items-center justify-center h-full space-y-6 pt-16">
								<div className="relative inline-flex">
									<div className="absolute inset-0 bg-blue-100 rounded-full blur-xl animate-pulse opacity-50"></div>
									<Loader2 className="size-12 animate-spin text-blue-600 relative z-10" />
									<Sparkles className="size-5 text-blue-400 absolute -top-1 -right-3 animate-bounce z-20" />
								</div>
								<div className="space-y-2 text-center">
									<p className="text-base text-gray-900 font-semibold tracking-tight">
										Structuring your intelligence...
									</p>
									<p className="text-sm text-gray-500 animate-pulse">
										Gemini is analyzing the transcript
									</p>
								</div>
							</div>
						) : notesData ? (
							<div className="space-y-10 flex-1 pb-12">
								{/* Summary Section */}
								<div className="space-y-4">
									<h3 className="text-xl font-bold text-gray-900 flex items-center gap-2.5">
										<FileText className="size-5 text-blue-600" />
										Executive Summary
									</h3>
									{generatedAt && (
										<p className="text-xs text-gray-400 ml-7">
											Generated at{" "}
											{generatedAt.toLocaleTimeString([], {
												hour: "2-digit",
												minute: "2-digit",
											})}{" "}
											on {generatedAt.toLocaleDateString()}
										</p>
									)}
									<div className="bg-indigo-50/30 border border-indigo-100/50 rounded-2xl p-5 ml-7">
										<p className="text-gray-700 text-[15px] leading-relaxed font-medium">
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
											<h3 className="text-xl font-bold text-gray-900 flex items-center gap-2.5">
												<CheckCircle2 className="size-5 text-green-600" />
												Action Items
											</h3>
											<div className="space-y-3">
												{editableTasks.map((item: any, i: number) => {
													const assignedMember = members.find(
														(m) => m.user._id === item.assigneeUserId
													);
													return (
														<div
															className={cn(
																"group flex gap-3 p-4 bg-white border rounded-2xl transition-all duration-300 cursor-pointer select-none",
																item.selected
																	? "border-green-200 shadow-sm hover:shadow-md hover:border-green-300"
																	: "border-gray-100 opacity-60 hover:opacity-100 hover:border-gray-300"
															)}
															key={i}
															onClick={() => {
																const newTasks = [...editableTasks];
																newTasks[i].selected = !newTasks[i].selected;
																setEditableTasks(newTasks);
															}}
														>
															<div className="mt-0.5 flex-shrink-0">
																<div
																	className={cn(
																		"size-5 rounded-full border-2 flex items-center justify-center transition-colors",
																		item.selected
																			? "border-green-500 bg-green-50"
																			: "border-gray-200 group-hover:border-gray-400"
																	)}
																>
																	<div
																		className={cn(
																			"size-2.5 rounded-full bg-green-500 transition-opacity duration-200",
																			item.selected
																				? "opacity-100"
																				: "opacity-0"
																		)}
																	></div>
																</div>
															</div>
															<div className="flex-1 space-y-2">
																<div
																	className={cn(
																		"font-semibold leading-snug transition-colors",
																		item.selected
																			? "text-gray-900"
																			: "text-gray-500"
																	)}
																>
																	{item.title}
																</div>
																<div
																	className="flex flex-wrap items-center gap-2 text-xs"
																	onClick={(e) => e.stopPropagation()}
																>
																	{/* Assignee Custom Dropdown */}
																	<div className="relative custom-dropdown-container">
																		<div
																			className={cn(
																				"flex items-center gap-1.5 py-1 pl-1.5 pr-2.5 rounded-lg border cursor-pointer transition-colors focus-within:ring-2 focus-within:ring-blue-500/20",
																				activeDropdown?.index === i &&
																					activeDropdown.type === "assignee"
																					? "bg-gray-100 border-gray-300"
																					: "bg-gray-50 border-gray-100 hover:bg-gray-100"
																			)}
																			onClick={(e) => {
																				e.stopPropagation();
																				setActiveDropdown(
																					activeDropdown?.index === i &&
																						activeDropdown.type === "assignee"
																						? null
																						: { index: i, type: "assignee" }
																				);
																			}}
																		>
																			<div className="size-5 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center text-[9px] font-bold text-blue-700 shadow-sm flex-shrink-0">
																				{(assignedMember
																					? assignedMember.user.name
																					: item.assigneeName ||
																						"U")[0].toUpperCase()}
																			</div>
																			<span className="text-xs font-semibold text-gray-700">
																				{assignedMember
																					? assignedMember.user.name
																					: item.assigneeName
																						? `${item.assigneeName} (Unmapped)`
																						: "Unassigned"}
																			</span>
																			<ChevronDown className="size-3.5 text-gray-400 ml-0.5" />
																		</div>

																		{activeDropdown?.index === i &&
																			activeDropdown.type === "assignee" && (
																				<div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 shadow-xl rounded-xl py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
																					<div
																						className="px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 cursor-pointer"
																						onClick={(e) => {
																							e.stopPropagation();
																							const newTasks = [
																								...editableTasks,
																							];
																							newTasks[i].assigneeUserId =
																								undefined;
																							setEditableTasks(newTasks);
																							setActiveDropdown(null);
																						}}
																					>
																						{item.assigneeName
																							? `${item.assigneeName} (Unmapped)`
																							: "Unassigned"}
																					</div>
																					<div className="h-px bg-gray-100 my-1"></div>
																					{members.map((m) => (
																						<div
																							className="px-3 py-2 text-xs font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 cursor-pointer flex items-center gap-2"
																							key={m.user._id}
																							onClick={(e) => {
																								e.stopPropagation();
																								const newTasks = [
																									...editableTasks,
																								];
																								newTasks[i].assigneeUserId =
																									m.user._id;
																								setEditableTasks(newTasks);
																								setActiveDropdown(null);
																							}}
																						>
																							<div className="size-4 rounded-full bg-blue-100 flex items-center justify-center text-[8px] font-bold text-blue-700">
																								{(m.user.name || "U")[0].toUpperCase()}
																							</div>
																							{m.user.name || "Unknown"}
																						</div>
																					))}
																				</div>
																			)}
																	</div>

																	{/* Priority Custom Dropdown */}
																	<div className="relative custom-dropdown-container">
																		<div
																			className={cn(
																				"flex items-center gap-1.5 py-1 pl-2.5 pr-2 rounded-lg font-bold tracking-wide border cursor-pointer transition-colors",
																				item.priority === "high"
																					? "bg-red-50 border-red-100 text-red-600 hover:bg-red-100"
																					: item.priority === "medium"
																						? "bg-blue-50 border-blue-100 text-blue-600 hover:bg-blue-100"
																						: "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
																			)}
																			onClick={(e) => {
																				e.stopPropagation();
																				setActiveDropdown(
																					activeDropdown?.index === i &&
																						activeDropdown.type === "priority"
																						? null
																						: { index: i, type: "priority" }
																				);
																			}}
																		>
																			{(
																				item.priority || "medium"
																			).toUpperCase()}
																			<ChevronDown
																				className={cn(
																					"size-3.5 opacity-60",
																					item.priority === "high"
																						? "text-red-600"
																						: item.priority === "medium"
																							? "text-blue-600"
																							: "text-gray-600"
																				)}
																			/>
																		</div>

																		{activeDropdown?.index === i &&
																			activeDropdown.type === "priority" && (
																				<div className="absolute top-full left-0 mt-1 w-28 bg-white border border-gray-200 shadow-xl rounded-xl py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
																					{["low", "medium", "high"].map(
																						(priorityLevel) => (
																							<div
																								className={cn(
																									"px-3 py-2 text-xs font-bold tracking-wide cursor-pointer flex items-center gap-2",
																									priorityLevel === "high"
																										? "hover:bg-red-50 text-red-600"
																										: priorityLevel === "medium"
																											? "hover:bg-blue-50 text-blue-600"
																											: "hover:bg-gray-50 text-gray-600"
																								)}
																								key={priorityLevel}
																								onClick={(e) => {
																									e.stopPropagation();
																									const newTasks = [
																										...editableTasks,
																									];
																									newTasks[i].priority =
																										priorityLevel;
																									setEditableTasks(newTasks);
																									setActiveDropdown(null);
																								}}
																							>
																								{priorityLevel.toUpperCase()}
																							</div>
																						)
																					)}
																				</div>
																			)}
																	</div>
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
											<h3 className="text-xl font-bold text-gray-900 flex items-center gap-2.5">
												<MessageSquare className="size-5 text-purple-600" />
												Key Decisions
											</h3>
											<div className="bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition-all duration-300 p-5">
												<ul className="space-y-4 text-[15px] text-gray-700">
													{notesData.decisions.map((d: string, i: number) => (
														<li className="flex gap-3 items-start" key={i}>
															<div className="mt-1.5 size-1.5 rounded-full bg-purple-500 flex-shrink-0"></div>
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
									<div className="flex items-center gap-3 bg-indigo-50/50 backdrop-blur-sm p-5 rounded-2xl border border-indigo-100/50 group hover:bg-indigo-50 transition-all duration-300">
										<div className="flex-1">
											<p className="text-sm font-bold text-indigo-900">
												Export your intelligence
											</p>
											<p className="text-xs text-indigo-600/70">
												Download these notes as a professional MoM document
											</p>
										</div>
										<div className="flex items-center gap-2">
											<Button
												className="h-10 px-4 rounded-xl gap-2 bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 shadow-sm transition-all active:scale-95"
												onClick={() => handleExport("pdf")}
												variant="outline"
											>
												<FileDown className="size-4 text-red-500" />
												<span className="font-semibold">PDF</span>
											</Button>
											<Button
												className="h-10 px-4 rounded-xl gap-2 bg-white border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300 shadow-sm transition-all active:scale-95"
												onClick={() => handleExport("word")}
												variant="outline"
											>
												<Download className="size-4 text-blue-500" />
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
											<div className="h-px bg-gray-200 flex-1"></div>
											<h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
												Follow-up Discussion
											</h3>
											<div className="h-px bg-gray-200 flex-1"></div>
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
															"p-4 rounded-2xl text-[15px] leading-relaxed max-w-[85%] shadow-sm",
															msg.role === "user"
																? "bg-blue-600 text-white rounded-br-sm"
																: "bg-white text-gray-800 rounded-bl-sm border border-gray-100"
														)}
													>
														{msg.content}
													</div>
												</div>
											))}
											{isChatting && (
												<div className="mr-auto p-4 rounded-2xl bg-white rounded-bl-sm border border-gray-100 shadow-sm">
													<div className="flex gap-1.5 items-center">
														<span
															className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
															style={{ animationDelay: "0ms" }}
														/>
														<span
															className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
															style={{ animationDelay: "150ms" }}
														/>
														<span
															className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
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
								<div className="size-24 rounded-full bg-gray-100 flex items-center justify-center">
									<FileText className="size-10 text-gray-400" />
								</div>
								<div className="space-y-2">
									<h3 className="text-lg font-bold text-gray-800">
										No Intelligence Yet
									</h3>
									<p className="text-sm text-gray-500 max-w-sm">
										Click the generate button to transform your channel
										conversation into structured actionable intelligence.
									</p>
								</div>
							</div>
						)}
					</div>
				</div>

				{/* Sticky Footer Controls */}
				{notesData && (
					<div className="border-t border-gray-100 bg-white/95 backdrop-blur-md flex-shrink-0 flex flex-col items-center w-full shadow-[0_-4px_20px_-15px_rgba(0,0,0,0.1)] z-20">
						<div
							className={cn(
								"w-full flex flex-col",
								isFocusMode && "max-w-5xl mx-auto px-4"
							)}
						>
							{/* Chat Input */}
							<form
								className="p-4 border-b border-gray-50 flex gap-3 bg-transparent"
								onSubmit={handleChatSubmit}
							>
								<Input
									className="bg-gray-50 border-gray-200 focus-visible:ring-blue-500 h-12 rounded-xl px-5 shadow-inner transition-all hover:bg-gray-100 focus:bg-white text-[15px]"
									disabled={isChatting}
									onChange={(e) => setChatInput(e.target.value)}
									placeholder="Ask Gemini to refine notes or extract more details..."
									value={chatInput}
								/>
								<Button
									className="bg-blue-600 hover:bg-blue-700 h-12 w-12 rounded-xl shadow-sm transition-all hover:scale-105 active:scale-95"
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
										"bg-gray-900 hover:bg-gray-800 text-white h-12 rounded-xl font-semibold shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-95 text-[15px]",
										isFocusMode ? "flex-1" : "w-full"
									)}
									disabled={isCreatingTasks}
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
										className="w-full px-8 h-12 bg-white border-2 border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 rounded-xl font-semibold shadow-sm transition-all hover:-translate-y-0.5 active:translate-y-0 active:scale-95 text-[15px]"
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

			{isOpen && !isFocusMode && (
				<div
					className="fixed inset-0 bg-black/20 z-[90] md:hidden backdrop-blur-sm"
					onClick={() => setIsOpen(false)}
				/>
			)}
		</>
	);
};
