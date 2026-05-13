"use client";

import { useCallStateHooks } from "@stream-io/video-react-sdk";
import { useAction, useMutation, useQuery } from "convex/react";
import {
	ArrowUpRight,
	Brain,
	CheckSquare,
	ChevronDown,
	Clock,
	Copy,
	Download,
	FileDown,
	FileText,
	Loader2,
	MicOff,
	Printer,
	Sparkles,
	Target,
	Users,
	X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { useBroadcastEvent, useEventListener } from "@/../liveblocks.config";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VoiceWaveform } from "@/features/audio/components/voice-waveform";
import { exportToPDF, exportToWord } from "@/lib/export-utils";

// ─── RECORDING BUTTON ───────────────────────────────────────────────────────

interface RecordingButtonProps {
	roomId: string;
	workspaceId: string;
	userName?: string;
	onTranscriptUpdate: (transcript: string) => void;
	onRecordingChange: (recording: boolean) => void;
}

export const MeetingRecordButton = ({
	roomId,
	workspaceId,
	userName,
	onTranscriptUpdate,
	onRecordingChange,
}: RecordingButtonProps) => {
	const [isRecording, setIsRecording] = useState(false);
	const recognitionRef = useRef<any | null>(null);
	const transcriptRef = useRef("");
	const saveTranscript = useMutation(api.meetingNotes.saveTranscript);
	const saveBufferRef = useRef("");
	const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
	const broadcast = useBroadcastEvent();

	const flushTranscript = useCallback(async () => {
		if (saveBufferRef.current.trim().length > 0) {
			try {
				await saveTranscript({
					roomId,
					workspaceId: workspaceId as Id<"workspaces">,
					transcriptChunk: saveBufferRef.current.trim(),
				});
				saveBufferRef.current = "";
			} catch (e) {
				console.error("Failed to save transcript chunk:", e);
			}
		}
	}, [roomId, workspaceId, saveTranscript]);

	const startRecording = useCallback(async () => {
		if (typeof window === "undefined") return;
		const SpeechRecognition =
			(window as any).SpeechRecognition ||
			(window as any).webkitSpeechRecognition;
		if (!SpeechRecognition) {
			toast.error(
				"Speech recognition not supported in this browser. Use Chrome."
			);
			return;
		}

		const recognition = new SpeechRecognition();
		recognition.continuous = true;
		recognition.interimResults = true;
		recognition.lang = "en-US";

		recognition.onresult = (event: any) => {
			for (let i = event.resultIndex; i < event.results.length; ++i) {
				if (event.results[i].isFinal) {
					const rawText = event.results[i][0].transcript.trim();
					if (rawText) {
						const text = `${userName || "You"}: ${rawText}`;
						transcriptRef.current += (transcriptRef.current ? "\n" : "") + text;
						saveBufferRef.current += (saveBufferRef.current ? "\n" : "") + text;
						onTranscriptUpdate(transcriptRef.current);

						// Broadcast transcript chunk to other participants
						broadcast({
							type: "TRANSCRIPT_UPDATE",
							chunk: text,
						});
					}
				}
			}
		};

		recognition.onerror = (event: any) => {
			if (event.error === "not-allowed") {
				toast.error("Microphone permission denied");
				setIsRecording(false);
				onRecordingChange(false);
				// Stop the recognition and clear the onend handler to prevent loop
				recognition.onend = null;
				recognition.stop();
				recognitionRef.current = null;
			}
		};

		recognition.onend = () => {
			if (recognitionRef.current) {
				try {
					recognitionRef.current.start();
				} catch (_e) {}
			}
		};

		recognitionRef.current = recognition;
		recognition.start();
		setIsRecording(true);
		onRecordingChange(true);
		toast.success("Recording started — live captions active");

		// Periodic save every 10 seconds
		saveTimerRef.current = setInterval(() => {
			flushTranscript();
		}, 10000);
	}, [onTranscriptUpdate, onRecordingChange, flushTranscript, userName]);

	const stopRecording = useCallback(async () => {
		if (recognitionRef.current) {
			recognitionRef.current.onend = null;
			recognitionRef.current.stop();
			recognitionRef.current = null;
		}
		if (saveTimerRef.current) {
			clearInterval(saveTimerRef.current);
			saveTimerRef.current = null;
		}
		await flushTranscript();
		setIsRecording(false);
		onRecordingChange(false);
		toast.success("Recording stopped — transcript saved");
	}, [flushTranscript, onRecordingChange]);

	useEffect(() => {
		const handleBeforeUnload = () => {
			if (recognitionRef.current) {
				recognitionRef.current.onend = null;
				recognitionRef.current.stop();
				recognitionRef.current = null;
			}
			if (saveTimerRef.current) clearInterval(saveTimerRef.current);
			
			// Attempt to flush the last chunk of transcript
			if (saveBufferRef.current.trim().length > 0) {
				// Use beacon for best-effort delivery of remaining transcript
				// Note: In a real app, you'd have an endpoint designed for this
				const blob = new Blob([JSON.stringify({
					roomId,
					workspaceId,
					transcriptChunk: saveBufferRef.current.trim()
				})], { type: 'application/json' });
				navigator.sendBeacon?.("/api/transcript-flush", blob);
			}
		};

		window.addEventListener("beforeunload", handleBeforeUnload);

		return () => {
			window.removeEventListener("beforeunload", handleBeforeUnload);
			if (recognitionRef.current) {
				recognitionRef.current.onend = null;
				recognitionRef.current.stop();
				recognitionRef.current = null;
			}
			if (saveTimerRef.current) clearInterval(saveTimerRef.current);
		};
	}, []);

	return (
		<div className="flex items-center gap-3">
			{isRecording && <VoiceWaveform isRecording={isRecording} />}
			<button
				className={`flex items-center gap-2 px-4 h-11 rounded-full transition-all text-sm font-medium ${isRecording ? "bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20" : "bg-[#3c4043] hover:bg-[#4d5154] text-white"}`}
				onClick={isRecording ? stopRecording : startRecording}
				title={isRecording ? "Stop Recording" : "Start Recording"}
			>
				<div
					className={`rounded-full ${isRecording ? "w-2.5 h-2.5 bg-white animate-pulse" : "w-3 h-3 bg-red-500"}`}
				/>
				{isRecording ? "Stop" : "Record"}
			</button>
		</div>
	);
};

