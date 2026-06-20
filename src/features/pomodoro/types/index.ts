export type PomodoroMode = "work" | "break" | "custom";

export interface PomodoroSettings {
	/** Length of a focus session, in minutes. */
	workMinutes: number;
	/** Length of a break, in minutes. */
	breakMinutes: number;
	/** Automatically start the next session when one completes. */
	autoStart: boolean;
	/** Play a chime when a session completes. */
	soundEnabled: boolean;
}

export const DEFAULT_SETTINGS: PomodoroSettings = {
	workMinutes: 25,
	breakMinutes: 5,
	autoStart: true,
	soundEnabled: true,
};

export const MIN_MINUTES = 1;
export const MAX_MINUTES = 1440;
