"use client";

import { useMutation, useQuery } from "convex/react";
import {
	Brain,
	CheckSquare,
	ChevronDown,
	ChevronRight,
	Clock,
	Download,
	FileDown,
	FileText,
	Loader,
	MessageSquare,
	Mic,
	Search,
	Sparkles,
	Target,
	Upload,
	Video,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/../convex/_generated/api";
import type { Doc, Id } from "@/../convex/_generated/dataModel";
import { EmptyState } from "@/components/empty-state";
import { PageShell } from "@/components/page-shell";
import { StatusDot, type StatusTone } from "@/components/status-dot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NewMeetingModal } from "@/features/audio/components/new-meeting-modal";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import { exportToPDF, exportToWord } from "@/lib/client/export-utils";
import {
	useSetWorkspaceTitle,
	WorkspaceTitle,
} from "../workspace-title-context";

export default function MeetingsPage() {
	useSetWorkspaceTitle(<WorkspaceTitle icon={Brain} label="Meetings" />);

	const workspaceId = useWorkspaceId();
	const allNotes = useQuery(api.content.meetingNotes.getByWorkspace, {
		workspaceId: workspaceId as Id<"workspaces">,
	});
	const [expandedNote, setExpandedNote] = useState<string | null>(null);
	const [startMeetingOpen, setStartMeetingOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [sourceFilter, setSourceFilter] = useState<
		"all" | "live" | "upload" | "chat"
	>("all");

	const sortedNotes = [...(allNotes || [])]
		.filter((note) => {
			// Source filter
			if (sourceFilter === "chat" && !note.roomId.startsWith("chat-"))
				return false;
			if (
				sourceFilter === "live" &&
				(note.source !== "live" || note.roomId.startsWith("chat-"))
			)
				return false;
			if (sourceFilter === "upload" && note.source !== "upload") return false;
			// Search filter
			if (searchQuery.trim()) {
				const q = searchQuery.toLowerCase();
				return (
					(note.title || "").toLowerCase().includes(q) ||
					(note.transcript || "").toLowerCase().includes(q) ||
					(note.summary || "").toLowerCase().includes(q) ||
					(note.roomId || "").toLowerCase().includes(q) ||
					(note.actionItems || []).some((a: string) =>
						a.toLowerCase().includes(q)
					) ||
					(note.decisions || []).some((d: string) =>
						d.toLowerCase().includes(q)
					)
				);
			}
			return true;
		})
		.sort((a, b) => b.createdAt - a.createdAt);

	return (
		<PageShell className="max-w-4xl">
			{/* Header */}
			<div className="flex items-center gap-3">
				<div className="flex size-10 items-center justify-center rounded-xl border border-secondary/20 bg-secondary/10">
					<Brain className="size-5 text-secondary" />
				</div>
				<div className="flex-1">
					<h1 className="text-2xl font-semibold tracking-tight text-foreground">
						Meetings
					</h1>
					<p className="text-sm text-muted-foreground">
						{allNotes
							? `${allNotes.length} note${allNotes.length !== 1 ? "s" : ""}`
							: "Loading..."}{" "}
						— All your AI-generated meeting notes
					</p>
				</div>
				<Button className="gap-1.5" onClick={() => setStartMeetingOpen(true)}>
					<Video className="size-4" /> Start Meeting
				</Button>
			</div>

			<NewMeetingModal
				onOpenChange={setStartMeetingOpen}
				open={startMeetingOpen}
			/>

			{/* Search + Filters */}
			<div className="flex items-center gap-3">
				<div className="relative flex-1 max-w-md">
					<Search className="size-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
					<Input
						className="rounded-full border-border bg-muted/50 pl-10 focus:bg-card"
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder="Search notes, transcripts, tasks..."
						type="text"
						value={searchQuery}
					/>
				</div>
				<Tabs
					onValueChange={(value) =>
						setSourceFilter(value as "all" | "live" | "upload" | "chat")
					}
					value={sourceFilter}
				>
					<TabsList>
						<TabsTrigger value="all">All</TabsTrigger>
						<TabsTrigger className="gap-1.5" value="live">
							<Mic className="size-3.5" /> Live
						</TabsTrigger>
						<TabsTrigger className="gap-1.5" value="upload">
							<Upload className="size-3.5" /> Upload
						</TabsTrigger>
						<TabsTrigger className="gap-1.5" value="chat">
							<MessageSquare className="size-3.5" /> Chat
						</TabsTrigger>
					</TabsList>
				</Tabs>
			</div>

			{/* Content */}
			{!allNotes ? (
				<div className="flex items-center justify-center py-20">
					<Loader className="size-8 animate-spin text-muted-foreground" />
				</div>
			) : sortedNotes.length === 0 ? (
				<EmptyState
					action={{
						label: "Start Meeting",
						onClick: () => setStartMeetingOpen(true),
						icon: Video,
					}}
					description="Start a meeting with a channel or teammate and record it, or upload a recording to generate AI notes."
					icon={Sparkles}
					title="No meeting notes yet"
				/>
			) : (
				<div className="space-y-3">
					{sortedNotes.map((note) => (
						<NoteCard
							isExpanded={expandedNote === note._id}
							key={note._id}
							note={note}
							onToggle={() =>
								setExpandedNote(expandedNote === note._id ? null : note._id)
							}
						/>
					))}
				</div>
			)}
		</PageShell>
	);
}

function NoteCard({
	note,
	isExpanded,
	onToggle,
}: {
	note: Doc<"meetingNotes">;
	isExpanded: boolean;
	onToggle: () => void;
}) {
	const [activeTab, setActiveTab] = useState("summary");
	const [isPushingTasks, setIsPushingTasks] = useState(false);
	const [isSavingNote, setIsSavingNote] = useState(false);

	const createBulkTasks = useMutation(api.planning.tasks.createBulkFromAI);
	const createNote = useMutation(api.content.notes.create);

	const channels = useQuery(api.messaging.channels.get, {
		workspaceId: note.workspaceId as Id<"workspaces">,
	});

	const generations = useQuery(api.content.meetingNotes.getGenerations, {
		roomId: note.roomId,
	});
	const [selectedGen, setSelectedGen] = useState(-1);

	const currentGen =
		selectedGen === -1
			? generations && generations.length > 0
				? generations[generations.length - 1]
				: null
			: generations
				? generations[selectedGen]
				: null;

	const handleExport = (format: "pdf" | "word") => {
		if (!currentGen && !note.summary) {
			toast.error("No notes to export for this meeting.");
			return;
		}

		const data = {
			title:
				note.title ||
				`Meeting Notes - ${new Date(note.createdAt).toLocaleDateString()}`,
			summary: currentGen?.summary || note.summary || "",
			actionItems: (currentGen?.actionItems || note.actionItems || []).map(
				(a: string | { title: string; assignee?: string }) =>
					typeof a === "string"
						? a
						: `${a.title}${a.assignee ? ` (Assigned to: ${a.assignee})` : ""}`
			),
			decisions: currentGen?.decisions || note.decisions || [],
			date: new Date(note.createdAt).toLocaleString(),
		};

		if (format === "pdf") {
			exportToPDF(data);
		} else {
			exportToWord(data);
		}
	};

	const date = new Date(note.createdAt);
	const isChat = note.roomId.startsWith("chat-");
	const isUpload = note.source === "upload";
	const _isLive = !isChat && !isUpload;
	const hasGenerations = generations && generations.length > 0;

	const sourceLabel = isChat
		? "Chat Notes"
		: isUpload
			? "Uploaded Recording"
			: "Live Meeting";
	const SourceIcon = isChat ? MessageSquare : isUpload ? Upload : Mic;
	const statusTone: StatusTone =
		note.status === "completed"
			? "success"
			: note.status === "generating"
				? "warning"
				: note.status === "failed"
					? "destructive"
					: "neutral";

	const priorityBadgeVariant = (priority: string) => {
		if (priority === "high") return "destructiveSoft";
		if (priority === "medium") return "warning";
		return "success";
	};

	// Derive a smart title from summary or transcript if no explicit title
	const deriveTitle = () => {
		if (note.title) return note.title;
		// Try to extract topic from summary
		const summary = currentGen?.summary || note.summary;
		if (summary) {
			// Take first sentence and truncate
			const firstSentence = summary.split(/[.!?]/)[0]?.trim();
			if (firstSentence && firstSentence.length > 10) {
				return firstSentence.length > 60
					? `${firstSentence.slice(0, 57)}...`
					: firstSentence;
			}
		}
		// Fallback: use source label + truncated ID
		return `${sourceLabel} — ${note.roomId.slice(0, 20)}`;
	};

	return (
		<div className="rounded-2xl border border-border bg-card overflow-hidden transition-colors hover:border-primary/30">
			{/* Card Header */}
			<button
				className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-muted/50 transition-colors"
				onClick={onToggle}
				type="button"
			>
				<div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
					<SourceIcon className="size-4 text-primary" />
				</div>
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2">
						<p className="text-sm font-semibold text-foreground truncate">
							{deriveTitle()}
						</p>
						<StatusDot label={note.status} tone={statusTone} />
					</div>
					<div className="flex items-center gap-3 mt-0.5">
						<span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
							{sourceLabel}
						</span>
						<span className="text-muted-foreground/50">·</span>
						<span className="text-xs text-muted-foreground flex items-center gap-1">
							<Clock className="size-3" />
							{date.toLocaleDateString()} at{" "}
							{date.toLocaleTimeString([], {
								hour: "2-digit",
								minute: "2-digit",
							})}
						</span>
						{hasGenerations && (
							<span className="text-xs text-primary font-medium">
								{generations.length} generation
								{generations.length > 1 ? "s" : ""}
							</span>
						)}
						<span className="text-xs text-muted-foreground">
							{note.transcript?.length || 0} chars
						</span>
					</div>
				</div>
				{isExpanded ? (
					<ChevronDown className="size-4 text-muted-foreground" />
				) : (
					<ChevronRight className="size-4 text-muted-foreground" />
				)}
			</button>

			{/* Export Buttons (Inline) */}
			{isExpanded && (currentGen || note.summary) && (
				<div className="px-5 py-2 bg-card flex items-center gap-2 border-b border-border">
					<Button
						className="h-8 text-[11px] gap-1.5"
						onClick={() => handleExport("pdf")}
						size="sm"
						variant="outline"
					>
						<FileDown className="size-3.5 text-destructive" /> Export PDF
					</Button>
					<Button
						className="h-8 text-[11px] gap-1.5"
						onClick={() => handleExport("word")}
						size="sm"
						variant="outline"
					>
						<Download className="size-3.5 text-primary" /> Export Word
					</Button>
					<div className="flex-1" />
					<Button
						className="h-8 text-[11px] font-bold gap-1.5 border-success/20 bg-success/10 text-success hover:bg-success/15"
						disabled={isSavingNote}
						onClick={async () => {
							if (!channels || channels.length === 0) {
								toast.error("No channel found to save the note");
								return;
							}
							try {
								setIsSavingNote(true);
								const summary = currentGen?.summary || note.summary || "";
								const tasks = (
									currentGen?.actionItems ||
									note.actionItems ||
									[]
								)
									.map((t: string | { title: string }) =>
										typeof t === "string" ? `- ${t}` : `- ${t.title}`
									)
									.join("\n");
								const decisions = (
									currentGen?.decisions ||
									note.decisions ||
									[]
								)
									.map((d: string) => `- ${d}`)
									.join("\n");

								const textRep = `Summary:\n${summary}\n\nAction Items:\n${tasks}\n\nDecisions:\n${decisions}`;
								const delta = JSON.stringify({ ops: [{ insert: textRep }] });

								await createNote({
									title:
										note.title ||
										`AI Meeting Notes - ${new Date(note.createdAt).toLocaleDateString()}`,
									content: delta,
									workspaceId: note.workspaceId as Id<"workspaces">,
									channelId: channels[0]._id,
									icon: "✨",
									tags: ["AI", "Meeting"],
								});
								toast.success("Notes saved to your workspace library!");
							} catch (_e) {
								toast.error("Failed to save to library");
							} finally {
								setIsSavingNote(false);
							}
						}}
						size="sm"
						variant="outline"
					>
						{isSavingNote ? (
							<div className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
						) : (
							<Sparkles className="size-3.5" />
						)}
						Save to Note Library
					</Button>
				</div>
			)}

			{/* Expanded Content */}
			{isExpanded && (
				<div className="border-t border-border">
					{/* Generation selector */}
					{hasGenerations && generations.length > 1 && (
						<div className="px-5 py-2 bg-muted/40 border-b border-border flex items-center gap-2 overflow-x-auto">
							<span className="text-[11px] text-muted-foreground font-medium shrink-0">
								Version:
							</span>
							{generations.map((gen, idx) => (
								<button
									className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors shrink-0 ${(selectedGen === -1 && idx === generations.length - 1) || selectedGen === idx ? "bg-primary/10 text-primary" : "bg-card text-muted-foreground hover:bg-muted"}`}
									key={gen._id}
									onClick={() => setSelectedGen(idx)}
									type="button"
								>
									Gen #{gen.generationNumber}
								</button>
							))}
						</div>
					)}

					<Tabs onValueChange={setActiveTab} value={activeTab}>
						<div className="px-5 pt-3">
							<TabsList className="grid w-full grid-cols-4">
								<TabsTrigger className="gap-1.5" value="summary">
									<FileText className="size-3.5" /> Summary
								</TabsTrigger>
								<TabsTrigger className="gap-1.5" value="tasks">
									<CheckSquare className="size-3.5" /> Tasks
								</TabsTrigger>
								<TabsTrigger className="gap-1.5" value="decisions">
									<Target className="size-3.5" /> Decisions
								</TabsTrigger>
								<TabsTrigger className="gap-1.5" value="transcript">
									<MessageSquare className="size-3.5" /> Transcript
								</TabsTrigger>
							</TabsList>
						</div>

						<div className="px-5 py-4">
							{/* SUMMARY TAB */}
							<TabsContent className="m-0" value="summary">
								{currentGen?.summary || note.summary ? (
									<div className="space-y-3">
										<h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
											<FileText className="size-3.5 text-primary" /> Executive
											Summary
										</h4>
										<div className="bg-muted/40 p-5 rounded-2xl border border-border">
											<p className="text-sm text-foreground leading-[1.8]">
												{currentGen?.summary || note.summary}
											</p>
										</div>
									</div>
								) : (
									<div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
										<FileText className="size-8 opacity-30" />
										<p className="text-sm font-medium">
											No summary generated yet
										</p>
									</div>
								)}
							</TabsContent>

							{/* TASKS TAB */}
							<TabsContent className="m-0" value="tasks">
								{(() => {
									const genItems = currentGen?.actionItems;
									const noteItems = note.actionItems;
									const hasGen = genItems && genItems.length > 0;
									const hasNote = noteItems && noteItems.length > 0;

									if (hasGen) {
										return (
											<div className="space-y-3">
												<div className="flex items-center justify-between">
													<h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
														<CheckSquare className="size-3.5 text-success" />{" "}
														Action Items
													</h4>
													<div className="flex items-center gap-2">
														<Button
															className="h-7 text-[10px] font-bold gap-1 bg-success/10 text-success hover:bg-success/15 border-success/20"
															disabled={isPushingTasks}
															onClick={async () => {
																try {
																	setIsPushingTasks(true);
																	await createBulkTasks({
																		workspaceId:
																			note.workspaceId as Id<"workspaces">,
																		tasks: genItems.map((t) => ({
																			title: t.title,
																			assigneeUserId: t.assigneeUserId
																				? (t.assigneeUserId as Id<"users">)
																				: undefined,
																			priority: t.priority || "medium",
																		})),
																	});
																	toast.success(
																		`Successfully pushed ${genItems.length} tasks to dashboard!`
																	);
																} catch (_e) {
																	toast.error("Failed to push tasks");
																} finally {
																	setIsPushingTasks(false);
																}
															}}
															size="sm"
															variant="outline"
														>
															{isPushingTasks ? (
																<div className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
															) : (
																<Target className="size-3" />
															)}
															Push to Dashboard
														</Button>
														<Badge
															className="text-[10px] font-bold"
															variant="success"
														>
															{genItems.length} tasks
														</Badge>
													</div>
												</div>
												<div className="space-y-2">
													{genItems.map((task, i) => (
														<div
															className="bg-card border border-border p-4 rounded-xl hover:border-primary/30 transition-colors group"
															key={i}
														>
															<div className="flex items-start gap-3">
																<div className="size-6 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
																	<span className="text-[11px] font-bold text-primary">
																		{i + 1}
																	</span>
																</div>
																<div className="flex-1 min-w-0">
																	<p className="text-sm font-semibold text-foreground leading-snug">
																		{task.title}
																	</p>
																	<div className="flex items-center gap-2 mt-2 flex-wrap">
																		{task.assignee && (
																			<span className="inline-flex items-center gap-1 text-[10px] font-bold bg-muted text-foreground px-2 py-0.5 rounded-full">
																				<span className="size-3 rounded-full bg-primary/15 flex items-center justify-center text-[7px] font-black text-primary">
																					{task.assignee[0]?.toUpperCase()}
																				</span>
																				{task.assignee}
																			</span>
																		)}
																		{task.priority && (
																			<Badge
																				className="text-[10px] font-bold"
																				variant={priorityBadgeVariant(
																					task.priority
																				)}
																			>
																				{task.priority.charAt(0).toUpperCase() +
																					task.priority.slice(1)}
																			</Badge>
																		)}
																		{task.dueDate && (
																			<span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
																				<Clock className="size-3" />{" "}
																				{task.dueDate}
																			</span>
																		)}
																	</div>
																</div>
															</div>
														</div>
													))}
												</div>
											</div>
										);
									} else if (hasNote) {
										return (
											<div className="space-y-3">
												<div className="flex items-center justify-between">
													<h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
														<CheckSquare className="size-3.5 text-success" />{" "}
														Action Items
													</h4>
													<Badge
														className="text-[10px] font-bold"
														variant="success"
													>
														{noteItems.length} tasks
													</Badge>
												</div>
												<div className="space-y-2">
													{noteItems.map((item: string, i: number) => {
														const arrowIdx = item.indexOf(" → ");
														const taskTitle =
															arrowIdx > -1
																? item.slice(0, arrowIdx)
																: item.replace(
																		/\s*\[(high|medium|low)\]\s*$/i,
																		""
																	);
														const afterArrow =
															arrowIdx > -1 ? item.slice(arrowIdx + 3) : "";
														const prioMatch =
															afterArrow.match(/\[(high|medium|low)\]/i) ||
															item.match(/\[(high|medium|low)\]/i);
														const assignee =
															afterArrow
																.replace(/\s*\[(high|medium|low)\]\s*/i, "")
																.trim() || null;
														const priority = prioMatch
															? prioMatch[1].toLowerCase()
															: null;
														return (
															<div
																className="bg-card border border-border p-4 rounded-xl hover:border-primary/30 transition-colors"
																key={i}
															>
																<div className="flex items-start gap-3">
																	<div className="size-6 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
																		<span className="text-[11px] font-bold text-primary">
																			{i + 1}
																		</span>
																	</div>
																	<div className="flex-1 min-w-0">
																		<p className="text-sm font-semibold text-foreground leading-snug">
																			{taskTitle}
																		</p>
																		{(assignee || priority) && (
																			<div className="flex items-center gap-2 mt-2 flex-wrap">
																				{assignee && (
																					<span className="inline-flex items-center gap-1 text-[10px] font-bold bg-muted text-foreground px-2 py-0.5 rounded-full">
																						<span className="size-3 rounded-full bg-primary/15 flex items-center justify-center text-[7px] font-black text-primary">
																							{assignee[0]?.toUpperCase()}
																						</span>
																						{assignee}
																					</span>
																				)}
																				{priority && (
																					<Badge
																						className="text-[10px] font-bold"
																						variant={priorityBadgeVariant(
																							priority
																						)}
																					>
																						{priority.charAt(0).toUpperCase() +
																							priority.slice(1)}
																					</Badge>
																				)}
																			</div>
																		)}
																	</div>
																</div>
															</div>
														);
													})}
												</div>
											</div>
										);
									} else {
										return (
											<div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
												<CheckSquare className="size-8 opacity-30" />
												<p className="text-sm font-medium">
													No action items found
												</p>
											</div>
										);
									}
								})()}
							</TabsContent>

							{/* DECISIONS TAB */}
							<TabsContent className="m-0" value="decisions">
								{(() => {
									const genDecisions = currentGen?.decisions;
									const noteDecisions = note.decisions;
									const items =
										genDecisions && genDecisions.length > 0
											? genDecisions
											: noteDecisions;

									if (items && items.length > 0) {
										return (
											<div className="space-y-3">
												<div className="flex items-center justify-between">
													<h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
														<Target className="size-3.5 text-primary" /> Key
														Decisions
													</h4>
													<Badge
														className="text-[10px] font-bold"
														variant="primarySoft"
													>
														{items.length} decisions
													</Badge>
												</div>
												<div className="space-y-2">
													{items.map((d: string, i: number) => (
														<div
															className="bg-card border border-border p-4 rounded-xl hover:border-primary/30 transition-colors"
															key={i}
														>
															<div className="flex items-start gap-3">
																<div className="size-6 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
																	<span className="text-[11px] font-bold text-primary">
																		{i + 1}
																	</span>
																</div>
																<p className="text-sm font-medium text-foreground leading-snug">
																	{d}
																</p>
															</div>
														</div>
													))}
												</div>
											</div>
										);
									} else {
										return (
											<div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
												<Target className="size-8 opacity-30" />
												<p className="text-sm font-medium">
													No decisions recorded
												</p>
											</div>
										);
									}
								})()}
							</TabsContent>

							{/* TRANSCRIPT TAB */}
							<TabsContent className="m-0" value="transcript">
								{note.transcript ? (
									<div className="space-y-3">
										<div className="flex items-center justify-between">
											<h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
												<MessageSquare className="size-3.5 text-muted-foreground" />{" "}
												Full Transcript
											</h4>
											<span className="text-[10px] font-medium text-muted-foreground">
												{note.transcript.length.toLocaleString()} characters
											</span>
										</div>
										<div className="text-[12px] text-muted-foreground font-mono bg-muted/40 p-5 rounded-2xl whitespace-pre-wrap max-h-[400px] overflow-y-auto leading-relaxed border border-border selection:bg-primary/15">
											{note.transcript}
										</div>
									</div>
								) : (
									<div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
										<MessageSquare className="size-8 opacity-30" />
										<p className="text-sm font-medium">
											No transcript available
										</p>
									</div>
								)}
							</TabsContent>
						</div>
					</Tabs>
				</div>
			)}
		</div>
	);
}
