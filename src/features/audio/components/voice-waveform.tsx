"use client";

import { useEffect, useRef, useState } from "react";

export const VoiceWaveform = ({ isRecording }: { isRecording: boolean }) => {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
	const analyserRef = useRef<AnalyserNode | null>(null);
	const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
	const animationRef = useRef<number | null>(null);

	useEffect(() => {
		if (!isRecording) {
			if (animationRef.current) cancelAnimationFrame(animationRef.current);
			return;
		}

		const initAudio = async () => {
			try {
				const stream = await navigator.mediaDevices.getUserMedia({
					audio: true,
				});
				const ctx = new (
					window.AudioContext || (window as any).webkitAudioContext
				)();
				const analyser = ctx.createAnalyser();
				const source = ctx.createMediaStreamSource(stream);

				analyser.fftSize = 256;
				source.connect(analyser);

				setAudioContext(ctx);
				analyserRef.current = analyser;
				sourceRef.current = source;

				draw();
			} catch (err) {
				console.error("Error accessing microphone for waveform:", err);
			}
		};

		const draw = () => {
			if (!canvasRef.current || !analyserRef.current) return;

			const canvas = canvasRef.current;
			const ctx = canvas.getContext("2d");
			if (!ctx) return;

			const analyser = analyserRef.current;
			const bufferLength = analyser.frequencyBinCount;
			const dataArray = new Uint8Array(bufferLength);

			const renderFrame = () => {
				animationRef.current = requestAnimationFrame(renderFrame);
				analyser.getByteFrequencyData(dataArray);

				ctx.clearRect(0, 0, canvas.width, canvas.height);

				const barWidth = (canvas.width / bufferLength) * 2.5;
				let x = 0;

				for (let i = 0; i < bufferLength; i++) {
					const barHeight = (dataArray[i] / 255) * canvas.height;

					// Gradient color for a premium look
					const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
					gradient.addColorStop(0, "#3b82f6"); // Blue
					gradient.addColorStop(1, "#8b5cf6"); // Purple

					ctx.fillStyle = gradient;
					ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);

					x += barWidth + 1;
				}
			};

			renderFrame();
		};

		initAudio();

		return () => {
			if (animationRef.current) cancelAnimationFrame(animationRef.current);
			if (audioContext) audioContext.close();
		};
	}, [isRecording]);

	return (
		<div className="flex items-center gap-2 h-8 w-24">
			<canvas
				className="rounded-sm opacity-80"
				height={32}
				ref={canvasRef}
				width={96}
			/>
		</div>
	);
};