// ─── MEETING REACTIONS ──────────────────────────────────────────────────────

export const MeetingReactions = () => {
	const [showPicker, setShowPicker] = useState(false);
	const [floatingReactions, setFloatingReactions] = useState<
		{ id: number; emoji: string; x: number }[]
	>([]);
	const MAX_CONCURRENT = 10;
	const nextId = useRef(0);
	const lastReactionTime = useRef(0);
	const broadcast = useBroadcastEvent();

	const handleAddReaction = useCallback(
		(emoji: string, isExternal = false) => {
			const id = nextId.current++;
			const x = 20 + Math.random() * 60;
			setFloatingReactions((prev) => [...prev, { id, emoji, x }]);

			if (!isExternal) {
				broadcast({ type: "REACTION", emoji });
			}

			// Remove after animation
			setTimeout(() => {
				setFloatingReactions((prev) => prev.filter((r) => r.id !== id));
			}, 2500);
		},
		[broadcast]
	);

	useEventListener(({ event }) => {
		if (event.type === "REACTION") {
			handleAddReaction(event.emoji, true);
		}
	});

	const emojis = ["👍", "❤️", "😂", "🎉", "👏", "🔥", "✨", "🤔", "😍", "💯"];

	const sendReaction = (emoji: string) => {
		const now = Date.now();
		if (now - lastReactionTime.current < 300) return;
		lastReactionTime.current = now;

		if (floatingReactions.length >= MAX_CONCURRENT) return;

		handleAddReaction(emoji);
		setShowPicker(false);
	};

	return (
		<>
			{/* Floating reactions overlay */}
			{floatingReactions.map((r) => (
				<div
					className="fixed bottom-28 z-[100] pointer-events-none"
					key={r.id}
					style={{
						left: `${r.x}%`,
						animation: "floatUp 2.5s ease-out forwards",
					}}
				>
					<span className="text-4xl drop-shadow-lg">{r.emoji}</span>
				</div>
			))}

			{/* Reaction picker popover */}
			<div className="relative">
				{showPicker && (
					<div className="absolute bottom-14 left-1/2 -translate-x-1/2 bg-[#2d2e31] rounded-2xl px-3 py-2 flex gap-1.5 shadow-2xl border border-white/10 z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
						{emojis.map((emoji) => (
							<button
								className="text-2xl hover:scale-125 active:scale-95 transition-transform p-1 rounded-lg hover:bg-white/10"
								key={emoji}
								onClick={() => sendReaction(emoji)}
								title={emoji}
							>
								{emoji}
							</button>
						))}
					</div>
				)}
				<button
					className={`flex items-center gap-2 px-4 h-11 rounded-full transition-all text-sm font-medium ${showPicker ? "bg-[#c2e7ff] text-[#001d35]" : "bg-[#3c4043] hover:bg-[#4d5154] text-white"}`}
					onClick={() => setShowPicker(!showPicker)}
					title="Reactions"
				>
					😊
				</button>
			</div>

			<style global jsx>{`
				@keyframes floatUp {
					0% { opacity: 1; transform: translateY(0) scale(1); }
					50% { opacity: 1; transform: translateY(-120px) scale(1.2); }
					100% { opacity: 0; transform: translateY(-250px) scale(0.8); }
				}
			`}</style>
		</>
	);
};

