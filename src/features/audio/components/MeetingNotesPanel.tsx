import { Brain, CheckSquare, FileText, Loader2, Sparkles, Target, X } from "lucide-react";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useMeetingTranscription } from "../hooks/useMeetingTranscription";

interface MeetingNotesPanelProps {
	roomId: string;
	workspaceId: string;
	channelId?: string;
	onClose: () => void;
	isAudioMuted: boolean;
}

export const MeetingNotesPanel = ({
	roomId,
	workspaceId,
	channelId,
	onClose,
	isAudioMuted,
}: MeetingNotesPanelProps) => {
	const members = useQuery(api.members.get, { workspaceId: workspaceId as Id<"workspaces"> }) || [];
	const createBulkTasks = useMutation(api.tasks.createBulkFromAI);
	const createNote = useMutation(api.notes.create);
	const generations = useQuery(api.meetingNotes.getGenerations, { roomId });
	
	const { meetingNotes, isListening, triggerGenerateInsights } =
		useMeetingTranscription(
			roomId,
			workspaceId,
			channelId,
			!isAudioMuted // Record only when unmuted
		);

	const [activeTab, setActiveTab] = useState("transcript");
	const [isPushingTasks, setIsPushingTasks] = useState(false);
	const [isSavingNote, setIsSavingNote] = useState(false);

	const handleGenerate = () => {
		const membersContext = members
			.map(
				(m: any) =>
					`- ${m.user?.name || "Unknown"} (ID: ${m.user?._id || "Unknown"})`
			)
			.join("\n");
		triggerGenerateInsights(membersContext);
		setActiveTab("summary");
	};

	const handleSaveToLibrary = async () => {
		if (!meetingNotes) return;
		setIsSavingNote(true);
		try {
			const tasks = (meetingNotes.actionItems || [])
				.map((t: string) => `- ${t}`)
				.join("\n");
			const decisions = (meetingNotes.decisions || [])
				.map((d: string) => `- ${d}`)
				.join("\n");

			const textRep = `Summary:\n${meetingNotes.summary}\n\nAction Items:\n${tasks}\n\nDecisions:\n${decisions}`;
			const delta = JSON.stringify({ ops: [{ insert: textRep }] });

			await createNote({
				title: `AI Meeting Notes - ${new Date().toLocaleDateString()}`,
				content: delta,
				workspaceId: workspaceId as Id<"workspaces">,
				channelId: channelId as Id<"channels">,
				icon: "✨",
				tags: ["AI", "Meeting"],
			});
			toast.success("Notes saved to your workspace library!");
		} catch (e) {
			toast.error("Failed to save to library");
		} finally {
			setIsSavingNote(false);
		}
	};

	const handleInsertToNote = () => {
		if (!meetingNotes) return;

		let content = "";
		if (meetingNotes.summary) {
			content += `## Executive Summary\n\n${meetingNotes.summary}\n\n`;
		}
		if (meetingNotes.decisions && meetingNotes.decisions.length > 0) {
			content += `## Key Decisions\n\n`;
			meetingNotes.decisions.forEach((d: string) => {
				content += `- ${d}\n`;
			});
			content += `\n`;
		}
		if (meetingNotes.actionItems && meetingNotes.actionItems.length > 0) {
			content += `## Action Items\n\n`;
			meetingNotes.actionItems.forEach((a: string) => {
				content += `- [ ] ${a}\n`;
			});
			content += `\n`;
		}

		window.dispatchEvent(
			new CustomEvent("proddy:insert-ai-notes", {
				detail: { content },
			})
		);
	};

	return (
		<div className="w-[400px] bg-[#1A1D21] border-l border-[#2B2D31] flex flex-col h-full text-white shadow-2xl z-[100] animate-in slide-in-from-right duration-300">
			{/* Header */}
			<div className="flex items-center justify-between p-4 border-b border-[#2B2D31]">
				<div className="flex items-center gap-2">
					<Brain className="w-5 h-5 text-indigo-400" />
					<h2 className="font-semibold text-lg text-gray-100">
						AI Meeting Notes
					</h2>
				</div>
				<Button
					className="text-gray-400 hover:text-white"
					onClick={onClose}
					size="icon"
					variant="ghost"
				>
					<X className="w-4 h-4" />
				</Button>
			</div>

			{/* Status / Trigger */}
			<div className="p-4 border-b border-[#2B2D31] bg-[#1E2125]">
				<div className="flex flex-col gap-3">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<div
								className={`w-2 h-2 rounded-full ${isListening ? "bg-red-500 animate-pulse" : "bg-gray-500"}`}
							/>
							<span className="text-xs text-gray-400">
								{isListening ? "Listening..." : "Microphone muted"}
							</span>
						</div>
						<div className="flex gap-2">
							{meetingNotes?.status === "completed" && (
								<Button
									className="bg-green-600 hover:bg-green-700 text-white border-0 text-xs px-3 h-8"
									onClick={handleInsertToNote}
									size="sm"
									variant="secondary"
								>
									Insert into Note
								</Button>
							)}
							<Button
								className="bg-indigo-600 hover:bg-indigo-700 text-white border-0 text-xs px-3 h-8"
								disabled={
									!meetingNotes?.transcript ||
									meetingNotes.status === "generating"
								}
								onClick={handleGenerate}
								size="sm"
								variant="secondary"
							>
								{meetingNotes?.status === "generating" ? (
									<Loader2 className="w-3 h-3 animate-spin mr-2" />
								) : null}
								{meetingNotes?.status === "completed"
									? "Regenerate"
									: "Generate AI Notes"}
							</Button>
						</div>
					</div>
					
					{meetingNotes?.summary && (
						<Button
							className="w-full bg-emerald-600 hover:bg-emerald-700 text-white border-0 text-xs h-8 gap-2"
							disabled={isSavingNote}
							onClick={handleSaveToLibrary}
							size="sm"
						>
							{isSavingNote ? (
								<Loader2 className="w-3 h-3 animate-spin" />
							) : (
								<Sparkles className="w-3.5 h-3.5" />
							)}
							Save to Workspace Note Library
						</Button>
					)}
				</div>
			</div>

			{/* Tabs */}
			<Tabs
				className="flex-1 flex flex-col min-h-0"
				onValueChange={setActiveTab}
				value={activeTab}
			>
				<div className="px-4 pt-4 border-b border-[#2B2D31]">
					<TabsList className="bg-[#2B2D31] w-full p-1 h-9 rounded-md grid grid-cols-3">
						<TabsTrigger
							className="text-xs data-[state=active]:bg-[#1A1D21] data-[state=active]:text-white text-gray-400"
							value="transcript"
						>
							Transcript
						</TabsTrigger>
						<TabsTrigger
							className="text-xs data-[state=active]:bg-[#1A1D21] data-[state=active]:text-white text-gray-400"
							value="summary"
						>
							Summary
						</TabsTrigger>
						<TabsTrigger
							className="text-xs data-[state=active]:bg-[#1A1D21] data-[state=active]:text-white text-gray-400"
							value="actionItems"
						>
							Action Items
						</TabsTrigger>
					</TabsList>
				</div>

				{/* Transcript Content */}
				<TabsContent
					className="flex-1 p-0 m-0 overflow-hidden"
					value="transcript"
				>
					<ScrollArea className="h-full p-4">
						{meetingNotes?.transcript ? (
							<div className="space-y-4">
								<p className="text-sm text-gray-300 leading-relaxed font-mono">
									{meetingNotes.transcript}
								</p>
							</div>
						) : (
							<div className="flex flex-col items-center justify-center h-full text-center p-6 text-gray-500">
								<FileText className="w-8 h-8 mb-3 opacity-20" />
								<p className="text-sm">No transcript yet.</p>
								<p className="text-xs mt-1">
									Unmute your microphone to start capturing the conversation.
								</p>
							</div>
						)}
					</ScrollArea>
				</TabsContent>

				{/* Summary Content */}
				<TabsContent className="flex-1 p-0 m-0 overflow-hidden" value="summary">
					<ScrollArea className="h-full p-4">
						{meetingNotes?.status === "generating" ? (
							<div className="flex flex-col items-center justify-center h-full py-12 text-gray-400">
								<Loader2 className="w-8 h-8 animate-spin mb-4 text-indigo-500" />
								<p className="text-sm">Analyzing conversation...</p>
							</div>
						) : meetingNotes?.summary ? (
							<div className="space-y-6">
								<div>
									<h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
										<FileText className="w-4 h-4 text-blue-400" /> Executive
										Summary
									</h3>
									<p className="text-sm text-gray-300 leading-relaxed bg-[#2B2D31] p-3 rounded-md">
										{meetingNotes.summary}
									</p>
								</div>

								{meetingNotes.decisions &&
									meetingNotes.decisions.length > 0 && (
										<div>
											<h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
												<Target className="w-4 h-4 text-green-400" /> Key
												Decisions
											</h3>
											<ul className="space-y-2">
												{meetingNotes.decisions.map((decision, i) => (
													<li
														className="text-sm text-gray-300 flex items-start gap-2 bg-[#2B2D31] p-2.5 rounded-md"
														key={i}
													>
														<div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 shrink-0" />
														<span>{decision}</span>
													</li>
												))}
											</ul>
										</div>
									)}
							</div>
						) : (
							<div className="flex flex-col items-center justify-center h-full text-center p-6 text-gray-500">
								<Brain className="w-8 h-8 mb-3 opacity-20" />
								<p className="text-sm">Summary not generated yet.</p>
								<p className="text-xs mt-1">
									Click "Generate AI Notes" to analyze the transcript.
								</p>
							</div>
						)}
					</ScrollArea>
				</TabsContent>

				{/* Action Items Content */}
				<TabsContent
					className="flex-1 p-0 m-0 overflow-hidden"
					value="actionItems"
				>
					<ScrollArea className="h-full p-4">
						{meetingNotes?.status === "generating" ? (
							<div className="flex flex-col items-center justify-center h-full py-12 text-gray-400">
								<Loader2 className="w-8 h-8 animate-spin mb-4 text-indigo-500" />
								<p className="text-sm">Extracting action items...</p>
							</div>
						) : meetingNotes?.actionItems &&
							meetingNotes.actionItems.length > 0 ? (
							<div className="space-y-3">
								<div className="flex items-center justify-between mb-3">
									<h3 className="text-sm font-semibold text-white flex items-center gap-2">
										<CheckSquare className="w-4 h-4 text-orange-400" /> Action
										Items
									</h3>
									<Button
										className="h-7 text-[10px] font-bold gap-1 bg-emerald-600 hover:bg-emerald-700 text-white border-0"
										disabled={isPushingTasks || !generations || generations.length === 0}
										onClick={async () => {
											try {
												setIsPushingTasks(true);
												const latestGen = generations![generations!.length - 1];
												await createBulkTasks({
													workspaceId: workspaceId as Id<"workspaces">,
													tasks: latestGen.actionItems.map((t: any) => ({
														title: t.title,
														assigneeUserId: t.assigneeUserId || undefined,
														priority: t.priority || "medium",
													})),
												});
												toast.success(`Successfully pushed ${latestGen.actionItems.length} tasks to dashboard!`);
											} catch (e) {
												toast.error("Failed to push tasks");
											} finally {
												setIsPushingTasks(false);
											}
										}}
										size="sm"
									>
										{isPushingTasks ? (
											<Loader2 className="w-3 h-3 animate-spin" />
										) : (
											<Target className="w-3 h-3" />
										)}
										Push to Tasks
									</Button>
								</div>
								{meetingNotes.actionItems.map((task, i) => (
									<div
										className="flex items-start gap-3 bg-[#2B2D31] p-3 rounded-md border border-[#3A3D42]"
										key={i}
									>
										<div className="mt-0.5">
											<div className="w-4 h-4 rounded border border-gray-500" />
										</div>
										<p className="text-sm text-gray-200">{task}</p>
									</div>
								))}
							</div>
						) : (
							<div className="flex flex-col items-center justify-center h-full text-center p-6 text-gray-500">
								<CheckSquare className="w-8 h-8 mb-3 opacity-20" />
								<p className="text-sm">No action items found.</p>
							</div>
						)}
					</ScrollArea>
				</TabsContent>
			</Tabs>
		</div>
	);
};
