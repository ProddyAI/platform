"use client";

import { useQuery } from "convex/react";
import {
	Brain,
	CheckSquare,
	ChevronDown,
	ChevronRight,
	Clock,
	Download,
	FileDown,
	FileText,
	MessageSquare,
	Mic,
	Search,
	Sparkles,
	Target,
	Upload,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import { exportToPDF, exportToWord } from "@/lib/export-utils";

export default function MeetingNotesPage() {
	const workspaceId = useWorkspaceId();
	const allNotes = useQuery(api.meetingNotes.getByWorkspace, {
		workspaceId: workspaceId as Id<"workspaces">,
	});
	const [expandedNote, setExpandedNote] = useState<string | null>(null);
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
		<div className="flex flex-col h-full bg-white dark:bg-zinc-950">
			{/* Header */}
			<div className="border-b px-8 py-6 flex-shrink-0">
				<div className="flex items-center gap-3 mb-4">
					<div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
						<Brain className="w-5 h-5 text-white" />
					</div>
					<div className="flex-1">
						<h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
							Meeting Notes
						</h1>
						<p className="text-sm text-gray-500 dark:text-gray-400">
							{allNotes
								? `${allNotes.length} note${allNotes.length !== 1 ? "s" : ""}`
								: "Loading..."}{" "}
							— All your AI-generated meeting notes
						</p>
					</div>
				</div>
				{/* Search + Filters */}
				<div className="flex items-center gap-3">
					<div className="relative flex-1 max-w-md">
						<Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
						<input
							className="w-full pl-9 pr-4 py-2 text-sm bg-gray-100 dark:bg-zinc-800 border-0 rounded-xl focus:bg-white dark:focus:bg-zinc-900 focus:ring-1 focus:ring-blue-500 outline-none text-gray-900 dark:text-white placeholder:text-gray-400 transition-colors"
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder="Search notes, transcripts, tasks..."
							type="text"
							value={searchQuery}
						/>
					</div>
					<div className="flex items-center gap-1 bg-gray-100 dark:bg-zinc-800 rounded-xl p-1">
						{[
							{ key: "all", label: "All", icon: null },
							{ key: "live", label: "Live", icon: Mic },
							{ key: "upload", label: "Upload", icon: Upload },
							{ key: "chat", label: "Chat", icon: MessageSquare },
						].map((f) => (
							<button
								className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${sourceFilter === f.key ? "bg-white dark:bg-zinc-700 text-gray-900 dark:text-white shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
								key={f.key}
								onClick={() => setSourceFilter(f.key as any)}
							>
								{f.icon && <f.icon className="w-3 h-3" />}
								{f.label}
							</button>
						))}
					</div>
				</div>
			</div>

			{/* Content */}
			<ScrollArea className="flex-1 px-8 py-6">
				{!allNotes ? (
					<div className="flex items-center justify-center py-20">
						<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
					</div>
				) : sortedNotes.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-4">
						<Sparkles className="w-12 h-12 opacity-30" />
						<p className="text-lg font-medium">No meeting notes yet</p>
						<p className="text-sm">
							Start a meeting and record it, or upload a recording to generate
							AI notes.
						</p>
					</div>
				) : (
					<div className="space-y-3 max-w-4xl">
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
			</ScrollArea>
		</div>
	);
}

function NoteCard({
	note,
	isExpanded,
	onToggle,
}: {
	note: any;
	isExpanded: boolean;
	onToggle: () => void;
}) {
	const [activeTab, setActiveTab] = useState("summary");
	const generations = useQuery(api.meetingNotes.getGenerations, {
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
				(a: any) =>
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
	const iconBg = isChat
		? "bg-orange-100 dark:bg-orange-900/30"
		: isUpload
			? "bg-purple-100 dark:bg-purple-900/30"
			: "bg-blue-100 dark:bg-blue-900/30";
	const iconColor = isChat
		? "text-orange-600"
		: isUpload
			? "text-purple-600"
			: "text-blue-600";

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
		<div className="border border-gray-200 dark:border-zinc-800 rounded-2xl overflow-hidden transition-all hover:border-gray-300 dark:hover:border-zinc-700">
			{/* Card Header */}
			<button
				className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50 dark:hover:bg-zinc-900 transition-colors"
				onClick={onToggle}
			>
				<div
					className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}
				>
					<SourceIcon className={`w-4 h-4 ${iconColor}`} />
				</div>
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2">
						<p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
							{deriveTitle()}
						</p>
						<span
							className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${note.status === "completed" ? "bg-emerald-100 text-emerald-700" : note.status === "generating" ? "bg-yellow-100 text-yellow-700" : note.status === "failed" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}
						>
							{note.status}
						</span>
					</div>
					<div className="flex items-center gap-3 mt-0.5">
						<span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
							{sourceLabel}
						</span>
						<span className="text-gray-300 dark:text-zinc-600">·</span>
						<span className="text-xs text-gray-500 flex items-center gap-1">
							<Clock className="w-3 h-3" />
							{date.toLocaleDateString()} at{" "}
							{date.toLocaleTimeString([], {
								hour: "2-digit",
								minute: "2-digit",
							})}
						</span>
						{hasGenerations && (
							<span className="text-xs text-blue-600 font-medium">
								{generations.length} generation
								{generations.length > 1 ? "s" : ""}
							</span>
						)}
						<span className="text-xs text-gray-400">
							{note.transcript?.length || 0} chars
						</span>
					</div>
				</div>
				{isExpanded ? (
					<ChevronDown className="w-4 h-4 text-gray-400" />
				) : (
					<ChevronRight className="w-4 h-4 text-gray-400" />
				)}
			</button>

			{/* Export Buttons (Inline) */}
			{isExpanded && (currentGen || note.summary) && (
				<div className="px-5 py-2 bg-white dark:bg-zinc-950 flex items-center gap-2 border-b border-gray-100 dark:border-zinc-800">
					<Button
						className="h-8 text-[11px] font-medium gap-1.5 border-gray-200 dark:border-zinc-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-zinc-900 rounded-lg transition-all"
						onClick={() => handleExport("pdf")}
						size="sm"
						variant="outline"
					>
						<FileDown className="w-3.5 h-3.5 text-red-500" /> Export PDF
					</Button>
					<Button
						className="h-8 text-[11px] font-medium gap-1.5 border-gray-200 dark:border-zinc-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-zinc-900 rounded-lg transition-all"
						onClick={() => handleExport("word")}
						size="sm"
						variant="outline"
					>
						<Download className="w-3.5 h-3.5 text-blue-500" /> Export Word
					</Button>
				</div>
			)}

			{/* Expanded Content */}
			{isExpanded && (
				<div className="border-t border-gray-100 dark:border-zinc-800">
					{/* Generation selector */}
					{hasGenerations && generations.length > 1 && (
						<div className="px-5 py-2 bg-gray-50 dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-800 flex items-center gap-2 overflow-x-auto">
							<span className="text-[11px] text-gray-500 font-medium shrink-0">
								Version:
							</span>
							{generations.map((gen: any, idx: number) => (
								<button
									className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors shrink-0 ${(selectedGen === -1 && idx === generations.length - 1) || selectedGen === idx ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" : "bg-white dark:bg-zinc-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100"}`}
									key={gen._id}
									onClick={() => setSelectedGen(idx)}
								>
									Gen #{gen.generationNumber}
								</button>
							))}
						</div>
					)}

					<Tabs onValueChange={setActiveTab} value={activeTab}>
						<div className="px-5 pt-3">
							<TabsList className="bg-gray-100 dark:bg-zinc-800 w-full p-1 h-10 rounded-xl grid grid-cols-4">
								<TabsTrigger
									className="text-xs font-semibold rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"
									value="summary"
								>
									📋 Summary
								</TabsTrigger>
								<TabsTrigger
									className="text-xs font-semibold rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"
									value="tasks"
								>
									✅ Tasks
								</TabsTrigger>
								<TabsTrigger
									className="text-xs font-semibold rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"
									value="decisions"
								>
									🎯 Decisions
								</TabsTrigger>
								<TabsTrigger
									className="text-xs font-semibold rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"
									value="transcript"
								>
									📝 Transcript
								</TabsTrigger>
							</TabsList>
						</div>

						<div className="px-5 py-4">
							{/* SUMMARY TAB */}
							<TabsContent className="m-0" value="summary">
								{currentGen?.summary || note.summary ? (
									<div className="space-y-3">
										<h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
											<FileText className="w-3.5 h-3.5 text-blue-500" />{" "}
											Executive Summary
										</h4>
										<div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-zinc-900 dark:to-zinc-800 p-5 rounded-2xl border border-blue-100 dark:border-zinc-700">
											<p className="text-sm text-gray-800 dark:text-gray-200 leading-[1.8]">
												{currentGen?.summary || note.summary}
											</p>
										</div>
									</div>
								) : (
									<div className="flex flex-col items-center justify-center py-10 text-gray-400 gap-2">
										<FileText className="w-8 h-8 opacity-30" />
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
													<h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
														<CheckSquare className="w-3.5 h-3.5 text-emerald-500" />{" "}
														Action Items
													</h4>
													<span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
														{genItems.length} tasks
													</span>
												</div>
												<div className="space-y-2">
													{genItems.map((task: any, i: number) => (
														<div
															className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 p-4 rounded-xl hover:border-emerald-200 dark:hover:border-emerald-800 transition-colors group"
															key={i}
														>
															<div className="flex items-start gap-3">
																<div className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0 mt-0.5">
																	<span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
																		{i + 1}
																	</span>
																</div>
																<div className="flex-1 min-w-0">
																	<p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">
																		{task.title}
																	</p>
																	<div className="flex items-center gap-2 mt-2 flex-wrap">
																		{task.assignee && (
																			<span className="inline-flex items-center gap-1 text-[10px] font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
																				<span className="w-3 h-3 rounded-full bg-blue-200 dark:bg-blue-800 flex items-center justify-center text-[7px] font-black text-blue-800 dark:text-blue-200">
																					{task.assignee[0]?.toUpperCase()}
																				</span>
																				{task.assignee}
																			</span>
																		)}
																		{task.priority && (
																			<span
																				className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
																					task.priority === "high"
																						? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
																						: task.priority === "medium"
																							? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
																							: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
																				}`}
																			>
																				{task.priority === "high"
																					? "🔴"
																					: task.priority === "medium"
																						? "🟡"
																						: "🟢"}{" "}
																				{task.priority.charAt(0).toUpperCase() +
																					task.priority.slice(1)}
																			</span>
																		)}
																		{task.dueDate && (
																			<span className="text-[10px] font-medium text-gray-400 flex items-center gap-1">
																				<Clock className="w-3 h-3" />{" "}
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
													<h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
														<CheckSquare className="w-3.5 h-3.5 text-emerald-500" />{" "}
														Action Items
													</h4>
													<span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">
														{noteItems.length} tasks
													</span>
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
																className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 p-4 rounded-xl hover:border-emerald-200 transition-colors"
																key={i}
															>
																<div className="flex items-start gap-3">
																	<div className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0 mt-0.5">
																		<span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
																			{i + 1}
																		</span>
																	</div>
																	<div className="flex-1 min-w-0">
																		<p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">
																			{taskTitle}
																		</p>
																		{(assignee || priority) && (
																			<div className="flex items-center gap-2 mt-2 flex-wrap">
																				{assignee && (
																					<span className="inline-flex items-center gap-1 text-[10px] font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
																						<span className="w-3 h-3 rounded-full bg-blue-200 dark:bg-blue-800 flex items-center justify-center text-[7px] font-black text-blue-800 dark:text-blue-200">
																							{assignee[0]?.toUpperCase()}
																						</span>
																						{assignee}
																					</span>
																				)}
																				{priority && (
																					<span
																						className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${priority === "high" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" : priority === "medium" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"}`}
																					>
																						{priority === "high"
																							? "🔴"
																							: priority === "medium"
																								? "🟡"
																								: "🟢"}{" "}
																						{priority.charAt(0).toUpperCase() +
																							priority.slice(1)}
																					</span>
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
											<div className="flex flex-col items-center justify-center py-10 text-gray-400 gap-2">
												<CheckSquare className="w-8 h-8 opacity-30" />
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
													<h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
														<Target className="w-3.5 h-3.5 text-purple-500" />{" "}
														Key Decisions
													</h4>
													<span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
														{items.length} decisions
													</span>
												</div>
												<div className="space-y-2">
													{items.map((d: string, i: number) => (
														<div
															className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 p-4 rounded-xl hover:border-purple-200 dark:hover:border-purple-800 transition-colors"
															key={i}
														>
															<div className="flex items-start gap-3">
																<div className="w-6 h-6 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0 mt-0.5">
																	<span className="text-[11px] font-bold text-purple-700 dark:text-purple-400">
																		{i + 1}
																	</span>
																</div>
																<p className="text-sm font-medium text-gray-800 dark:text-gray-200 leading-snug">
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
											<div className="flex flex-col items-center justify-center py-10 text-gray-400 gap-2">
												<Target className="w-8 h-8 opacity-30" />
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
											<h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
												<MessageSquare className="w-3.5 h-3.5 text-gray-400" />{" "}
												Full Transcript
											</h4>
											<span className="text-[10px] font-medium text-gray-400">
												{note.transcript.length.toLocaleString()} characters
											</span>
										</div>
										<div className="text-[12px] text-gray-600 dark:text-gray-400 font-mono bg-gray-50 dark:bg-zinc-900 p-5 rounded-2xl whitespace-pre-wrap max-h-[400px] overflow-y-auto leading-relaxed border border-gray-100 dark:border-zinc-800 selection:bg-blue-100">
											{note.transcript}
										</div>
									</div>
								) : (
									<div className="flex flex-col items-center justify-center py-10 text-gray-400 gap-2">
										<MessageSquare className="w-8 h-8 opacity-30" />
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
