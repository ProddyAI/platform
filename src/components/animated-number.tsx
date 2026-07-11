"use client";

import { animate, useMotionValue, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface AnimatedNumberProps {
	value: number;
	format?: (n: number) => string;
	duration?: number;
	className?: string;
}

// Count-up numeral used inside stat tiles. Animates from the previous value to
// the new one on mount/update; renders the final value statically when the user
// prefers reduced motion. Always tabular-nums so digits don't jitter width.
export const AnimatedNumber = ({
	value,
	format = (n) => Math.round(n).toLocaleString(),
	duration = 0.5,
	className,
}: AnimatedNumberProps) => {
	const reduceMotion = useReducedMotion();
	const motionValue = useMotionValue(value);
	const [display, setDisplay] = useState(() => format(value));

	useEffect(() => {
		if (reduceMotion) {
			setDisplay(format(value));
			return;
		}

		const controls = animate(motionValue, value, {
			duration,
			ease: "easeOut",
			onUpdate: (latest) => setDisplay(format(latest)),
		});

		return () => controls.stop();
	}, [value, duration, reduceMotion, format, motionValue]);

	return <span className={cn("tabular-nums", className)}>{display}</span>;
};
