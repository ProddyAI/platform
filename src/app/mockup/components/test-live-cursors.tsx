"use client";

import { MousePointer2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface LiveCursor {
	id: string;
	name: string;
	color: string;
	x: number;
	y: number;
	lastActivity: number;
	isActive: boolean;
	isTyping: boolean;
	activity: "viewing" | "editing" | "selecting" | "idle";
	targetElement?: string;
}

interface TestLiveCursorsProps {
	enabled?: boolean;
	maxCursors?: number;
}

const DEMO_USERS = [
	{ name: "Alex Rodriguez", color: "#3b82f6" },
	{ name: "Sarah Johnson", color: "#10b981" },
	{ name: "Maya Patel", color: "#f59e0b" },
	{ name: "David Kim", color: "#ef4444" },
	{ name: "Lisa Chen", color: "#8b5cf6" },
];

const getRandomPosition = () => ({
	x: Math.random() * (window.innerWidth - 200) + 100,
	y: Math.random() * (window.innerHeight - 200) + 100,
});

const getRandomMovement = () => ({
	dx: (Math.random() - 0.5) * 4,
	dy: (Math.random() - 0.5) * 4,
});

export const TestLiveCursors = ({
	enabled = true,
	maxCursors = 3,
}: TestLiveCursorsProps) => {
	const [cursors, setCursors] = useState<LiveCursor[]>([]);
	const [isClient, setIsClient] = useState(false);
	const _intervalRef = useRef<NodeJS.Timeout | null>(null);
	const animationFrameRef = useRef<number | null>(null);
	const movementRef = useRef<{ [key: string]: { dx: number; dy: number } }>({});
	const lastUpdateRef = useRef<number>(0);

	useEffect(() => {
		setIsClient(true);
	}, []);

	useEffect(() => {
		if (!enabled || !isClient) return;

		// Initialize cursors
		const initializeCursors = () => {
			const numCursors = Math.min(maxCursors, DEMO_USERS.length);
			const selectedUsers = DEMO_USERS.slice(0, numCursors);

			const initialCursors = selectedUsers.map((user, index) => {
				const position = getRandomPosition();
				const cursorId = `cursor-${index}`;
				movementRef.current[cursorId] = getRandomMovement();

				return {
					id: cursorId,
					name: user.name,
					color: user.color,
					x: position.x,
					y: position.y,
					lastActivity: Date.now(),
					isActive: true,
					isTyping: Math.random() < 0.3, // 30% chance of typing initially
					activity: (Math.random() < 0.5 ? "viewing" : "editing") as
						| "viewing"
						| "editing"
						| "selecting"
						| "idle",
					targetElement: undefined,
				};
			});

			setCursors(initialCursors);
		};

		// Animate cursors with requestAnimationFrame for smoother performance
		const animateCursors = (timestamp: number) => {
			// Throttle updates to ~60 FPS
			if (timestamp - lastUpdateRef.current < 16) {
				animationFrameRef.current = requestAnimationFrame(animateCursors);
				return;
			}
			lastUpdateRef.current = timestamp;

			setCursors((prev) =>
				prev.map((cursor) => {
					const movement = movementRef.current[cursor.id];
					if (!movement) return cursor;

					// Very smooth, slow movement
					let newX = cursor.x + movement.dx * 0.15;
					let newY = cursor.y + movement.dy * 0.15;

					// Simple boundary checking without bouncing effects
					if (newX <= 50 || newX >= window.innerWidth - 250) {
						movement.dx *= -1;
						newX = Math.max(50, Math.min(window.innerWidth - 250, newX));
					}
					if (newY <= 50 || newY >= window.innerHeight - 100) {
						movement.dy *= -1;
						newY = Math.max(50, Math.min(window.innerHeight - 100, newY));
					}

					// Very rarely change direction for smooth floating
					if (Math.random() < 0.0008) {
						const newMovement = getRandomMovement();
						movementRef.current[cursor.id] = {
							dx: newMovement.dx * 0.2,
							dy: newMovement.dy * 0.2,
						};
					}

					return {
						...cursor,
						x: newX,
						y: newY,
						lastActivity: Date.now(),
						isActive: true,
						isTyping: false,
						activity: "viewing" as const,
					};
				})
			);

			// Continue animation
			animationFrameRef.current = requestAnimationFrame(animateCursors);
		};

		// Initialize cursors after a short delay
		const initTimeout = setTimeout(() => {
			initializeCursors();
			// Start animation loop
			animationFrameRef.current = requestAnimationFrame(animateCursors);
		}, 1000);

		return () => {
			clearTimeout(initTimeout);
			if (animationFrameRef.current) {
				cancelAnimationFrame(animationFrameRef.current);
			}
		};
	}, [enabled, maxCursors, isClient]);

	if (!enabled || !isClient) return null;

	return (
		<div className="fixed inset-0 pointer-events-none z-50">
			{cursors.map((cursor) => (
				<div
					key={cursor.id}
					className="absolute"
					style={{
						transform: `translate3d(${cursor.x}px, ${cursor.y}px, 0)`,
						zIndex: 9999,
					}}
				>
					{/* Cursor Icon */}
					<MousePointer2
						className="h-5 w-5 drop-shadow-lg"
						style={{
							fill: cursor.color,
							color: cursor.color,
						}}
					/>

					{/* User Name Label */}
					<div
						className="absolute left-6 top-0 px-2 py-1 rounded-md text-xs font-medium text-white whitespace-nowrap shadow-lg"
						style={{
							backgroundColor: cursor.color,
						}}
					>
						<span>{cursor.name}</span>
					</div>
				</div>
			))}
		</div>
	);
};

// Hook to control cursors in test pages
export const useTestLiveCursors = (enabled: boolean = true) => {
	const [showCursors, setShowCursors] = useState(false);

	useEffect(() => {
		if (!enabled) return;

		// Show cursors after page loads
		const timer = setTimeout(() => {
			setShowCursors(true);
		}, 2000);

		return () => clearTimeout(timer);
	}, [enabled]);

	return { showCursors, setShowCursors };
};
