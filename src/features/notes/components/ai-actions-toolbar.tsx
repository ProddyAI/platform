"use client";

import type { BlockNoteEditor as BlockNoteEditorType } from "@blocknote/core";
import {
	CheckSquare,
	ChevronDown,
	FileText,
	Loader2,
	Maximize2,
	Sparkles,
	Wand2,
	X,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type AIAction = "clean" | "tasks" | "summarize" | "expand";

interface AIActionConfig {
	id: AIAction;
	label: string;
	description: string;
	icon: React.ReactNode;
	endpoint: string;
	insertMode: "replace" | "append";
}

const AI_ACTIONS: AIActionConfig[] = [
	{
		id: "clean",
		label: "Clean Up",
		description: "Fix grammar & improve clarity",
		icon: <Wand2 className="h-4 w-4" />,
		endpoint: "/api/notes/ai/clean",
		insertMode: "replace",
	},
	{
		id: "tasks",
		label: "Convert to Tasks",
		description: "Extract actionable checklist",
		icon: <CheckSquare className="h-4 w-4" />,
		endpoint: "/api/notes/ai/tasks",
		insertMode: "append",
	},
	{
		id: "summarize",
		label: "Summarize",
		description: "Create a concise summary",
		icon: <FileText className="h-4 w-4" />,
		endpoint: "/api/notes/ai/summarize",
		insertMode: "append",
	},
	{
		id: "expand",
		label: "Expand",
		description: "Add more detail & examples",
		icon: <Maximize2 className="h-4 w-4" />,
		endpoint: "/api/notes/ai/expand",
		insertMode: "replace",
	},
];

interface AIActionsToolbarProps {
	editorRef: React.RefObject<BlockNoteEditorType | null>;
	isLoading?: boolean;
	className?: string;
}

export const AIActionsToolbar = ({
	editorRef,
	isLoading = false,
	className,
}: AIActionsToolbarProps) => {
	const [activeAction, setActiveAction] = useState<AIAction | null>(null);
	const [streamedText, setStreamedText] = useState("");
	const [isStreaming, setIsStreaming] = useState(false);
	const abortControllerRef = useRef<AbortController | null>(null);

	const isDisabled = isLoading || isStreaming;

	const handleCancel = useCallback(() => {
		abortControllerRef.current?.abort();
		setIsStreaming(false);
		setActiveAction(null);
		setStreamedText("");
	}, []);

	const runAIAction = useCallback(
		async (action: AIActionConfig) => {
			if (!editorRef.current) {
				toast.error("Editor not ready");
				return;
			}

			const editor = editorRef.current;

			// Get current content as markdown
			let currentContent: string;
			try {
				currentContent = await editor.blocksToMarkdownLossy();
			} catch {
				toast.error("Could not read editor content");
				return;
			}

			if (!currentContent.trim()) {
				toast.error("No content to process. Add some text first.");
				return;
			}

			setActiveAction(action.id);
			setIsStreaming(true);
			setStreamedText("");

			const abortController = new AbortController();
			abortControllerRef.current = abortController;

			try {
				const response = await fetch(action.endpoint, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ content: currentContent }),
					signal: abortController.signal,
				});

				if (!response.ok) {
					const errorData = await response.json().catch(() => ({}));
					throw new Error(
						(errorData as { error?: string }).error || `Request failed: ${response.status}`
					);
				}

				if (!response.body) {
					throw new Error("No response body");
				}

				// Stream the response as plain text (toTextStreamResponse format)
				const reader = response.body.getReader();
				const decoder = new TextDecoder();
				let accumulated = "";

				while (true) {
					const { done, value } = await reader.read();
					if (done) break;

					const chunk = decoder.decode(value, { stream: true });
					accumulated += chunk;
					setStreamedText(accumulated);
				}

				// Parse accumulated markdown into blocks and insert
				if (accumulated.trim()) {
					try {
						const newBlocks = await editor.tryParseMarkdownToBlocks(accumulated);

						if (newBlocks && newBlocks.length > 0) {
							editor.transact(() => {
								const currentBlocks = editor.document;

								if (action.insertMode === "replace") {
									editor.replaceBlocks(currentBlocks, newBlocks);
								} else {
									// Append after current content
									const lastBlock = currentBlocks[currentBlocks.length - 1];
									if (lastBlock) {
										editor.insertBlocks(newBlocks, lastBlock, "after");
									} else {
										editor.replaceBlocks(currentBlocks, newBlocks);
									}
								}
							});

							toast.success(`${action.label} applied!`);
						} else {
							toast.error("Could not parse AI response");
						}
					} catch (editorError) {
						console.error("Editor insertion error:", editorError);
						toast.error("Failed to insert AI content into editor");
					}
				}
			} catch (error) {
				if ((error as Error).name === "AbortError") {
					toast.info("AI action cancelled");
				} else {
					console.error(`[AI ${action.id}] Error:`, error);
					toast.error(
						error instanceof Error ? error.message : "AI action failed"
					);
				}
			} finally {
				setIsStreaming(false);
				setActiveAction(null);
				setStreamedText("");
				abortControllerRef.current = null;
			}
		},
		[editorRef]
	);

	return (
		<div
			className={cn(
				"flex items-center gap-1.5 px-3 py-2 border-b bg-gradient-to-r from-violet-50/80 to-blue-50/80 dark:from-violet-950/30 dark:to-blue-950/30 backdrop-blur-sm",
				className
			)}
		>
			{/* AI Label */}
			<div className="flex items-center gap-1.5 mr-1">
				<div className="flex items-center justify-center w-6 h-6 rounded-md bg-gradient-to-br from-violet-500 to-blue-600 shadow-sm">
					<Sparkles className="h-3.5 w-3.5 text-white" />
				</div>
				<span className="text-xs font-semibold text-violet-700 dark:text-violet-300 hidden sm:block">
					AI Actions
				</span>
			</div>

			{/* Divider */}
			<div className="w-px h-5 bg-border mx-0.5 hidden sm:block" />

			{/* Action Buttons - show directly on larger screens */}
			<div className="hidden md:flex items-center gap-1">
				{AI_ACTIONS.map((action) => (
					<Button
						className={cn(
							"h-7 px-2.5 text-xs gap-1.5 transition-all duration-200",
							activeAction === action.id &&
								"bg-violet-100 dark:bg-violet-900/50 text-violet-700 dark:text-violet-300"
						)}
						disabled={isDisabled}
						key={action.id}
						onClick={() => runAIAction(action)}
						title={action.description}
						variant="ghost"
					>
						{activeAction === action.id ? (
							<Loader2 className="h-3.5 w-3.5 animate-spin" />
						) : (
							action.icon
						)}
						<span className="hidden lg:inline">{action.label}</span>
					</Button>
				))}
			</div>

			{/* Dropdown for smaller screens */}
			<div className="md:hidden">
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							className="h-7 px-2.5 text-xs gap-1.5"
							disabled={isDisabled}
							variant="ghost"
						>
							{isStreaming ? (
								<Loader2 className="h-3.5 w-3.5 animate-spin" />
							) : (
								<Sparkles className="h-3.5 w-3.5" />
							)}
							AI
							<ChevronDown className="h-3 w-3" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start">
						{AI_ACTIONS.map((action, index) => (
							<>
								{index > 0 && index === 2 && <DropdownMenuSeparator key={`sep-${action.id}`} />}
								<DropdownMenuItem
									className="gap-2"
									key={action.id}
									onClick={() => runAIAction(action)}
								>
									{action.icon}
									<div>
										<div className="font-medium">{action.label}</div>
										<div className="text-xs text-muted-foreground">
											{action.description}
										</div>
									</div>
								</DropdownMenuItem>
							</>
						))}
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			{/* Streaming indicator */}
			{isStreaming && (
				<div className="flex items-center gap-2 ml-auto">
					<div className="flex items-center gap-1.5 text-xs text-violet-600 dark:text-violet-400">
						<div className="flex gap-0.5">
							<span className="w-1 h-1 rounded-full bg-violet-500 animate-bounce [animation-delay:-0.3s]" />
							<span className="w-1 h-1 rounded-full bg-violet-500 animate-bounce [animation-delay:-0.15s]" />
							<span className="w-1 h-1 rounded-full bg-violet-500 animate-bounce" />
						</div>
						<span className="hidden sm:block">
							{AI_ACTIONS.find((a) => a.id === activeAction)?.label}...
						</span>
					</div>
					<Button
						className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
						onClick={handleCancel}
						size="sm"
						title="Cancel"
						variant="ghost"
					>
						<X className="h-3.5 w-3.5" />
					</Button>
				</div>
			)}
		</div>
	);
};
