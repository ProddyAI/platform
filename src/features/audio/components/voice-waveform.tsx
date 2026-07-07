"use client";

import { useEffect, useRef } from "react";

export const VoiceWaveform = ({ isRecording }: { isRecording: boolean }) => {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const audioContextRef = useRef<AudioContext | null>(null);
	const analyserRef = useRef<AnalyserNode | null>(null);
	const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
	const streamRef = useRef<MediaStream | null>(null);
	const animationRef = useRef<number | null>(null);

	useEffect(() => {
		if (!isRecording) return undefined;

		let cancelled = false;
		const prefersReducedMotion = window.matchMedia(
			"(prefers-reduced-motion: reduce)"
		).matches;

		const initAudio = async () => {
			try {
				const stream = await navigator.mediaDevices.getUserMedia({
					audio: true,
				});
				if (cancelled) {
					for (const track of stream.getTracks()) track.stop();
					return;
				}

				const AudioContextCtor =
					window.AudioContext ||
					(
						window as typeof window & {
							webkitAudioContext?: typeof AudioContext;
						}
					).webkitAudioContext;
				const ctx = new AudioContextCtor();
				const analyser = ctx.createAnalyser();
				const source = ctx.createMediaStreamSource(stream);

				analyser.fftSize = 64;
				analyser.smoothingTimeConstant = 0.8;
				source.connect(analyser);

				audioContextRef.current = ctx;
				analyserRef.current = analyser;
				sourceRef.current = source;
				streamRef.current = stream;

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
			// Read the primary token once per session rather than per frame.
			const barColor = `hsl(${getComputedStyle(document.documentElement)
				.getPropertyValue("--primary")
				.trim()})`;
			// Reduced motion still shows levels, just at a calmer refresh rate.
			const minFrameInterval = prefersReducedMotion ? 400 : 0;
			let lastDrawTime = 0;

			const renderFrame = (time: number) => {
				animationRef.current = requestAnimationFrame(renderFrame);
				if (time - lastDrawTime < minFrameInterval) return;
				lastDrawTime = time;

				analyser.getByteFrequencyData(dataArray);

				ctx.clearRect(0, 0, canvas.width, canvas.height);

				const barCount = 16;
				const gap = 3;
				const barWidth = (canvas.width - (barCount - 1) * gap) / barCount;
				const centerY = canvas.height / 2;

				ctx.fillStyle = barColor;
				for (let i = 0; i < barCount; i++) {
					// Sample from the data array evenly
					const dataIndex = Math.floor((i / barCount) * bufferLength);
					const value = dataArray[dataIndex] / 255;
					// Minimum bar height for visual pulse even when quiet
					const barHeight = Math.max(4, value * (canvas.height * 0.9));

					const x = i * (barWidth + gap);
					const y = centerY - barHeight / 2;

					ctx.beginPath();
					const radius = Math.min(barWidth / 2, 3);
					ctx.roundRect(x, y, barWidth, barHeight, radius);
					ctx.fill();
				}
			};

			animationRef.current = requestAnimationFrame(renderFrame);
		};

		initAudio();

		return () => {
			cancelled = true;
			if (animationRef.current) cancelAnimationFrame(animationRef.current);
			animationRef.current = null;
			if (sourceRef.current) {
				sourceRef.current.disconnect();
				sourceRef.current = null;
			}
			if (streamRef.current) {
				for (const track of streamRef.current.getTracks()) track.stop();
				streamRef.current = null;
			}
			if (audioContextRef.current) {
				audioContextRef.current.close();
				audioContextRef.current = null;
			}
			analyserRef.current = null;
		};
	}, [isRecording]);

	return (
		<div className="flex items-center h-11 px-3 bg-muted rounded-full border border-border">
			<canvas
				aria-label="Live microphone waveform"
				className="rounded-sm"
				height={36}
				ref={canvasRef}
				role="img"
				width={120}
			/>
		</div>
	);
};
