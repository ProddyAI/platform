"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
	Bell,
	BellOff,
	Coffee,
	Flame,
	Maximize2,
	Minimize2,
	Minus,
	Pause,
	Play,
	Plus,
	RotateCcw,
	Settings,
	Timer,
	X,
	Zap,
} from "lucide-react";
import { useState } from "react";
import { Hint } from "@/components/hint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { usePomodoro } from "../hooks/use-pomodoro";
import type { PomodoroMode } from "../types";

const MODE_META: Record<PomodoroMode, { label: string; icon: typeof Zap }> = {
	work: { label: "Deep Work", icon: Zap },
	break: { label: "Short Break", icon: Coffee },
	custom: { label: "Custom Timer", icon: Settings },
};

const formatTime = (ms: number) => {
	const total = Math.ceil(ms / 1000);
	const mins = Math.floor(total / 60);
	const secs = total % 60;
	return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

export const PomodoroTimer = () => {
	const pomodoro = usePomodoro();
	const [popoverOpen, setPopoverOpen] = useState(false);
	const [isMinimized, setIsMinimized] = useState(false);
	const [showSettings, setShowSettings] = useState(false);

	const {
		mode,
		isActive,
		remainingMs,
		settings,
		customMinutes,
		completedToday,
		toggle,
		reset,
		switchMode,
		setCustomMinutes,
		startCustom,
		updateSettings,
	} = pomodoro;

	const meta = MODE_META[mode];
	const ModeIcon = meta.icon;
	const time = formatTime(remainingMs);

	return (
		<>
			<Popover onOpenChange={setPopoverOpen} open={popoverOpen}>
				<Hint
					label={isActive ? `${meta.label} · ${time}` : "Focus timer"}
					side="bottom"
				>
					<PopoverTrigger asChild>
						<Button
							className="relative text-white hover:bg-white/15 transition-colors"
							onClick={() => setPopoverOpen(true)}
							size="iconSm"
							variant="ghost"
						>
							<Timer className="size-5" />
							{isActive && (
								<span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-secondary ring-2 ring-primary" />
							)}
						</Button>
					</PopoverTrigger>
				</Hint>
				<PopoverContent
					align="end"
					className="w-80 overflow-hidden rounded-xl border p-0 shadow-lg"
					side="bottom"
				>
					<div className="bg-primary p-6 text-primary-foreground">
						<div className="mb-4 flex items-center justify-between">
							<div className="flex items-center gap-2 font-medium text-primary-foreground/90">
								<ModeIcon className="size-4" />
								<span className="text-xs font-semibold uppercase tracking-wider">
									{meta.label}
								</span>
							</div>
							<div className="flex items-center gap-0.5">
								<Button
									className="size-8 rounded-full text-primary-foreground/70 hover:bg-white/15 hover:text-primary-foreground"
									onClick={() => setShowSettings((s) => !s)}
									size="icon"
									title="Settings"
									variant="ghost"
								>
									<Settings className="size-4" />
								</Button>
								<Button
									className="size-8 rounded-full text-primary-foreground/70 hover:bg-white/15 hover:text-primary-foreground"
									onClick={() => {
										setIsMinimized(true);
										setPopoverOpen(false);
									}}
									size="icon"
									title="Minimize"
									variant="ghost"
								>
									<Minimize2 className="size-4" />
								</Button>
								<Button
									className="size-8 rounded-full text-primary-foreground/70 hover:bg-white/15 hover:text-primary-foreground"
									onClick={reset}
									size="icon"
									title="Reset"
									variant="ghost"
								>
									<RotateCcw className="size-4" />
								</Button>
							</div>
						</div>

						<div className="flex flex-col items-center justify-center py-8">
							<span className="font-bold text-7xl text-primary-foreground tabular-nums leading-none tracking-tight">
								{time}
							</span>
							{completedToday > 0 && (
								<span className="mt-3 flex items-center gap-1 text-primary-foreground/70 text-xs font-medium">
									<Flame className="size-3.5" />
									{completedToday} session{completedToday === 1 ? "" : "s"}{" "}
									today
								</span>
							)}
						</div>

						<div className="mt-2 flex items-center justify-center">
							<Button
								className="size-14 rounded-full bg-white text-primary shadow-sm transition-transform hover:bg-white/90 focus-visible:ring-white/60 focus-visible:ring-offset-0 active:scale-95"
								onClick={toggle}
								size="icon"
							>
								{isActive ? (
									<Pause className="size-6 fill-current" />
								) : (
									<Play className="ml-1 size-6 fill-current" />
								)}
							</Button>
						</div>
					</div>

					<div className="space-y-4 bg-popover p-4">
						<div className="flex gap-2">
							{(["work", "break", "custom"] as const).map((m) => {
								const active = mode === m;
								return (
									<Button
										className="flex-1 rounded-lg capitalize"
										key={m}
										onClick={() => switchMode(m)}
										size="sm"
										variant={active ? "primary" : "outline"}
									>
										{m}
									</Button>
								);
							})}
						</div>

						{mode === "custom" && (
							<div className="flex items-center gap-2">
								<Input
									className="h-9 rounded-lg"
									max="1440"
									min="1"
									onChange={(e) => setCustomMinutes(e.target.value)}
									onKeyDown={(e) => e.key === "Enter" && startCustom()}
									placeholder="Minutes"
									type="number"
									value={customMinutes}
								/>
								<Button onClick={startCustom} size="sm" variant="primary">
									Start
								</Button>
							</div>
						)}

						<AnimatePresence initial={false}>
							{showSettings && (
								<motion.div
									animate={{ height: "auto", opacity: 1 }}
									className="overflow-hidden"
									exit={{ height: 0, opacity: 0 }}
									initial={{ height: 0, opacity: 0 }}
								>
									<div className="space-y-3 border-t pt-3">
										<DurationStepper
											label="Focus length"
											onChange={(workMinutes) =>
												updateSettings({ workMinutes })
											}
											value={settings.workMinutes}
										/>
										<DurationStepper
											label="Break length"
											onChange={(breakMinutes) =>
												updateSettings({ breakMinutes })
											}
											value={settings.breakMinutes}
										/>
										<div className="flex items-center gap-2">
											<ToggleChip
												active={settings.autoStart}
												label="Auto-start next"
												onClick={() =>
													updateSettings({ autoStart: !settings.autoStart })
												}
											/>
											<ToggleChip
												active={settings.soundEnabled}
												icon={settings.soundEnabled ? Bell : BellOff}
												label="Chime"
												onClick={() =>
													updateSettings({
														soundEnabled: !settings.soundEnabled,
													})
												}
											/>
										</div>
									</div>
								</motion.div>
							)}
						</AnimatePresence>
					</div>
				</PopoverContent>
			</Popover>

			<AnimatePresence>
				{isMinimized && (
					<motion.div
						animate={{ opacity: 1, scale: 1, y: 0 }}
						className="fixed bottom-24 right-8 z-[100]"
						drag
						dragConstraints={{
							left: -window.innerWidth + 150,
							right: 0,
							top: -window.innerHeight + 150,
							bottom: 0,
						}}
						dragElastic={0.1}
						dragMomentum={false}
						exit={{ opacity: 0, scale: 0.9, y: 10 }}
						initial={{ opacity: 0, scale: 0.9, y: 10 }}
						style={{ originX: 1, originY: 1 }}
					>
						<div className="flex items-center gap-3 rounded-full border bg-primary p-2 pr-4 text-primary-foreground shadow-lg">
							<Button
								className="size-9 rounded-full bg-white/15 text-primary-foreground hover:bg-white/25"
								onClick={toggle}
								size="icon"
							>
								{isActive ? (
									<Pause className="size-5 fill-current" />
								) : (
									<Play className="ml-0.5 size-5 fill-current" />
								)}
							</Button>
							<span className="font-semibold text-xl text-primary-foreground tabular-nums tracking-tight">
								{time}
							</span>
							<div className="ml-1 flex items-center gap-0.5 border-l border-white/20 pl-2">
								<Button
									className="size-8 rounded-full text-primary-foreground/70 hover:bg-white/15 hover:text-primary-foreground"
									onClick={() => setIsMinimized(false)}
									size="icon"
									title="Back to toolbar"
									variant="ghost"
								>
									<Minimize2 className="size-4" />
								</Button>
								<Button
									className="size-8 rounded-full text-primary-foreground/70 hover:bg-white/15 hover:text-primary-foreground"
									onClick={() => {
										setIsMinimized(false);
										setPopoverOpen(true);
									}}
									size="icon"
									title="Open settings"
									variant="ghost"
								>
									<Maximize2 className="size-4" />
								</Button>
								<Button
									className="size-8 rounded-full text-primary-foreground/70 hover:bg-white/15 hover:text-primary-foreground"
									onClick={() => {
										setIsMinimized(false);
										reset();
									}}
									size="icon"
									title="Close and reset"
									variant="ghost"
								>
									<X className="size-4" />
								</Button>
							</div>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</>
	);
};

interface DurationStepperProps {
	label: string;
	value: number;
	onChange: (value: number) => void;
}

const DurationStepper = ({ label, value, onChange }: DurationStepperProps) => (
	<div className="flex items-center justify-between">
		<span className="text-muted-foreground text-sm">{label}</span>
		<div className="flex items-center gap-2">
			<Button
				className="size-7 rounded-lg"
				onClick={() => onChange(value - 1)}
				size="icon"
				variant="outline"
			>
				<Minus className="size-3.5" />
			</Button>
			<span className="w-12 text-center font-semibold text-sm tabular-nums">
				{value} min
			</span>
			<Button
				className="size-7 rounded-lg"
				onClick={() => onChange(value + 1)}
				size="icon"
				variant="outline"
			>
				<Plus className="size-3.5" />
			</Button>
		</div>
	</div>
);

interface ToggleChipProps {
	label: string;
	active: boolean;
	onClick: () => void;
	icon?: typeof Bell;
}

const ToggleChip = ({
	label,
	active,
	onClick,
	icon: Icon,
}: ToggleChipProps) => (
	<Button
		className="flex-1 gap-1.5 rounded-lg text-xs"
		onClick={onClick}
		size="sm"
		variant={active ? "primary" : "outline"}
	>
		{Icon && <Icon className="size-3.5" />}
		{label}
	</Button>
);
