import { useAction, useMutation } from "convex/react";
import { AlertCircle, CheckCircle2, Loader2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { useWorkspaceId } from "@/hooks/use-workspace-id";

type UploadStep =
	| "idle"
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
		api.content.meetingNotes.saveUploadTranscript
	);
	const generateAI = useAction(api.content.meetingNotes.generateAIInsights);

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

		// Validate file size (25MB max — transcription per-request limit)
		if (file.size > 25 * 1024 * 1024) {
			toast.error("File too large. Maximum size is 25MB.");
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
				workspaceId: workspaceId as Id<"workspaces">,
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
		} catch (error) {
			console.error("Upload pipeline error:", error);
			const message = (error as { message?: string }).message;
			setErrorMsg(message || "An error occurred");
			setStep("error");
			toast.error(message || "Upload failed");
		} finally {
			// Reset file input
			if (fileRef.current) fileRef.current.value = "";
		}
	};

	const isProcessing = step !== "idle" && step !== "done" && step !== "error";

	const stepLabels: Record<UploadStep, string> = {
		idle: "Upload Recording",
		transcribing: "Transcribing audio...",
		generating: "Generating AI notes...",
		saving: "Saving transcript...",
		done: "Saved",
		error: "Failed",
	};

	const getIcon = () => {
		if (step === "done")
			return <CheckCircle2 className="size-4 text-success" />;
		if (step === "error")
			return <AlertCircle className="size-4 text-destructive" />;
		if (isProcessing) return <Loader2 className="size-4 animate-spin" />;
		return <Upload className="size-4" />;
	};

	return (
		<div className="relative">
			<input
				accept="audio/*,video/mp4,video/webm"
				className="peer absolute inset-0 size-full opacity-0 cursor-pointer disabled:cursor-not-allowed z-10"
				disabled={isProcessing}
				onChange={handleUpload}
				ref={fileRef}
				title="Upload audio or video recording"
				type="file"
			/>
			<Button
				className={`gap-2 pointer-events-none text-xs peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 ${step === "done" ? "border-success/30 text-success bg-success/10" : step === "error" ? "border-destructive/30 text-destructive bg-destructive/10" : ""}`}
				disabled={isProcessing}
				size="sm"
				variant="outline"
			>
				{getIcon()}
				{stepLabels[step]}
			</Button>
			{fileName && isProcessing && (
				<div className="absolute top-full left-0 mt-1 text-[10px] text-muted-foreground truncate max-w-[200px]">
					{fileName}
				</div>
			)}
			{step === "error" && errorMsg && (
				<div className="absolute top-full left-0 mt-1 text-[10px] text-destructive max-w-[240px]">
					{errorMsg}
				</div>
			)}
		</div>
	);
};
