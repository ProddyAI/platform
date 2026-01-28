import {
	CalendarIcon,
	FileText,
	ImageIcon,
	PaintBucket,
	Smile,
	XIcon,
} from "lucide-react";
import Image from "next/image";
import Quill, { type QuillOptions } from "quill";
import type { Delta, Op } from "quill/core";
import "quill/dist/quill.snow.css";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import {
	type MutableRefObject,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { MdSend } from "react-icons/md";
import { PiTextAa } from "react-icons/pi";
import { toast } from "sonner";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/features/auth/api/use-current-user";
import { useCreateNote } from "@/features/notes/api/use-create-note";
import { useChannelId } from "@/hooks/use-channel-id";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import { createMentionElement } from "@/lib/mention-handler";
import { cn } from "@/lib/utils";

import { CalendarPicker } from "./calendar-picker";
import { ChannelPicker } from "./channel-picker";
import { EmojiPopover } from "./emoji-popover";
import { Hint } from "./hint";
import { MentionPicker } from "./mention-picker";

type EditorValue = {
	image: File | null;
	body: string;
	calendarEvent?: {
		date: Date;
		time?: string;
	};
};

interface EditorProps {
	onSubmit: ({ image, body }: EditorValue) => void;
	onCancel?: () => void;
	placeholder?: string;
	defaultValue?: Delta | Op[];
	disabled?: boolean;
	innerRef?: MutableRefObject<Quill | null>;
	variant?: "create" | "update";
	disableMentions?: boolean;
}

const Editor = ({
	onCancel,
	onSubmit,
	placeholder = "Write something...",
	defaultValue = [],
	disabled = false,
	innerRef,
	variant = "create",
	disableMentions = false,
}: EditorProps) => {
	const router = useRouter();
	const workspaceId = useWorkspaceId();
	const channelId = useChannelId();
	const [text, setText] = useState("");
	const [image, setImage] = useState<File | null>(null);
	const [isToolbarVisible, setIsToolbarVisible] = useState(true);
	const [calendarPickerOpen, setCalendarPickerOpen] = useState(false);
	const [mentionPickerOpen, setMentionPickerOpen] = useState(false);
	const [lastKeyWasExclamation, setLastKeyWasExclamation] = useState(false);
	const [activeAutocomplete, setActiveAutocomplete] = useState<
		"mention" | "channel" | null
	>(null);
	const [mentionSearchQuery, setMentionSearchQuery] = useState("");
	const [selectedCalendarEvent, setSelectedCalendarEvent] = useState<{
		date: Date;
		time?: string;
	} | null>(null);
	const mentionPickerRef = useRef<HTMLDivElement>(null);

	// No need for custom module registration with our simpler approach

	const containerRef = useRef<HTMLDivElement>(null);
	const imageElementRef = useRef<HTMLInputElement>(null);
	const quillRef = useRef<Quill | null>(null);

	const submitRef = useRef(onSubmit);
	const placeholderRef = useRef(placeholder);
	const defaultValueRef = useRef(defaultValue);
	const disabledRef = useRef(disabled);

	useLayoutEffect(() => {
		submitRef.current = onSubmit;
		placeholderRef.current = placeholder;
		defaultValueRef.current = defaultValue;
		disabledRef.current = disabled;
	});

	// Add click outside handler to close the mention picker
	useEffect(() => {
		if (!mentionPickerOpen) return;

		const handleClickOutside = (e: MouseEvent) => {
			// If the click is outside the mention picker and not on the @ button, close it
			if (
				mentionPickerRef.current &&
				!mentionPickerRef.current.contains(e.target as Node) &&
				!(e.target as HTMLElement).closest('button[data-mention-button="true"]')
			) {
				setMentionPickerOpen(false);
				setActiveAutocomplete(null);
			}
		};

		// Add the event listener with a slight delay to prevent immediate closing
		const timeoutId = setTimeout(() => {
			document.addEventListener("mousedown", handleClickOutside);
		}, 100);

		return () => {
			clearTimeout(timeoutId);
			document.removeEventListener("mousedown", handleClickOutside);
		};
	}, [mentionPickerOpen]);

	useEffect(() => {
		if (!containerRef.current) return;

		const container = containerRef.current;
		const editorContainer = container.appendChild(
			container.ownerDocument.createElement("div")
		);

		const options: QuillOptions = {
			modules: {
				toolbar: [
					["bold", "italic", "strike"],
					[{ list: "ordered" }, { list: "bullet" }],
				],
				keyboard: {
					bindings: {
						enter: {
							key: "Enter",
							handler: () => {
								const text = quill.getText();

								if (!imageElementRef.current || !submitRef.current) return;

								const addedImage = imageElementRef.current.files?.[0] || null;

								const isEmpty =
									!addedImage &&
									text.replace(/<[^>]*>/g, "").trim().length === 0;

								if (isEmpty) return;

								const body = JSON.stringify(quill.getContents());

								submitRef.current({ body, image: addedImage });
							},
						},
						shift_enter: {
							key: "Enter",
							shiftKey: true,
							handler: () => {
								quill.insertText(quill.getSelection()?.index || 0, "\n");
							},
						},
					},
				},
			},
			placeholder: placeholderRef.current,
			theme: "snow",
		};

		const quill = new Quill(editorContainer, options);

		quillRef.current = quill;
		quillRef.current.focus();

		if (innerRef) innerRef.current = quill;

		quill.setContents(defaultValueRef.current);
		setText(quill.getText());

		quill.on(Quill.events.TEXT_CHANGE, () => {
			const newText = quill.getText();
			const plainText = newText.replace(/\n+$/, "");
			setText(newText);

			// Check if the last character is "!" to trigger calendar picker
			if (plainText.trim().endsWith("!") && !lastKeyWasExclamation) {
				setLastKeyWasExclamation(true);
				setCalendarPickerOpen(true);
			} else if (!plainText.trim().endsWith("!")) {
				setLastKeyWasExclamation(false);
			}

			// Autocomplete triggers:
			// - "@" for users (disabled in direct messages)
			// - "#" for channels
			if (!activeAutocomplete) {
				if (!disableMentions && plainText.trim().endsWith("@")) {
					setActiveAutocomplete("mention");
					setMentionPickerOpen(true);
					setMentionSearchQuery("");
				} else if (plainText.trim().endsWith("#")) {
					setActiveAutocomplete("channel");
					setMentionPickerOpen(true);
					setMentionSearchQuery("");
				}
			} else {
				const triggerChar = activeAutocomplete === "mention" ? "@" : "#";
				const triggerIndex = plainText.lastIndexOf(triggerChar);

				if (triggerIndex >= 0) {
					const query = plainText.substring(triggerIndex + 1);
					setMentionSearchQuery(query);

					// If user types whitespace after the token, close the picker
					if (/\s/.test(query)) {
						setActiveAutocomplete(null);
						setMentionPickerOpen(false);
					}

					// If text becomes empty, close
					if (plainText.trim() === "") {
						setActiveAutocomplete(null);
						setMentionPickerOpen(false);
					}
				} else {
					// If the trigger is deleted, close
					setActiveAutocomplete(null);
					setMentionPickerOpen(false);
				}
			}

			// If the text is completely empty, close the mention picker
			if (plainText.trim() === "" && mentionPickerOpen) {
				setActiveAutocomplete(null);
				setMentionPickerOpen(false);
			}

			// Add event listener for Escape key
			document.addEventListener(
				"keydown",
				(e) => {
					if (e.key === "Escape" && mentionPickerOpen) {
						setMentionPickerOpen(false);
						setActiveAutocomplete(null);
					}
				},
				{ once: true }
			);
		});

		return () => {
			if (container) container.innerHTML = "";

			quill.off(Quill.events.TEXT_CHANGE);

			if (quillRef) quillRef.current = null;
			if (innerRef) innerRef.current = null;
		};
	}, [
		innerRef,
		activeAutocomplete,
		disableMentions,
		lastKeyWasExclamation,
		mentionPickerOpen,
	]);

	const toggleToolbar = () => {
		setIsToolbarVisible((current) => !current);

		const toolbarElement = containerRef.current?.querySelector(".ql-toolbar");

		if (toolbarElement) toolbarElement.classList.toggle("hidden");
	};

	const onEmojiSelect = (emoji: string) => {
		const quill = quillRef.current;

		if (!quill) return;

		quill.insertText(quill.getSelection()?.index || 0, emoji);
	};

	const isIOS = /iPad|iPhone|iPod|Mac/.test(navigator.userAgent);

	const isEmpty = !image && text.replace(/<[^>]*>/g, "").trim().length === 0;

	const handleCalendarSelect = (date: Date, time?: string) => {
		const quill = quillRef.current;
		if (!quill) return;

		// Save the calendar event for submission
		setSelectedCalendarEvent({ date, time });

		// Remove the exclamation mark that triggered the calendar
		const currentText = quill.getText();
		if (currentText.trim().endsWith("!")) {
			const newText = currentText
				.substring(0, currentText.lastIndexOf("!"))
				.trimEnd();
			quill.setText(`${newText} `);

			// Move cursor to the end
			const length = quill.getText().length;
			quill.setSelection(length, 0);
		}

		// Format the date and time for display
		let displayText = "";

		// Check if date is today or tomorrow
		const today = new Date();
		const tomorrow = new Date(today);
		tomorrow.setDate(tomorrow.getDate() + 1);

		// Calculate next week range (Monday to Sunday)
		const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
		const daysUntilNextMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
		const nextWeekStart = new Date(today);
		nextWeekStart.setDate(today.getDate() + daysUntilNextMonday);
		const nextWeekEnd = new Date(nextWeekStart);
		nextWeekEnd.setDate(nextWeekStart.getDate() + 6);

		// Format date based on when it is
		if (date.toDateString() === today.toDateString()) {
			displayText = "Today";
		} else if (date.toDateString() === tomorrow.toDateString()) {
			displayText = "Tomorrow";
		} else if (date >= nextWeekStart && date <= nextWeekEnd) {
			// For next week dates, show "Next week - Monday", "Next week - Tuesday", etc.
			const dayNames = [
				"Sunday",
				"Monday",
				"Tuesday",
				"Wednesday",
				"Thursday",
				"Friday",
				"Saturday",
			];
			displayText = `Next week - ${dayNames[date.getDay()]}`;
		} else {
			// Use standard date format for other dates
			displayText = date.toLocaleDateString();
		}

		// Add time if provided
		if (time) {
			displayText += ` at ${time}`;
		}

		// Insert the formatted date at the cursor position
		quill.insertText(
			quill.getSelection()?.index || quill.getText().length,
			`${displayText} `
		);
	};

	const handleMentionSelect = (memberId: Id<"members">, memberName: string) => {
		const quill = quillRef.current;
		if (!quill) {
			console.error("Quill editor not initialized");
			return;
		}

		// Remove the @ symbol that triggered the mention picker
		const currentText = quill.getText();
		const atIndex = currentText.lastIndexOf("@");

		if (atIndex >= 0) {
			// Delete from @ to current cursor position
			const currentPosition = quill.getSelection()?.index || currentText.length;

			quill.deleteText(atIndex, currentPosition - atIndex);

			// Create the mention HTML element with workspace ID
			const mentionHTML = createMentionElement(
				memberId,
				memberName,
				workspaceId
			);

			// Insert the mention HTML at the cursor position
			quill.clipboard.dangerouslyPasteHTML(atIndex, `${mentionHTML} `);

			// Move cursor to the end of the mention + space
			quill.setSelection(atIndex + mentionHTML.length + 1, 0);
			quill.focus();
		} else {
			console.error("Could not find @ symbol in text");

			// If we can't find the @ symbol, just insert the mention at the current cursor position
			const position = quill.getSelection()?.index || currentText.length;

			// Create the mention HTML element with workspace ID
			const mentionHTML = createMentionElement(
				memberId,
				memberName,
				workspaceId
			);

			// Insert the mention HTML at the cursor position
			quill.clipboard.dangerouslyPasteHTML(position, `${mentionHTML} `);

			// Move cursor to the end of the mention + space
			quill.setSelection(position + mentionHTML.length + 1, 0);
			quill.focus();
		}

		// Close the mention picker
		setActiveAutocomplete(null);
		setMentionPickerOpen(false);
	};

	const handleChannelSelect = (
		_channelId: Id<"channels">,
		channelName: string
	) => {
		const quill = quillRef.current;
		if (!quill) {
			console.error("Quill editor not initialized");
			return;
		}

		const currentText = quill.getText();
		const plainText = currentText.replace(/\n+$/, "");
		const hashIndex = plainText.lastIndexOf("#");

		if (hashIndex >= 0) {
			const currentPosition = quill.getSelection()?.index || plainText.length;
			quill.deleteText(hashIndex, currentPosition - hashIndex);
			const insertion = `#${channelName} `;
			quill.insertText(hashIndex, insertion);
			quill.setSelection(hashIndex + insertion.length, 0);
			quill.focus();
		} else {
			const position = quill.getSelection()?.index || plainText.length;
			const insertion = `#${channelName} `;
			quill.insertText(position, insertion);
			quill.setSelection(position + insertion.length, 0);
			quill.focus();
		}

		setActiveAutocomplete(null);
		setMentionPickerOpen(false);
	};

	// Get current user
	const { data: currentUser } = useCurrentUser();

	// Create message mutation
	const createMessage = useMutation(api.messages.create);

	// Create note mutation
	const { mutate: createNote } = useCreateNote();

	// State to track if we're creating a canvas or note
	const [isCreatingCanvas, setIsCreatingCanvas] = useState(false);
	const [isCreatingNote, setIsCreatingNote] = useState(false);

	// Function to create a new canvas with a live message
	const navigateToCanvas = async () => {
		if (!workspaceId || !channelId || !currentUser) {
			console.error("Cannot create canvas: missing required data");
			return;
		}

		try {
			// Show loading state
			setIsCreatingCanvas(true);

			// Generate a unique room ID for the canvas
			const timestamp = Date.now();
			const roomId = `canvas-${channelId}-${timestamp}`;

			// Create a live message in the channel
			await createMessage({
				workspaceId: workspaceId,
				channelId: channelId as Id<"channels">,
				body: JSON.stringify({
					type: "canvas-live",
					roomId: roomId,
					participants: [currentUser._id],
				}),
			});

			// Navigate to the canvas page with the room ID and new=true to force a new canvas
			// Use router.push for client-side navigation without page reload
			const url = `/workspace/${workspaceId}/channel/${channelId}/canvas?roomId=${roomId}&new=true&t=${timestamp}`;
			router.push(url);
		} catch (error) {
			console.error("Error creating canvas:", error);
			toast.error("Failed to create canvas");
			setIsCreatingCanvas(false);
		}
	};

	// Function to create a new note
	const createNewNote = async () => {
		if (!workspaceId || !channelId || !currentUser) {
			console.error("Cannot create note: missing required data");
			return;
		}

		try {
			// Show loading state
			setIsCreatingNote(true);

			// Create a new note with default values
			const defaultTitle = "Untitled Note";
			const defaultContent = JSON.stringify({ ops: [{ insert: "\n" }] });

			// Create the note in the database
			const newNoteId = await createNote({
				title: defaultTitle,
				content: defaultContent,
				workspaceId,
				channelId,
			});

			if (newNoteId) {
				// Create a message in the channel with the new note information
				await createMessage({
					workspaceId,
					channelId,
					body: JSON.stringify({
						type: "note",
						noteId: newNoteId,
						noteTitle: defaultTitle,
						previewContent: "New note created",
					}),
				});

				// Navigate to the notes page
				const url = `/workspace/${workspaceId}/channel/${channelId}/notes?noteId=${newNoteId}`;
				router.push(url);

				toast.success("Note created and shared in channel");
			}
		} catch (error) {
			console.error("Error creating note:", error);
			toast.error("Failed to create note");
		} finally {
			setIsCreatingNote(false);
		}
	};

	return (
		<div className="flex flex-col">
			<CalendarPicker
				open={calendarPickerOpen}
				onClose={() => setCalendarPickerOpen(false)}
				onSelect={handleCalendarSelect}
			/>

			<input
				type="file"
				accept="image/*"
				ref={imageElementRef}
				onChange={(e) => setImage(e.target.files?.[0] ?? null)}
				className="hidden"
			/>

			{/* Render the MentionPicker outside of any container for fixed positioning */}
			{mentionPickerOpen && (
				<div ref={mentionPickerRef}>
					{activeAutocomplete === "channel" ? (
						<ChannelPicker
							open={mentionPickerOpen}
							onClose={() => {
								setMentionPickerOpen(false);
								setActiveAutocomplete(null);
							}}
							onSelect={handleChannelSelect}
							searchQuery={mentionSearchQuery}
						/>
					) : (
						<MentionPicker
							open={mentionPickerOpen}
							onClose={() => {
								setMentionPickerOpen(false);
								setActiveAutocomplete(null);
							}}
							onSelect={handleMentionSelect}
							searchQuery={mentionSearchQuery}
						/>
					)}
				</div>
			)}

			<div
				className={cn(
					"flex flex-col overflow-hidden rounded-md border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-900 transition focus-within:border-slate-300 dark:focus-within:border-gray-600 focus-within:shadow-sm",
					disabled && "opacity-50"
				)}
			>
				<div ref={containerRef} className="h-full" />

				{!!image && (
					<div className="p-2">
						<div className="group/image relative flex size-[62px] items-center justify-center">
							<Hint label="Remove image">
								<button
									onClick={() => {
										setImage(null);

										imageElementRef.current!.value = "";
									}}
									className="absolute -right-2.5 -top-2.5 z-[4] hidden size-6 items-center justify-center rounded-full border-2 border-white bg-black/70 text-white hover:bg-black group-hover/image:flex"
								>
									<XIcon className="size-3.5" />
								</button>
							</Hint>

							<Image
								src={URL.createObjectURL(image)}
								alt="Uploaded image"
								fill
								className="overflow-hidden rounded-xl border object-cover"
							/>
						</div>
					</div>
				)}

				<div className="z-[5] flex px-2 pb-2">
					<Hint
						label={isToolbarVisible ? "Hide formatting" : "Show formatting"}
					>
						<Button
							disabled={disabled}
							size="iconSm"
							variant="ghost"
							onClick={toggleToolbar}
						>
							<PiTextAa className="size-4" />
						</Button>
					</Hint>

					<EmojiPopover onEmojiSelect={onEmojiSelect}>
						<Button disabled={disabled} size="iconSm" variant="ghost">
							<Smile className="size-4" />
						</Button>
					</EmojiPopover>

					{variant === "create" && (
						<>
							<Hint label="Image">
								<Button
									disabled={disabled}
									size="iconSm"
									variant="ghost"
									onClick={() => imageElementRef.current?.click()}
								>
									<ImageIcon className="size-4" />
								</Button>
							</Hint>
							<Hint label="Calendar">
								<Button
									disabled={disabled}
									size="iconSm"
									variant="ghost"
									onClick={() => setCalendarPickerOpen(true)}
								>
									<CalendarIcon className="size-4" />
								</Button>
							</Hint>
							{!disableMentions && (
								<Hint label="Mention User">
									<Button
										disabled={disabled}
										size="iconSm"
										variant="ghost"
										data-mention-button="true"
										onClick={() => {
											// Just open the mention picker directly
											setActiveAutocomplete("mention");
											setMentionPickerOpen(true);
											setMentionSearchQuery("");

											// Insert @ symbol at cursor position
											const quill = quillRef.current;
											if (quill) {
												const position =
													quill.getSelection()?.index || quill.getText().length;
												quill.insertText(position, "@");
												quill.focus();
											}
										}}
									>
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="16"
											height="16"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											strokeWidth="2"
											strokeLinecap="round"
											strokeLinejoin="round"
											className="size-4"
										>
											<circle cx="12" cy="12" r="4" />
											<path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8" />
										</svg>
									</Button>
								</Hint>
							)}
							{channelId && (
								<>
									<Hint label="New Canvas">
										<Button
											disabled={disabled || isCreatingCanvas}
											size="iconSm"
											variant="ghost"
											onClick={navigateToCanvas}
										>
											{isCreatingCanvas ? (
												<div className="animate-spin h-4 w-4 border-2 border-secondary border-t-transparent rounded-full" />
											) : (
												<PaintBucket className="size-4" />
											)}
										</Button>
									</Hint>
									<Hint label="New Note">
										<Button
											disabled={disabled || isCreatingNote}
											size="iconSm"
											variant="ghost"
											onClick={createNewNote}
										>
											{isCreatingNote ? (
												<div className="animate-spin h-4 w-4 border-2 border-secondary border-t-transparent rounded-full" />
											) : (
												<FileText className="size-4" />
											)}
										</Button>
									</Hint>
								</>
							)}
						</>
					)}

					{variant === "update" && (
						<div className="ml-auto flex items-center gap-x-2">
							<Button
								variant="outline"
								size="sm"
								onClick={onCancel}
								disabled={disabled}
							>
								Cancel
							</Button>

							<Button
								disabled={disabled || isEmpty}
								onClick={() => {
									if (!quillRef.current) return;

									onSubmit({
										body: JSON.stringify(quillRef.current.getContents()),
										image,
										calendarEvent: selectedCalendarEvent || undefined,
									});
								}}
								size="sm"
								className="bg-primary text-white hover:bg-primary/80"
							>
								Save
							</Button>
						</div>
					)}

					{variant === "create" && (
						<Button
							title="Send Message"
							disabled={disabled || isEmpty}
							onClick={() => {
								if (!quillRef.current) return;

								onSubmit({
									body: JSON.stringify(quillRef.current.getContents()),
									image,
									calendarEvent: selectedCalendarEvent || undefined,
								});
							}}
							className={cn(
								"ml-auto",
								isEmpty
									? "bg-white text-muted-foreground hover:bg-white/80"
									: "bg-primary text-white hover:bg-primary/80"
							)}
							size="iconSm"
						>
							<MdSend className="size-4" />
						</Button>
					)}
				</div>
			</div>

			{variant === "create" && (
				<div
					className={cn(
						"flex justify-end p-2 text-[10px] text-muted-foreground opacity-0 transition",
						!isEmpty && "opacity-100"
					)}
				>
					<p>
						<strong>Shift + {isIOS ? "Return" : "Enter"}</strong> to add a new
						line.
					</p>
				</div>
			)}
		</div>
	);
};

export default Editor;
