"use client";

import { shallow } from "@liveblocks/client";
import { memo } from "react";
import {
	useOthersConnectionIds,
	useOthersMapped,
} from "@/../liveblocks.config";
import { Path } from "@/features/canvas/components/path";
import { colorToCSS } from "@/lib/utils";
import { LiveCursor } from "./live-cursor";

type DrawingOther = {
	pencilDraft?: number[][] | null;
	penColor?: { r: number; g: number; b: number } | null;
};

type LiveCursorsPresenceProps = {
	variant?: "canvas" | "notes";
	showDrawingPaths?: boolean;
};

const Cursors = ({ variant }: { variant: "canvas" | "notes" }) => {
	const ids = useOthersConnectionIds();

	return (
		<>
			{ids.map((connectionId) => (
				<LiveCursor
					connectionId={connectionId}
					key={connectionId}
					variant={variant}
				/>
			))}
		</>
	);
};

const DrawingPaths = () => {
	const others = useOthersMapped(
		(other) => ({
			pencilDraft: other.presence.pencilDraft,
			penColor: other.presence.penColor,
		}),
		shallow
	);

	return (
		<>
			{others.map(([key, other]) => {
				const drawing = other as DrawingOther;
				if (drawing?.pencilDraft) {
					return (
						<g key={key}>
							<Path
								fill={drawing.penColor ? colorToCSS(drawing.penColor) : "#000"}
								points={drawing.pencilDraft}
								x={0}
								y={0}
							/>
						</g>
					);
				}

				return null;
			})}
		</>
	);
};

export const LiveCursorsPresence = memo(
	({
		variant = "canvas",
		showDrawingPaths = true,
	}: LiveCursorsPresenceProps) => {
		return (
			<>
				{variant === "canvas" && showDrawingPaths && <DrawingPaths />}
				<Cursors variant={variant} />
			</>
		);
	}
);

LiveCursorsPresence.displayName = "LiveCursorsPresence";
