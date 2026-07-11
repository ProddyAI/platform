import type React from "react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// ─── STATUS MODALS ────────────────────────────────────────────────────────────

const STATUS_COLOR_PRESETS = [
	"#b4b4b4",
	"#5e6ad2",
	"#f2c94c",
	"#6938ef",
	"#00b341",
	"#eb5757",
	"#4ea7fc",
	"#e07b39",
	"#26bde9",
	"#f97316",
];

interface StatusColorPickerProps {
	color: string;
	setColor: (v: string) => void;
}

const StatusColorPicker = ({ color, setColor }: StatusColorPickerProps) => (
	<div className="space-y-2">
		<p className="text-xs text-muted-foreground">Color</p>
		<div className="flex gap-2 flex-wrap">
			{STATUS_COLOR_PRESETS.map((c) => (
				<button
					aria-label={`Select color ${c}`}
					aria-pressed={color === c}
					className={cn(
						"size-7 rounded-full border-2 transition-[transform,border-color] duration-fast motion-reduce:transition-none",
						"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
						color === c
							? "border-foreground scale-110"
							: "border-transparent hover:border-muted-foreground/40"
					)}
					key={c}
					onClick={() => setColor(c)}
					style={{ backgroundColor: c }}
					type="button"
				/>
			))}
		</div>
		<div className="flex items-center gap-2">
			<span className="text-xs text-muted-foreground">Custom:</span>
			<input
				aria-label="Custom status color"
				className="size-8 rounded cursor-pointer border border-border"
				onChange={(e) => setColor(e.target.value)}
				type="color"
				value={color}
			/>
			<span className="text-xs font-mono text-muted-foreground">{color}</span>
		</div>
	</div>
);

interface BoardAddStatusModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	name: string;
	setName: (v: string) => void;
	color: string;
	setColor: (v: string) => void;
	onAdd: () => void;
}

export const BoardAddStatusModal: React.FC<BoardAddStatusModalProps> = ({
	open,
	onOpenChange,
	name,
	setName,
	color,
	setColor,
	onAdd,
}) => {
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (open) {
			inputRef.current?.focus();
		}
	}, [open]);

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Add status</DialogTitle>
					<DialogDescription>Create a new status column.</DialogDescription>
				</DialogHeader>
				<Input
					onChange={(e) => setName(e.target.value)}
					onKeyDown={(e) => e.key === "Enter" && onAdd()}
					placeholder="Status name (e.g. In Progress)"
					ref={inputRef}
					value={name}
				/>
				<StatusColorPicker color={color} setColor={setColor} />
				<DialogFooter>
					<DialogClose asChild>
						<Button variant="outline">Cancel</Button>
					</DialogClose>
					<Button disabled={!name.trim()} onClick={onAdd}>
						Add status
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};

interface BoardEditStatusModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	name: string;
	setName: (v: string) => void;
	color: string;
	setColor: (v: string) => void;
	onSave: () => void;
}

export const BoardEditStatusModal: React.FC<BoardEditStatusModalProps> = ({
	open,
	onOpenChange,
	name,
	setName,
	color,
	setColor,
	onSave,
}) => {
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (open) {
			inputRef.current?.focus();
		}
	}, [open]);

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Edit status</DialogTitle>
					<DialogDescription>
						Rename the status or change its color.
					</DialogDescription>
				</DialogHeader>
				<Input
					onChange={(e) => setName(e.target.value)}
					onKeyDown={(e) => e.key === "Enter" && onSave()}
					placeholder="Status name"
					ref={inputRef}
					value={name}
				/>
				<StatusColorPicker color={color} setColor={setColor} />
				<DialogFooter>
					<DialogClose asChild>
						<Button variant="outline">Cancel</Button>
					</DialogClose>
					<Button disabled={!name.trim()} onClick={onSave}>
						Save
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};

interface BoardDeleteStatusModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onDelete: () => void;
	statusName?: string;
}

export const BoardDeleteStatusModal: React.FC<BoardDeleteStatusModalProps> = ({
	open,
	onOpenChange,
	onDelete,
	statusName,
}) => {
	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Delete status</DialogTitle>
					<DialogDescription>
						Delete &ldquo;{statusName}&rdquo; and all its issues? This cannot be
						undone.
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<DialogClose asChild>
						<Button variant="outline">Cancel</Button>
					</DialogClose>
					<Button onClick={onDelete} variant="destructive">
						Delete
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
