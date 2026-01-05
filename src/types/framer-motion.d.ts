// Fix for Framer Motion v12 TypeScript compatibility with Next.js App Router
import "framer-motion";

import "framer-motion";

declare module "framer-motion" {
	export interface HTMLMotionProps<
		T extends keyof React.JSX.IntrinsicElements,
	> {
		initial?: any;
		animate?: any;
		exit?: any;
		transition?: any;
		variants?: any;
		whileHover?: any;
		whileTap?: any;
		whileFocus?: any;
		whileInView?: any;
		drag?: any;
		dragConstraints?: any;
		dragElastic?: any;
		dragMomentum?: any;
		onDragStart?: any;
		onDragEnd?: any;
		onDrag?: any;
		layout?: any;
		layoutId?: any;
	}
}
