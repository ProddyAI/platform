"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
	DEFAULT_SETTINGS,
	MAX_MINUTES,
	MIN_MINUTES,
	type PomodoroMode,
	type PomodoroSettings,
} from "../types";

const STORAGE_KEY = "proddy.pomodoro.v1";
const TICK_MS = 250;

interface PersistedState {
	mode: PomodoroMode;
	settings: PomodoroSettings;
	customMinutes: number;
	/** Milliseconds remaining when paused. Ignored while running. */
	remainingMs: number;
	/** Epoch ms when the active session ends, or null when paused. */
	endAt: number | null;
	isActive: boolean;
	/** Completed focus sessions, scoped to a single day. */
	completed: { count: number; date: string };
}

const todayKey = (now: number) => new Date(now).toISOString().slice(0, 10);

const clampMinutes = (value: number) =>
	Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, Math.round(value)));

/** A short, pleasant two-tone chime built with the Web Audio API (no asset). */
const playChime = () => {
	if (typeof window === "undefined") return;
	const Ctx =
		window.AudioContext ||
		(window as unknown as { webkitAudioContext?: typeof AudioContext })
			.webkitAudioContext;
	if (!Ctx) return;

	try {
		const ctx = new Ctx();
		const now = ctx.currentTime;
		for (const [offset, freq] of [
			[0, 660],
			[0.18, 880],
		] as const) {
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();
			osc.type = "sine";
			osc.frequency.value = freq;
			gain.gain.setValueAtTime(0.0001, now + offset);
			gain.gain.exponentialRampToValueAtTime(0.3, now + offset + 0.02);
			gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.35);
			osc.connect(gain).connect(ctx.destination);
			osc.start(now + offset);
			osc.stop(now + offset + 0.4);
		}
		window.setTimeout(() => ctx.close().catch(() => {}), 1000);
	} catch {
		// Audio is best-effort; never let it break the timer.
	}
};

const notify = (title: string, body: string) => {
	if (typeof window === "undefined" || !("Notification" in window)) return;
	if (Notification.permission !== "granted") return;
	try {
		new Notification(title, { body, icon: "/logo.svg", silent: true });
	} catch {
		// Some browsers throw for non-persistent notifications; ignore.
	}
};

const loadPersisted = (): PersistedState | null => {
	if (typeof window === "undefined") return null;
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		return JSON.parse(raw) as PersistedState;
	} catch {
		return null;
	}
};

export interface UsePomodoro {
	mode: PomodoroMode;
	isActive: boolean;
	remainingMs: number;
	totalMs: number;
	/** Fraction elapsed, 0 → 1, for progress visuals. */
	progress: number;
	settings: PomodoroSettings;
	customMinutes: string;
	completedToday: number;
	toggle: () => void;
	reset: () => void;
	switchMode: (mode: PomodoroMode) => void;
	setCustomMinutes: (value: string) => void;
	startCustom: () => void;
	updateSettings: (patch: Partial<PomodoroSettings>) => void;
}

