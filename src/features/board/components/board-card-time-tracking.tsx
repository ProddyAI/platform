"use client";

import { useMutation } from "convex/react";
import { Clock } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";

interface BoardCardTimeTrackingProps {
	cardId: Id<"cards">;
	estimate?: number;
	timeSpent?: number;
}

export const BoardCardTimeTracking: React.FC<BoardCardTimeTrackingProps> = ({
	cardId,
	estimate = 0,
	timeSpent = 0,
}) => {
	const [localEstimate, setLocalEstimate] = useState(estimate);
	const [localTimeSpent, setLocalTimeSpent] = useState(timeSpent);

	const updateTimeTracking = useMutation(api.board.updateTimeTracking);

	const handleUpdateEstimate = async (value: number) => {
		setLocalEstimate(value);
		try {
			await updateTimeTracking({
				cardId,
				estimate: value,
			});
		} catch (error) {
			console.error("Failed to update estimate:", error);
		}
	};

	const handleUpdateTimeSpent = async (value: number) => {
		setLocalTimeSpent(value);
		try {
			await updateTimeTracking({
				cardId,
				timeSpent: value,
			});
		} catch (error) {
			console.error("Failed to update time spent:", error);
		}
	};

	const handleAddTime = async (hours: number) => {
		const newTime = Math.max(0, localTimeSpent + hours);
		await handleUpdateTimeSpent(newTime);
	};

	const progressPercentage =
		localEstimate > 0 ? (localTimeSpent / localEstimate) * 100 : 0;

	return (
		<div className="space-y-3">
			{/* Header */}
			<div className="flex items-center gap-2">
				<Clock className="w-4 h-4" />
				<h3 className="text-sm font-semibold">Time Tracking</h3>
			</div>

			{/* Estimate Input */}
			<div className="space-y-1.5">
				<Label className="text-xs">Estimate (hours)</Label>
				<Input
					className="h-8 text-sm"
					min="0"
					onChange={(e) => handleUpdateEstimate(Number(e.target.value))}
					placeholder="0"
					step="0.5"
					type="number"
					value={localEstimate}
				/>
			</div>

			{/* Time Spent */}
			<div className="space-y-1.5">
				<Label className="text-xs">Time Spent (hours)</Label>
				<div className="flex items-center gap-2">
					<Input
						className="h-8 text-sm flex-1"
						min="0"
						onChange={(e) => handleUpdateTimeSpent(Number(e.target.value))}
						placeholder="0"
						step="0.5"
						type="number"
						value={localTimeSpent}
					/>
					<div className="flex gap-1">
						<Button
							className="h-8 px-2 text-xs"
							onClick={() => handleAddTime(0.25)}
							size="sm"
							variant="outline"
						>
							+15m
						</Button>
						<Button
							className="h-8 px-2 text-xs"
							onClick={() => handleAddTime(0.5)}
							size="sm"
							variant="outline"
						>
							+30m
						</Button>
						<Button
							className="h-8 px-2 text-xs"
							onClick={() => handleAddTime(1)}
							size="sm"
							variant="outline"
						>
							+1h
						</Button>
					</div>
				</div>
			</div>

			{/* Progress bar */}
			{localEstimate > 0 && (
				<div className="space-y-1.5">
					<div className="flex items-center justify-between text-xs">
						<span className="text-muted-foreground">Progress</span>
						<span className="font-medium">
							{localTimeSpent}h / {localEstimate}h
							<span className="text-muted-foreground ml-1">
								({Math.round(progressPercentage)}%)
							</span>
						</span>
					</div>
					<Progress className="h-2" value={Math.min(progressPercentage, 100)} />
					{progressPercentage > 100 && (
						<p className="text-xs text-orange-600 dark:text-orange-400">
							Over estimate by {(localTimeSpent - localEstimate).toFixed(1)}h
						</p>
					)}
				</div>
			)}
		</div>
	);
};