// ─── LIVE CAPTIONS OVERLAY ──────────────────────────────────────────────────

interface CaptionsOverlayProps {
	isRecording: boolean;
	liveTranscript: string;
	onExternalTranscript?: (chunk: string) => void;
}

export const CaptionsOverlay = ({
	isRecording,
	liveTranscript,
	onExternalTranscript,
}: CaptionsOverlayProps) => {
	const [displayCaption, setDisplayCaption] = useState("");

	useEventListener(({ event }) => {
		if (event.type === "TRANSCRIPT_UPDATE") {
			setDisplayCaption(event.chunk);
			onExternalTranscript?.(event.chunk);
		}
	});

	useEffect(() => {
		if (!isRecording || !liveTranscript) {
			setDisplayCaption("");
			return;
		}
		// Show the last line of the transcript as the current caption
		const lines = liveTranscript.split("\n").filter((l) => l.trim());
		const lastLine = lines[lines.length - 1] || "";
		if (lastLine) {
			setDisplayCaption(lastLine);
		}
	}, [isRecording, liveTranscript]);

	// Auto-hide caption after 5 seconds of no change
	useEffect(() => {
		if (!displayCaption) return;
		const timer = setTimeout(() => setDisplayCaption(""), 5000);
		return () => clearTimeout(timer);
	}, [displayCaption]);

	if (!isRecording || !displayCaption) return null;

	// Parse "Speaker: text" format
	const colonIdx = displayCaption.indexOf(": ");
	const speaker = colonIdx > -1 ? displayCaption.slice(0, colonIdx) : null;
	const captionText =
		colonIdx > -1 ? displayCaption.slice(colonIdx + 2) : displayCaption;

	return (
		<div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-[85%] w-auto">
			<div className="bg-[#0a0a12]/80 backdrop-blur-3xl border border-white/10 text-white px-6 py-4 rounded-2xl text-base leading-relaxed shadow-2xl animate-in fade-in zoom-in duration-500 overflow-hidden group">
				<div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-transparent to-purple-500/10 opacity-50" />
				<div className="relative flex flex-col gap-1">
					{speaker && (
						<span className="text-indigo-400 font-bold text-xs uppercase tracking-widest mb-0.5 opacity-80">
							{speaker}
						</span>
					)}
					<div className="flex flex-wrap gap-x-1.5 items-center">
						{captionText.split(" ").map((word, i) => (
							<span
								className="animate-in fade-in slide-in-from-bottom-1 duration-300"
								key={i}
								style={{ animationDelay: `${i * 100}ms` }}
							>
								{word}
							</span>
						))}
					</div>
				</div>
			</div>
		</div>
	);
};

// ─── PARTICIPANT LIST ───────────────────────────────────────────────────────

