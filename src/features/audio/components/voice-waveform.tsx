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

				analyser.fftSize = 64;
				analyser.smoothingTimeConstant = 0.8;
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

				const barCount = 16;
				const gap = 3;
				const barWidth = (canvas.width - (barCount - 1) * gap) / barCount;
				const centerY = canvas.height / 2;

				for (let i = 0; i < barCount; i++) {
					// Sample from the data array evenly
					const dataIndex = Math.floor((i / barCount) * bufferLength);
					const value = dataArray[dataIndex] / 255;
					// Minimum bar height for visual pulse even when quiet
					const barHeight = Math.max(4, value * (canvas.height * 0.9));

					const x = i * (barWidth + gap);
					const y = centerY - barHeight / 2;

					// Rounded bars with gradient
					const gradient = ctx.createLinearGradient(
						x,
						centerY + barHeight / 2,
						x,
						centerY - barHeight / 2
					);
					gradient.addColorStop(0, "#6366f1"); // Indigo
					gradient.addColorStop(0.5, "#818cf8"); // Lighter indigo
					gradient.addColorStop(1, "#c084fc"); // Purple

					ctx.fillStyle = gradient;
					ctx.beginPath();
					const radius = Math.min(barWidth / 2, 3);
					ctx.roundRect(x, y, barWidth, barHeight, radius);
					ctx.fill();
				}
			};

			renderFrame();
		};

		initAudio();

		return () => {
			if (animationRef.current) cancelAnimationFrame(animationRef.current);
			if (audioContext) audioContext.close();
		};
	}, [isRecording, audioContext]);

	return (
		<div className="flex items-center h-11 px-3 bg-white/5 rounded-full border border-white/10 backdrop-blur-sm">
			<canvas className="rounded-sm" height={36} ref={canvasRef} width={120} />
		</div>
	);
};
