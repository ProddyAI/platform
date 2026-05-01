import { useState } from "react";
import { Loader2, X, Brain, CheckSquare, FileText, Target } from "lucide-react";
import { useMeetingTranscription } from "../hooks/useMeetingTranscription";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
	isAudioMuted
}: MeetingNotesPanelProps) => {
	const { meetingNotes, isListening, triggerGenerateInsights } = useMeetingTranscription(
		roomId,
		workspaceId,
		channelId,
		!isAudioMuted // Record only when unmuted
	);
	
	const [activeTab, setActiveTab] = useState("transcript");

	const handleGenerate = () => {
		triggerGenerateInsights();
		setActiveTab("summary");
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
		
		window.dispatchEvent(new CustomEvent('proddy:insert-ai-notes', { 
			detail: { content } 
		}));
	};

	return (
		<div className="w-[400px] bg-[#1A1D21] border-l border-[#2B2D31] flex flex-col h-full text-white shadow-2xl z-[100] animate-in slide-in-from-right duration-300">
			{/* Header */}
			<div className="flex items-center justify-between p-4 border-b border-[#2B2D31]">
				<div className="flex items-center gap-2">
					<Brain className="w-5 h-5 text-indigo-400" />
					<h2 className="font-semibold text-lg text-gray-100">AI Meeting Notes</h2>
				</div>
				<Button variant="ghost" size="icon" onClick={onClose} className="text-gray-400 hover:text-white">
					<X className="w-4 h-4" />
				</Button>
			</div>

			{/* Status / Trigger */}
			<div className="p-4 border-b border-[#2B2D31] bg-[#1E2125]">
				<div className="flex items-center justify-between mb-2">
					<div className="flex items-center gap-2">
						<div className={`w-2 h-2 rounded-full ${isListening ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`} />
						<span className="text-xs text-gray-400">
							{isListening ? "Listening..." : "Microphone muted"}
						</span>
					</div>
					<div className="flex gap-2">
						{meetingNotes?.status === 'completed' && (
							<Button 
								onClick={handleInsertToNote} 
								size="sm"
								variant="secondary"
								className="bg-green-600 hover:bg-green-700 text-white border-0 text-xs px-3 h-8"
							>
								Insert into Note
							</Button>
						)}
						<Button 
							onClick={handleGenerate} 
							size="sm"
							variant="secondary"
							disabled={!meetingNotes?.transcript || meetingNotes.status === 'generating'}
							className="bg-indigo-600 hover:bg-indigo-700 text-white border-0 text-xs px-3 h-8"
						>
							{meetingNotes?.status === 'generating' ? (
								<Loader2 className="w-3 h-3 animate-spin mr-2" />
							) : null}
							{meetingNotes?.status === 'completed' ? 'Regenerate' : 'Generate AI Notes'}
						</Button>
					</div>
				</div>
			</div>

			{/* Tabs */}
			<Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
				<div className="px-4 pt-4 border-b border-[#2B2D31]">
					<TabsList className="bg-[#2B2D31] w-full p-1 h-9 rounded-md grid grid-cols-3">
						<TabsTrigger value="transcript" className="text-xs data-[state=active]:bg-[#1A1D21] data-[state=active]:text-white text-gray-400">Transcript</TabsTrigger>
						<TabsTrigger value="summary" className="text-xs data-[state=active]:bg-[#1A1D21] data-[state=active]:text-white text-gray-400">Summary</TabsTrigger>
						<TabsTrigger value="actionItems" className="text-xs data-[state=active]:bg-[#1A1D21] data-[state=active]:text-white text-gray-400">Action Items</TabsTrigger>
					</TabsList>
				</div>

				{/* Transcript Content */}
				<TabsContent value="transcript" className="flex-1 p-0 m-0 overflow-hidden">
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
								<p className="text-xs mt-1">Unmute your microphone to start capturing the conversation.</p>
							</div>
						)}
					</ScrollArea>
				</TabsContent>

				{/* Summary Content */}
				<TabsContent value="summary" className="flex-1 p-0 m-0 overflow-hidden">
					<ScrollArea className="h-full p-4">
						{meetingNotes?.status === 'generating' ? (
							<div className="flex flex-col items-center justify-center h-full py-12 text-gray-400">
								<Loader2 className="w-8 h-8 animate-spin mb-4 text-indigo-500" />
								<p className="text-sm">Analyzing conversation...</p>
							</div>
						) : meetingNotes?.summary ? (
							<div className="space-y-6">
								<div>
									<h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
										<FileText className="w-4 h-4 text-blue-400" /> Executive Summary
									</h3>
									<p className="text-sm text-gray-300 leading-relaxed bg-[#2B2D31] p-3 rounded-md">
										{meetingNotes.summary}
									</p>
								</div>
								
								{meetingNotes.decisions && meetingNotes.decisions.length > 0 && (
									<div>
										<h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
											<Target className="w-4 h-4 text-green-400" /> Key Decisions
										</h3>
										<ul className="space-y-2">
											{meetingNotes.decisions.map((decision, i) => (
												<li key={i} className="text-sm text-gray-300 flex items-start gap-2 bg-[#2B2D31] p-2.5 rounded-md">
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
								<p className="text-xs mt-1">Click "Generate AI Notes" to analyze the transcript.</p>
							</div>
						)}
					</ScrollArea>
				</TabsContent>

				{/* Action Items Content */}
				<TabsContent value="actionItems" className="flex-1 p-0 m-0 overflow-hidden">
					<ScrollArea className="h-full p-4">
						{meetingNotes?.status === 'generating' ? (
							<div className="flex flex-col items-center justify-center h-full py-12 text-gray-400">
								<Loader2 className="w-8 h-8 animate-spin mb-4 text-indigo-500" />
								<p className="text-sm">Extracting action items...</p>
							</div>
						) : meetingNotes?.actionItems && meetingNotes.actionItems.length > 0 ? (
							<div className="space-y-3">
								<h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
									<CheckSquare className="w-4 h-4 text-orange-400" /> Action Items
								</h3>
								{meetingNotes.actionItems.map((task, i) => (
									<div key={i} className="flex items-start gap-3 bg-[#2B2D31] p-3 rounded-md border border-[#3A3D42]">
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