export const CustomParticipantList = () => {
	const { useParticipants } = useCallStateHooks();
	const participants = useParticipants();

	return (
		<div className="flex flex-col">
			<p className="text-[13px] font-medium text-gray-500 mb-3 px-6 mt-2">
				In the meeting
			</p>
			{participants.map((p) => {
				const colors = [
					"bg-[#0b57d0]",
					"bg-emerald-600",
					"bg-purple-600",
					"bg-orange-600",
					"bg-pink-600",
				];
				const colorClass =
					colors[p.sessionId.charCodeAt(0) % colors.length] || colors[0];
				return (
					<div
						className="flex items-center gap-3 px-6 py-2.5 hover:bg-white/5 cursor-pointer"
						key={p.sessionId}
					>
						<div
							className={`w-9 h-9 rounded-full ${colorClass} text-white flex items-center justify-center text-sm font-medium shrink-0`}
						>
							{p.name?.[0]?.toUpperCase() || "A"}
						</div>
						<div className="flex-1 flex flex-col min-w-0">
							<span className="text-[14px] text-white font-medium truncate">
								{p.name || "Anonymous"} {p.isLocalParticipant ? "(You)" : ""}
							</span>
							<span className="text-[12px] text-gray-400">
								{p.isLocalParticipant ? "Meeting host" : "Contributor"}
							</span>
						</div>
						{!p.audioStream && (
							<div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center">
								<MicOff className="w-3.5 h-3.5 text-red-500" />
							</div>
						)}
					</div>
				);
			})}
		</div>
	);
};

// ─── AI NOTES SIDEBAR ───────────────────────────────────────────────────────

interface NotesSidebarProps {
	roomId: string;
	workspaceId: string;
	liveTranscript: string;
	isRecording: boolean;
	onClose: () => void;
}

