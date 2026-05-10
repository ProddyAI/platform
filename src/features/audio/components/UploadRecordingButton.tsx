import { useAction, useMutation, useQuery } from "convex/react";
import {
	AlertCircle,
	CheckCircle2,
	FileAudio,
	Loader2,
	Sparkles,
	Upload,
} from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { useWorkspaceId } from "@/hooks/use-workspace-id";

type UploadStep =
	| "idle"
	| "uploading"
	| "transcribing"
	| "generating"
	| "saving"
	| "done"
	| "error";

export const UploadRecordingButton = () => {
	const workspaceId = useWorkspaceId();
	const [step, setStep] = useState<UploadStep>("idle");
	const [fileName, setFileName] = useState("");
	const [errorMsg, setErrorMsg] = useState("");
	const fileRef = useRef<HTMLInputElement>(null);

	const saveUploadTranscript = useMutation(
		api.meetingNotes.saveUploadTranscript
	);
	const generateAI = useAction(api.meetingNotes.generateAIInsights);
	const user = useQuery(api.users.current);

	const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		// Validate file type
		const validTypes = [
			"audio/mp3",
			"audio/mpeg",
			"audio/wav",
			"audio/webm",
			"video/mp4",
			"video/webm",
			"audio/mp4",
			"audio/x-m4a",
		];
		const ext = file.name.split(".").pop()?.toLowerCase();
		const validExts = ["mp3", "mp4", "wav", "webm", "m4a", "ogg"];

		if (!validTypes.includes(file.type) && !validExts.includes(ext || "")) {
			toast.error("Unsupported file format. Use mp3, mp4, wav, or webm.");
			return;
		}

		// Validate file size (20MB max)
		if (file.size > 100 * 1024 * 1024) {
			toast.error("File too large. Maximum size is 100MB.");
			return;
		}

		setFileName(file.name);
		setErrorMsg("");

		try {
			// Step 1: Upload & Transcribe
			setStep("transcribing");
			const formData = new FormData();
			formData.append("file", file);

			const transcribeRes = await fetch("/api/transcribe", {
				method: "POST",
				body: formData,
			});

			const transcribeData = await transcribeRes.json();
			if (!transcribeRes.ok)
				throw new Error(transcribeData.error || "Transcription failed");

			const transcript = transcribeData.transcript;
			if (!transcript || transcript.trim().length < 10) {
				throw new Error(
					"Transcription returned empty or too short. Try a clearer audio file."
				);
			}

			// Step 2: Save transcript to Convex
			setStep("saving");
			const roomId = `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

			const noteId = await saveUploadTranscript({
				roomId,
				workspaceId: workspaceId || "",
				transcript,
			});

			// Step 3: Generate AI notes
			setStep("generating");
			await generateAI({
				noteId,
				transcript,
			});

			setStep("done");
			toast.success("Upload complete! AI notes generated and saved.");

			// Reset after 3 seconds
			setTimeout(() => {
				setStep("idle");
				setFileName("");
			}, 3000);
		} catch (error: any) {
			console.error("Upload pipeline error:", error);
			setErrorMsg(error.message || "An error occurred");
			setStep("error");
			toast.error(error.message || "Upload failed");

			// Reset after 5 seconds
			setTimeout(() => {
				setStep("idle");
				setFileName("");
				setErrorMsg("");
			}, 5000);
		} finally {
			// Reset file input
			if (fileRef.current) fileRef.current.value = "";
		}
	};

	const isProcessing = step !== "idle" && step !== "done" && step !== "error";

	const stepLabels: Record<UploadStep, string> = {
		idle: "Upload Recording",
		uploading: "Uploading...",
		transcribing: "Transcribing audio...",
		generating: "Generating AI notes...",
		saving: "Saving transcript...",
		done: "Done!",
		error: "Failed",
	};

	const getIcon = () => {
		if (step === "done")
			return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
		if (step === "error")
			return <AlertCircle className="w-4 h-4 text-red-500" />;
		if (isProcessing) return <Loader2 className="w-4 h-4 animate-spin" />;
		return <Upload className="w-4 h-4" />;
	};

	return (
		<div className="relative">
			<input
				accept="audio/*,video/mp4,video/webm"
				className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
				disabled={isProcessing}
				onChange={handleUpload}
				ref={fileRef}
				title="Upload audio or video recording"
				type="file"
			/>
			<Button
				className={`gap-2 pointer-events-none text-xs ${step === "done" ? "border-emerald-200 text-emerald-700 bg-emerald-50" : step === "error" ? "border-red-200 text-red-700 bg-red-50" : ""}`}
				disabled={isProcessing}
				size="sm"
				variant="outline"
			>
				{getIcon()}
				{stepLabels[step]}
			</Button>
			{fileName && isProcessing && (
				<div className="absolute top-full left-0 mt-1 text-[10px] text-gray-500 truncate max-w-[200px]">
					{fileName}
				</div>
			)}
		</div>
	);
};
