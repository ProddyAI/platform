import { useAction, useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";

export const useMeetingTranscription = (
	roomId: string,
	workspaceId: string,
	channelId?: string,
	isRecording: boolean = false
) => {
	const saveTranscriptChunk = useMutation(api.meetingNotes.saveTranscript);
	const generateAI = useAction(api.meetingNotes.generateAIInsights);

	const meetingNotes = useQuery(api.meetingNotes.getByRoom, {
		roomId,
		workspaceId: workspaceId as Id<"workspaces">,
	});

	const [isListening, setIsListening] = useState(false);
	const [_localTranscript, setLocalTranscript] = useState("");

	const recognitionRef = useRef<any | null>(null);
	const chunkRef = useRef("");
	const timerRef = useRef<NodeJS.Timeout | null>(null);

	useEffect(() => {
		if (
			typeof window === "undefined" ||
			!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)
		) {
			console.warn("Speech Recognition API not supported in this browser.");
			return;
		}

		if (!isRecording) {
			if (isListening && recognitionRef.current) {
				recognitionRef.current.stop();
				setIsListening(false);
			}
			return;
		}

		if (isListening) return;

		const SpeechRecognition =
			(window as any).SpeechRecognition ||
			(window as any).webkitSpeechRecognition;
		const recognition = new SpeechRecognition();

		recognition.continuous = true;
		recognition.interimResults = true;
		recognition.lang = "en-US";

		recognition.onresult = (event: any) => {
			let _interimTranscript = "";
			let finalTranscript = "";

			for (let i = event.resultIndex; i < event.results.length; ++i) {
				if (event.results[i].isFinal) {
					finalTranscript += `${event.results[i][0].transcript} `;
				} else {
					_interimTranscript += event.results[i][0].transcript;
				}
			}

			if (finalTranscript) {
				setLocalTranscript((prev) => prev + finalTranscript);
				chunkRef.current += finalTranscript;

				// Debounce saving to DB
				if (timerRef.current) clearTimeout(timerRef.current);
				timerRef.current = setTimeout(async () => {
					if (chunkRef.current.trim().length > 0) {
						const currentChunk = chunkRef.current.trim();
						try {
							await saveTranscriptChunk({
								roomId,
								workspaceId: workspaceId as Id<"workspaces">,
								channelId: channelId as Id<"channels">,
								transcriptChunk: currentChunk,
							});
							// Only clear if the mutation was successful
							if (chunkRef.current.trim() === currentChunk) {
								chunkRef.current = "";
							} else {
								// If more text was added while waiting, just remove what we saved
								chunkRef.current = chunkRef.current
									.replace(currentChunk, "")
									.trim();
							}
						} catch (error) {
							console.error("Failed to save transcript chunk:", error);
							// Don't clear chunkRef.current so it retries on next update
						}
					}
				}, 2000);
			}
		};

		recognition.onerror = (event: any) => {
			console.error("Speech recognition error", event.error);
			if (event.error === "not-allowed") {
				setIsListening(false);
				recognition.onend = null;
			}
		};

		recognition.onend = () => {
			// Restart automatically if still supposed to be recording
			if (isRecording) {
				try {
					recognition.start();
				} catch (_e) {
					setIsListening(false);
				}
			} else {
				setIsListening(false);
			}
		};

		try {
			recognition.start();
			setIsListening(true);
			recognitionRef.current = recognition;
		} catch (e) {
			console.error("Could not start speech recognition", e);
		}

		return () => {
			if (timerRef.current) clearTimeout(timerRef.current);
			if (recognitionRef.current) {
				recognitionRef.current.stop();
			}
		};
	}, [
		isRecording,
		saveTranscriptChunk,
		roomId,
		workspaceId,
		channelId,
		isListening,
	]);

	const triggerGenerateInsights = async (membersContext?: string) => {
		if (meetingNotes?._id && meetingNotes.transcript.trim().length > 10) {
			await generateAI({
				noteId: meetingNotes._id,
				transcript: meetingNotes.transcript,
				membersContext,
			});
		}
	};

	return {
		isListening,
		meetingNotes,
		triggerGenerateInsights,
	};
};