export const NotesSidebar = ({
	roomId,
	workspaceId,
	liveTranscript,
	isRecording,
	onClose,
}: NotesSidebarProps) => {
	const [activeTab, setActiveTab] = useState("transcript");
	const [selectedGenIdx, setSelectedGenIdx] = useState(-1); // -1 = latest
	const [isGenerating, setIsGenerating] = useState(false);
	const [showHistoryDropdown, setShowHistoryDropdown] = useState(false);
	const [copied, setCopied] = useState(false);
	const scrollRef = useRef<HTMLDivElement>(null);

	const savedNotes = useQuery(api.meetingNotes.getByRoom, {
		roomId,
		workspaceId: workspaceId as Id<"workspaces">,
	});
	const generations = useQuery(api.meetingNotes.getGenerations, { roomId });
	const generateAI = useAction(api.meetingNotes.generateAIInsights);
	const finalizeTranscript = useMutation(api.meetingNotes.finalizeTranscript);
	const saveTranscript = useMutation(api.meetingNotes.saveTranscript);

	// Fetch workspace members so AI can map names to user IDs
	const members = useQuery(
		api.members.get,
		workspaceId ? { workspaceId: workspaceId as Id<"workspaces"> } : "skip"
	);
	const membersContext =
		members && members.length > 0
			? members
					.map(
						(m) =>
							`- Name: ${m.user.name || m.user.email || "Unknown"}, userId: ${m.user._id}`
					)
					.join("\n")
			: "";

	const currentGen =
		selectedGenIdx === -1
			? generations && generations.length > 0
				? generations[generations.length - 1]
				: null
			: generations
				? generations[selectedGenIdx]
				: null;

	const transcript = isRecording
		? liveTranscript || savedNotes?.transcript || ""
		: savedNotes?.transcript || liveTranscript || "";

	useEffect(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, []);

	const handleCopyTranscript = () => {
		if (!transcript) return;
		navigator.clipboard.writeText(transcript);
		setCopied(true);
		toast.success("Transcript copied to clipboard!");
		setTimeout(() => setCopied(false), 2000);
	};

	const handleGenerate = async () => {
		const currentTranscript = transcript || liveTranscript;
		if (!currentTranscript || currentTranscript.trim().length < 10) {
			toast.error(
				"Transcript too short to generate notes. Record more of the meeting."
			);
			return;
		}

		setIsGenerating(true);
		try {
			// If no saved note yet, create one from the live transcript
			let noteId = savedNotes?._id;
			if (!noteId) {
				noteId = await saveTranscript({
					roomId,
					workspaceId: workspaceId as Id<"workspaces">,
					transcriptChunk: currentTranscript,
				});
			}

			await finalizeTranscript({ roomId });
			await generateAI({
				noteId: noteId!,
				transcript: currentTranscript,
				membersContext: membersContext || undefined,
			});
			toast.success("AI notes generated!");
			setSelectedGenIdx(-1);
			setActiveTab("summary");
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Failed to generate notes");
		} finally {
			setIsGenerating(false);
		}
	};

	const handleExport = (format: "pdf" | "word") => {
		if (!currentGen) {
			toast.error("No notes to export yet.");
			return;
		}

		const data = {
			title: `Meeting Notes #${currentGen.generationNumber}`,
			summary: currentGen.summary,
			actionItems: currentGen.actionItems.map(
				(a: any) =>
					`${a.title}${a.assignee ? ` (Assigned to: ${a.assignee})` : ""}`
			),
			decisions: currentGen.decisions,
			date: new Date(currentGen.createdAt).toLocaleString(),
		};

		if (format === "pdf") {
			exportToPDF(data);
		} else {
			exportToWord(data);
		}
	};

	return (
		<>
			<div className="flex items-center justify-between p-5 pb-3 border-b border-white/10">
				<div className="flex items-center gap-2.5">
					<Sparkles className="w-5 h-5 text-indigo-400" />
					<h2 className="text-base font-semibold text-white">AI Notemaker</h2>
				</div>
				<Button
					className="text-gray-400 hover:text-white hover:bg-white/10 rounded-full h-9 w-9"
					onClick={onClose}
					size="icon"
					variant="ghost"
				>
					<X className="w-4 h-4" />
				</Button>
			</div>

			{/* Generate & Export Buttons */}
			<div className="px-5 py-3 border-b border-white/10 flex flex-col gap-2">
				<div className="flex items-center gap-2 w-full">
					<Button
						className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white rounded-full h-9 text-xs font-medium gap-2 shadow-lg shadow-indigo-500/20"
						disabled={
							isGenerating ||
							(!transcript && !liveTranscript) ||
							savedNotes?.status === "generating"
						}
						onClick={handleGenerate}
					>
						{isGenerating || savedNotes?.status === "generating" ? (
							<>
								<Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating...
							</>
						) : (
							<>
								<Brain className="w-3.5 h-3.5" /> Generate AI Notes
							</>
						)}
					</Button>

					{generations && generations.length > 0 && (
						<div className="relative">
							<Button
								className="rounded-full h-9 text-xs gap-1 border-white/10 text-gray-300 hover:bg-white/10"
								onClick={() => setShowHistoryDropdown(!showHistoryDropdown)}
								size="sm"
								variant="outline"
							>
								<Clock className="w-3.5 h-3.5" />
								<ChevronDown className="w-3 h-3" />
							</Button>
							{showHistoryDropdown && (
								<div className="absolute right-0 top-11 bg-[#1a1a2e] border border-white/10 rounded-xl shadow-xl z-50 w-52 py-1 animate-in fade-in slide-in-from-top-2">
									<p className="px-3 py-2 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
										Note History
									</p>
									{generations.map((gen, idx) => (
										<button
											className={`w-full text-left px-3 py-2 text-xs hover:bg-white/5 flex items-center justify-between ${selectedGenIdx === idx ? "bg-indigo-500/10 text-indigo-400" : "text-gray-300"}`}
											key={gen._id}
											onClick={() => {
												setSelectedGenIdx(idx);
												setShowHistoryDropdown(false);
												setActiveTab("summary");
											}}
										>
											<span>Generation #{gen.generationNumber}</span>
											<span className="text-[10px] text-gray-500">
												{new Date(gen.createdAt).toLocaleTimeString([], {
													hour: "2-digit",
													minute: "2-digit",
												})}
											</span>
										</button>
									))}
								</div>
							)}
						</div>
					)}
				</div>

				{currentGen && (
					<div className="flex items-center gap-2">
						<Button
							className="flex-1 h-9 text-[11px] font-bold gap-2 border-indigo-500/20 bg-indigo-500/5 text-indigo-400 hover:bg-indigo-500 hover:text-white rounded-xl transition-all shadow-sm"
							onClick={() => handleExport("pdf")}
							variant="outline"
						>
							<FileDown className="w-3.5 h-3.5" /> Export PDF
						</Button>
						<Button
							className="flex-1 h-9 text-[11px] font-bold gap-2 border-emerald-500/20 bg-emerald-500/5 text-emerald-500 hover:bg-emerald-500 hover:text-white rounded-xl transition-all shadow-sm"
							onClick={() => handleExport("word")}
							variant="outline"
						>
							<Download className="w-3.5 h-3.5" /> Export Word
						</Button>
					</div>
				)}
			</div>

			{/* Recording indicator */}
			{isRecording && (
				<div className="px-5 py-2 bg-red-500/10 border-b border-red-500/20 flex items-center gap-2">
					<span className="relative flex h-2.5 w-2.5">
						<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
						<span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
					</span>
					<span className="text-xs font-medium text-red-400">
						Recording & transcribing...
					</span>
				</div>
			)}

			{/* Tabs */}
			<div className="flex-1 overflow-hidden flex flex-col min-h-0">
				<Tabs
					className="flex-1 flex flex-col min-h-0"
					onValueChange={setActiveTab}
					value={activeTab}
				>
					<div className="px-5 pt-3 pb-1">
						<TabsList className="bg-white/5 w-full p-1 h-10 rounded-xl grid grid-cols-4 border border-white/5">
							<TabsTrigger
								className="text-[11px] data-[state=active]:bg-white/10 data-[state=active]:text-indigo-400 text-gray-500 rounded-lg font-medium"
								value="transcript"
							>
								Transcript
							</TabsTrigger>
							<TabsTrigger
								className="text-[11px] data-[state=active]:bg-white/10 data-[state=active]:text-indigo-400 text-gray-500 rounded-lg font-medium"
								value="summary"
							>
								Summary
							</TabsTrigger>
							<TabsTrigger
								className="text-[11px] data-[state=active]:bg-white/10 data-[state=active]:text-indigo-400 text-gray-500 rounded-lg font-medium"
								value="tasks"
							>
								Tasks
							</TabsTrigger>
							<TabsTrigger
								className="text-[11px] data-[state=active]:bg-white/10 data-[state=active]:text-indigo-400 text-gray-500 rounded-lg font-medium"
								value="decisions"
							>
								Decisions
							</TabsTrigger>
						</TabsList>
					</div>

					<ScrollArea className="flex-1 px-5 pb-5 mt-2">
						{/* Transcript Tab */}
						<TabsContent className="m-0" value="transcript">
							{transcript ? (
								<div className="space-y-2">
									{/* Copy button */}
									<div className="flex justify-end">
										<button
											className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-indigo-400 transition-colors bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg"
											onClick={handleCopyTranscript}
										>
											{copied ? (
												<>
													<CheckSquare className="w-3 h-3" /> Copied!
												</>
											) : (
												<>
													<Copy className="w-3 h-3" /> Copy Transcript
												</>
											)}
										</button>
									</div>
									<div
										className="text-[13px] text-gray-300 leading-relaxed font-mono bg-white/5 p-4 rounded-xl border border-white/5 whitespace-pre-wrap max-h-[60vh] overflow-y-auto"
										ref={scrollRef}
									>
										{transcript}
									</div>
								</div>
							) : (
								<div className="flex flex-col items-center justify-center py-16 text-gray-500 text-center gap-3">
									<MicOff className="w-8 h-8 opacity-30" />
									<p className="text-sm">
										Press "Record" to start capturing the meeting transcript.
									</p>
								</div>
							)}
						</TabsContent>

						{/* Summary Tab */}
						<TabsContent className="m-0 space-y-4" value="summary">
							{currentGen ? (
								<div className="space-y-3">
									<div className="flex items-center gap-2 mb-1">
										<FileText className="w-4 h-4 text-indigo-400" />
										<h3 className="text-sm font-semibold text-white">
											Executive Summary
										</h3>
										<span className="text-[10px] bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full font-medium">
											Gen #{currentGen.generationNumber}
										</span>
									</div>
									<p className="text-sm text-gray-300 leading-relaxed bg-white/5 p-4 rounded-xl border border-white/5">
										{currentGen.summary}
									</p>
								</div>
							) : savedNotes?.summary ? (
								<div className="space-y-3">
									<h3 className="text-sm font-semibold text-white flex items-center gap-2">
										<FileText className="w-4 h-4 text-indigo-400" /> Executive
										Summary
									</h3>
									<p className="text-sm text-gray-300 leading-relaxed bg-white/5 p-4 rounded-xl border border-white/5">
										{savedNotes.summary}
									</p>
								</div>
							) : (
								<div className="flex flex-col items-center justify-center py-16 text-gray-500 text-center gap-3">
									<Brain className="w-8 h-8 opacity-30" />
									<p className="text-sm">
										Generate AI notes to see the summary.
									</p>
								</div>
							)}
						</TabsContent>

						{/* Tasks Tab */}
						<TabsContent className="m-0 space-y-3" value="tasks">
							{currentGen && currentGen.actionItems.length > 0 ? (
								<>
									<h3 className="text-sm font-semibold text-white flex items-center gap-2">
										<CheckSquare className="w-4 h-4 text-orange-400" /> Action
										Items
										<span className="text-[10px] bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full font-medium">
											{currentGen.actionItems.length}
										</span>
									</h3>
									{currentGen.actionItems.map((task, i) => (
										<div
											className="bg-white/5 p-3 rounded-xl border border-white/5 space-y-1.5"
											key={i}
										>
											<div className="flex items-start gap-2.5">
												<div className="mt-0.5 w-4 h-4 rounded border border-gray-600 flex-shrink-0" />
												<p className="text-[13px] text-gray-200 font-medium leading-relaxed">
													{task.title}
												</p>
											</div>
											<div className="ml-6 flex flex-wrap gap-1.5">
												{task.assignee && (
													<span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/20 text-indigo-400">
														@ {task.assignee}
													</span>
												)}
												{task.dueDate && (
													<span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/20 text-purple-400">
														Due: {task.dueDate}
													</span>
												)}
												{task.priority && (
													<span
														className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${task.priority === "high" ? "bg-red-500/20 text-red-400" : task.priority === "medium" ? "bg-yellow-500/20 text-yellow-400" : "bg-green-500/20 text-green-400"}`}
													>
														{task.priority}
													</span>
												)}
											</div>
										</div>
									))}
									{/* Admin Push Button */}
									<AdminPushButton
										actionItems={currentGen.actionItems}
										workspaceId={workspaceId}
									/>
								</>
							) : (
								<div className="flex flex-col items-center justify-center py-16 text-gray-500 text-center gap-3">
									<CheckSquare className="w-8 h-8 opacity-30" />
									<p className="text-sm">No action items yet.</p>
								</div>
							)}
						</TabsContent>

						{/* Decisions Tab */}
						<TabsContent className="m-0 space-y-3" value="decisions">
							{currentGen && currentGen.decisions.length > 0 ? (
								<>
									<h3 className="text-sm font-semibold text-white flex items-center gap-2">
										<Target className="w-4 h-4 text-emerald-400" /> Key
										Decisions
										<span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-medium">
											{currentGen.decisions.length}
										</span>
									</h3>
									{currentGen.decisions.map((decision, i) => (
										<div
											className="text-sm text-gray-300 flex items-start gap-3 bg-white/5 p-3 rounded-xl border border-white/5"
											key={i}
										>
											<div className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
											<span className="leading-relaxed">{decision}</span>
										</div>
									))}
								</>
							) : (
								<div className="flex flex-col items-center justify-center py-16 text-gray-500 text-center gap-3">
									<Target className="w-8 h-8 opacity-30" />
									<p className="text-sm">No decisions extracted yet.</p>
								</div>
							)}
						</TabsContent>
					</ScrollArea>
				</Tabs>
			</div>
		</>
	);
};

// ─── ADMIN PUSH BUTTON ──────────────────────────────────────────────────────

interface AdminPushProps {
	workspaceId: string;
	actionItems: Array<{
		title: string;
		assignee?: string;
		assigneeUserId?: string;
		priority?: string;
	}>;
}

const AdminPushButton = ({ workspaceId, actionItems }: AdminPushProps) => {
	const [pushing, setPushing] = useState(false);
	const createBulk = useMutation(api.tasks.createBulkFromAI);

	const handlePush = async () => {
		setPushing(true);
		try {
			await createBulk({
				workspaceId: workspaceId as Id<"workspaces">,
				tasks: actionItems.map((item) => ({
					title: item.assignee
						? `${item.title} → ${item.assignee}`
						: item.title,
					assigneeUserId: item.assigneeUserId
						? (item.assigneeUserId as Id<"users">)
						: undefined,
					priority: (item.priority as "low" | "medium" | "high") || "medium",
				})),
			});
			toast.success(`${actionItems.length} tasks pushed to dashboard!`);
		} catch (e) {
			toast.error(e instanceof Error ? e.message : "Failed to push tasks");
		} finally {
			setPushing(false);
		}
	};

	return (
		<Button
			className="w-full rounded-full h-9 text-xs font-medium gap-2 border-orange-200 text-orange-700 hover:bg-orange-50 mt-2"
			disabled={pushing}
			onClick={handlePush}
			variant="outline"
		>
			{pushing ? (
				<Loader2 className="w-3.5 h-3.5 animate-spin" />
			) : (
				<ArrowUpRight className="w-3.5 h-3.5" />
			)}
			Push All Tasks to Dashboard
		</Button>
	);
};

// ─── MEETING CHAT ───────────────────────────────────────────────────────────

interface MeetingChatProps {
	onClose: () => void;
}

export const MeetingChat = ({ onClose }: MeetingChatProps) => {
	const [messages, setMessages] = useState<
		{ name: string; text: string; time: string }[]
	>([]);
	const [input, setInput] = useState("");
	const scrollRef = useRef<HTMLDivElement>(null);
	const { useLocalParticipant } = useCallStateHooks();
	const localParticipant = useLocalParticipant();
	const broadcast = useBroadcastEvent();

	useEventListener(({ event }) => {
		if (event.type === "CHAT_MESSAGE") {
			setMessages((prev) => [
				...prev,
				{
					name: event.name,
					text: event.text,
					time: event.time,
				},
			]);
		}
	});

	useEffect(() => {
		if (scrollRef.current)
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
	}, []);

	const sendMessage = () => {
		const text = input.trim();
		if (!text) return;
		const name = localParticipant?.name || "You";
		const time = new Date().toLocaleTimeString([], {
			hour: "2-digit",
			minute: "2-digit",
		});
		const newMessage = { name, text, time };

		setMessages((prev) => [...prev, newMessage]);
		broadcast({
			type: "CHAT_MESSAGE",
			name,
			text,
			time,
		});
		setInput("");
	};

	return (
		<>
			<div className="flex items-center justify-between p-5 pb-3 border-b border-white/5">
				<h2 className="text-lg font-semibold text-white">In-call messages</h2>
				<Button
					className="text-gray-400 hover:text-white hover:bg-white/10 rounded-full h-9 w-9"
					onClick={onClose}
					size="icon"
					variant="ghost"
				>
					<X className="w-4 h-4" />
				</Button>
			</div>
			<div className="px-5 py-2 bg-white/5 border-b border-white/5">
				<p className="text-[11px] text-gray-400">
					Messages are only visible to people in the call.
				</p>
			</div>
			<div
				className="flex-1 overflow-y-auto px-5 py-4 space-y-4"
				ref={scrollRef}
			>
				{messages.length === 0 && (
					<div className="flex flex-col items-center justify-center h-full text-gray-400 text-center gap-2 py-16">
						<p className="text-sm">No messages yet</p>
						<p className="text-xs">Send a message to everyone in the call</p>
					</div>
				)}
				{messages.map((msg, i) => (
					<div className="flex gap-3" key={i}>
						<div className="w-8 h-8 rounded-full bg-[#0b57d0] text-white flex items-center justify-center text-xs font-medium shrink-0">
							{msg.name[0]?.toUpperCase() || "A"}
						</div>
						<div className="flex-1 min-w-0">
							<div className="flex items-baseline gap-2">
								<span className="text-[13px] font-medium text-white">
									{msg.name}
								</span>
								<span className="text-[11px] text-gray-500">{msg.time}</span>
							</div>
							<p className="text-[13px] text-gray-300 mt-0.5 break-words">
								{msg.text}
							</p>
						</div>
					</div>
				))}
			</div>
			<div className="p-4 border-t border-white/5">
				<div className="flex items-center gap-2">
					<input
						className="flex-1 text-sm bg-white/5 border-0 rounded-full px-4 py-2.5 focus:bg-white/10 focus:ring-1 focus:ring-indigo-500 outline-none text-white placeholder:text-gray-500"
						onChange={(e) => setInput(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") sendMessage();
						}}
						placeholder="Send a message to everyone"
						type="text"
						value={input}
					/>
					<Button
						className="rounded-full h-9 w-9 bg-[#0b57d0] hover:bg-[#0b57d0]/90 shrink-0"
						disabled={!input.trim()}
						onClick={sendMessage}
						size="icon"
					>
						<svg fill="none" height="16" viewBox="0 0 24 24" width="16">
							<path
								d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"
								fill="currentColor"
							/>
						</svg>
					</Button>
				</div>
			</div>
		</>
	);
};
