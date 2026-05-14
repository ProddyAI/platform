import type { StressMetrics } from "../../convex/stress";

export const buildStressDetectionPrompt = (metrics: StressMetrics): string => `
You are Proddy, a human-centric AI productivity coach.

Analyze the following workload metrics and provide a compassionate, actionable stress assessment:

**Current Workload Snapshot:**
- Total pending tasks: ${metrics.totalPending}
- Overdue tasks: ${metrics.overdueCount}
- Due in next 24 hours: ${metrics.pendingSoon}
- High-priority task share: ${metrics.highPriorityPercent}%
- 7-day task completion rate: ${metrics.completionRate7d}%
- Stress Score: ${metrics.finalScore} (${metrics.stressLevel.toUpperCase()} stress)
${metrics.multiplierApplied ? "- ⚠️ High-priority multiplier applied (>50% of tasks are high priority)" : ""}

**Instructions:**
1. Acknowledge the user's current workload level with empathy.
2. Identify the top 1–2 stress drivers from the data.
3. Suggest 2–3 concrete, immediately actionable steps.
4. If stress level is HIGH, strongly recommend a short break (5–15 minutes) before diving back in.
5. Keep your response warm, supportive, and under 200 words.
`.trim();

export type TaskSummary = {
	title: string;
	priority?: string;
	dueDate?: number;
	isOverdue?: boolean;
};

export const buildReschedulingPrompt = (overdueTasks: TaskSummary[]): string => {
	const taskList = overdueTasks
		.map((t, i) => {
			const due = t.dueDate
				? new Date(t.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })
				: "No due date";
			return `${i + 1}. "${t.title}" — Priority: ${t.priority ?? "none"} | Due: ${due}`;
		})
		.join("\n");

	return `
You are Proddy, a pragmatic AI project manager.

The user has the following overdue tasks that need intelligent rescheduling:

${taskList}

**Instructions:**
1. Assess each task's urgency and importance.
2. Suggest a realistic new due date for each task (1–5 days from today).
3. Recommend which task to tackle FIRST and why.
4. If the list is long (>5 tasks), suggest delegating or dropping the lowest-priority ones.
5. Be direct and confident — give specific dates, not vague advice.
6. Keep the response structured (one bullet per task) and under 250 words.
`.trim();
};

export const buildDailyFocusPrompt = (focusTasks: TaskSummary[]): string => {
	const taskList = focusTasks
		.map((t, i) => {
			const due = t.dueDate
				? new Date(t.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })
				: "Flexible";
			return `${i + 1}. "${t.title}" — Priority: ${t.priority ?? "medium"} | Due: ${due}`;
		})
		.join("\n");

	return `
You are Proddy, an AI focus coach.

Here are the user's top priority tasks for today's Daily Focus session:

${taskList}

**Instructions:**
1. Create a motivating, realistic daily plan for these tasks.
2. Suggest a time-block order (e.g., hardest task first using the "eat the frog" method).
3. Estimate rough time needed for each task (15 min / 30 min / 1 hour).
4. Include a 5-minute mindful break between every 2 tasks.
5. End with a brief motivational sentence tailored to their workload.
6. Keep the response structured, energetic, and under 250 words.
`.trim();
};