export const usePomodoro = (): UsePomodoro => {
	// Start from defaults so server and first client render agree, then
	// rehydrate from localStorage in an effect (avoids hydration mismatch).
	const [mode, setMode] = useState<PomodoroMode>("work");
	const [settings, setSettings] = useState<PomodoroSettings>(DEFAULT_SETTINGS);
	const [customMinutes, setCustomMinutesState] = useState(
		String(DEFAULT_SETTINGS.workMinutes)
	);
	const [isActive, setIsActive] = useState(false);
	const [endAt, setEndAt] = useState<number | null>(null);
	const [remainingMs, setRemainingMs] = useState(
		DEFAULT_SETTINGS.workMinutes * 60_000
	);
	const [completed, setCompleted] = useState(() => ({
		count: 0,
		date: todayKey(Date.now()),
	}));
	const hydrated = useRef(false);
	// Drives re-renders while a session is running.
	const [, setNow] = useState(() => Date.now());

	// Rehydrate persisted state once, after mount.
	useEffect(() => {
		const saved = loadPersisted();
		hydrated.current = true;
		if (!saved) return;
		setMode(saved.mode);
		setSettings(saved.settings);
		setCustomMinutesState(String(saved.customMinutes));
		setCompleted(saved.completed);
		// A session that ran out while away is restored as finished, not active,
		// so we never silently auto-advance on reload.
		if (saved.isActive && saved.endAt && saved.endAt > Date.now()) {
			setEndAt(saved.endAt);
			setRemainingMs(Math.max(0, saved.endAt - Date.now()));
			setIsActive(true);
		} else {
			setEndAt(null);
			setIsActive(false);
			setRemainingMs(saved.isActive ? 0 : saved.remainingMs);
		}
	}, []);

	const durationMsFor = useCallback(
		(target: PomodoroMode) => {
			if (target === "work") return settings.workMinutes * 60_000;
			if (target === "break") return settings.breakMinutes * 60_000;
			const mins = Number.parseInt(customMinutes, 10);
			return (Number.isNaN(mins) ? settings.workMinutes : mins) * 60_000;
		},
		[settings.workMinutes, settings.breakMinutes, customMinutes]
	);

	const totalMs = durationMsFor(mode);
	const liveRemaining =
		isActive && endAt ? Math.max(0, endAt - Date.now()) : remainingMs;
	const progress = totalMs > 0 ? 1 - liveRemaining / totalMs : 0;

	// Reset the daily counter when the calendar day rolls over.
	useEffect(() => {
		const key = todayKey(Date.now());
		if (completed.date !== key) setCompleted({ count: 0, date: key });
	}, [completed.date]);

	// Persist on every meaningful change (but not before we've rehydrated,
	// or we'd clobber saved state with the initial defaults).
	useEffect(() => {
		if (typeof window === "undefined" || !hydrated.current) return;
		const snapshot: PersistedState = {
			mode,
			settings,
			customMinutes: Number.parseInt(customMinutes, 10) || settings.workMinutes,
			remainingMs:
				isActive && endAt ? Math.max(0, endAt - Date.now()) : remainingMs,
			endAt,
			isActive,
			completed,
		};
		try {
			window.localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
		} catch {
			// Storage may be full or blocked; the timer still works in-memory.
		}
	}, [mode, settings, customMinutes, remainingMs, endAt, isActive, completed]);

	const startMode = useCallback(
		(target: PomodoroMode, autoStart: boolean) => {
			const duration = durationMsFor(target);
			setMode(target);
			setRemainingMs(duration);
			if (autoStart) {
				setEndAt(Date.now() + duration);
				setIsActive(true);
			} else {
				setEndAt(null);
				setIsActive(false);
			}
		},
		[durationMsFor]
	);

	const handleComplete = useCallback(() => {
		setIsActive(false);
		setEndAt(null);

		if (settings.soundEnabled) playChime();

		const finished = mode;
		if (finished === "work") {
			setCompleted((c) => ({ date: todayKey(Date.now()), count: c.count + 1 }));
		}

		const next: PomodoroMode =
			finished === "work" ? "break" : finished === "break" ? "work" : "custom";

		if (finished === "custom") {
			setRemainingMs(durationMsFor("custom"));
			notify("Timer complete", "Your custom timer has finished.");
			toast.success("Timer complete", {
				description: "Your custom timer finished.",
			});
		} else if (finished === "work") {
			notify("Focus session complete 🎉", "Nice work — time for a break.");
			toast.success("Focus session complete 🎉", {
				description: settings.autoStart
					? "Starting your break now."
					: "Time for a break.",
			});
			startMode(next, settings.autoStart);
		} else {
			notify("Break's over ☕", "Back to it — let's get into deep work.");
			toast("Break's over ☕", {
				description: settings.autoStart
					? "Starting your next focus session."
					: "Ready for deep work?",
			});
			startMode(next, settings.autoStart);
		}
	}, [
		mode,
		settings.soundEnabled,
		settings.autoStart,
		durationMsFor,
		startMode,
	]);

	// The ticking loop. Recomputes "now" and fires completion at zero.
	useEffect(() => {
		if (!isActive || endAt === null) return;
		const id = window.setInterval(() => {
			if (Date.now() >= endAt) {
				handleComplete();
			} else {
				setNow(Date.now());
			}
		}, TICK_MS);
		return () => window.clearInterval(id);
	}, [isActive, endAt, handleComplete]);

	const requestNotificationPermission = useCallback(() => {
		if (typeof window === "undefined" || !("Notification" in window)) return;
		if (Notification.permission === "default") {
			Notification.requestPermission().catch(() => {});
		}
	}, []);

	const toggle = useCallback(() => {
		if (isActive) {
			// Pause: freeze remaining time.
			setRemainingMs(endAt ? Math.max(0, endAt - Date.now()) : remainingMs);
			setEndAt(null);
			setIsActive(false);
		} else {
			requestNotificationPermission();
			const remaining = remainingMs > 0 ? remainingMs : totalMs;
			setEndAt(Date.now() + remaining);
			setRemainingMs(remaining);
			setIsActive(true);
		}
	}, [isActive, endAt, remainingMs, totalMs, requestNotificationPermission]);

	const reset = useCallback(() => {
		setIsActive(false);
		setEndAt(null);
		setRemainingMs(durationMsFor(mode));
	}, [durationMsFor, mode]);

	const switchMode = useCallback(
		(target: PomodoroMode) => {
			setIsActive(false);
			setEndAt(null);
			setMode(target);
			setRemainingMs(durationMsFor(target));
		},
		[durationMsFor]
	);

	const setCustomMinutes = useCallback((value: string) => {
		setCustomMinutesState(value);
	}, []);

	const startCustom = useCallback(() => {
		const mins = Number.parseInt(customMinutes, 10);
		if (Number.isNaN(mins) || mins <= 0) return;
		const clamped = clampMinutes(mins);
		setCustomMinutesState(String(clamped));
		requestNotificationPermission();
		const duration = clamped * 60_000;
		setMode("custom");
		setRemainingMs(duration);
		setEndAt(Date.now() + duration);
		setIsActive(true);
	}, [customMinutes, requestNotificationPermission]);

	const updateSettings = useCallback(
		(patch: Partial<PomodoroSettings>) => {
			setSettings((prev) => {
				const merged = { ...prev, ...patch };
				if (patch.workMinutes !== undefined)
					merged.workMinutes = clampMinutes(patch.workMinutes);
				if (patch.breakMinutes !== undefined)
					merged.breakMinutes = clampMinutes(patch.breakMinutes);
				return merged;
			});
			// If a duration for the current, idle mode changed, reflect it now.
			if (!isActive) {
				if (mode === "work" && patch.workMinutes !== undefined) {
					setRemainingMs(clampMinutes(patch.workMinutes) * 60_000);
				} else if (mode === "break" && patch.breakMinutes !== undefined) {
					setRemainingMs(clampMinutes(patch.breakMinutes) * 60_000);
				}
			}
		},
		[isActive, mode]
	);

	return useMemo(
		() => ({
			mode,
			isActive,
			remainingMs: liveRemaining,
			totalMs,
			progress,
			settings,
			customMinutes,
			completedToday: completed.count,
			toggle,
			reset,
			switchMode,
			setCustomMinutes,
			startCustom,
			updateSettings,
		}),
		[
			mode,
			isActive,
			liveRemaining,
			totalMs,
			progress,
			settings,
			customMinutes,
			completed.count,
			toggle,
			reset,
			switchMode,
			setCustomMinutes,
			startCustom,
			updateSettings,
		]
	);
};
