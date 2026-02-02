"use client";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types/types";
import { LiveObject } from "@liveblocks/client";
import { useQuery } from "convex/react";
import { nanoid } from "nanoid";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { api } from "@/../convex/_generated/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	convertMermaidToExcalidrawScene,
	normalizeMermaidCode,
} from "@/features/canvas/diagram-ai/mermaid";
import { LiveParticipants } from "@/features/live/components/live-participants";
import { generateUserColor } from "@/lib/placeholder-image";
import {
	useBroadcastEvent,
	useEventListener,
	useMutation,
	useOthers,
	useStorage,
	useUpdateMyPresence,
} from "../../../../liveblocks.config";

const STICKY_NOTE_CUSTOM_DATA = { proddy: { type: "sticky-note" } } as const;
const STICKY_NOTE_DEFAULT_WIDTH = 220;
const STICKY_NOTE_DEFAULT_HEIGHT = 160;
const _STICKY_NOTE_MIN_WIDTH = 120;
const _STICKY_NOTE_MIN_HEIGHT = 80;
const STICKY_NOTE_PADDING = 18;
const STICKY_NOTE_SHADOW_OFFSET = 6;

function isStickyNoteElement(el: any) {
	return el?.customData?.proddy?.type === "sticky-note";
}

function getStickyNoteDecorType(el: any): string | null {
	const t = el?.customData?.proddy?.type;
	if (t === "sticky-note-shadow") return t;
	return null;
}

function getStickyNoteParentId(el: any): string | null {
	const noteId = el?.customData?.proddy?.noteId;
	return typeof noteId === "string" ? noteId : null;
}

function isElementNewer(incoming: any, existing: any) {
	if (!existing) return true;
	if (
		typeof incoming?.version === "number" &&
		typeof existing?.version === "number"
	) {
		if (incoming.version !== existing.version)
			return incoming.version > existing.version;
	}
	if (
		typeof incoming?.updated === "number" &&
		typeof existing?.updated === "number"
	) {
		if (incoming.updated !== existing.updated)
			return incoming.updated > existing.updated;
	}
	// Fall back to versionNonce if present.
	if (incoming?.versionNonce && existing?.versionNonce) {
		return incoming.versionNonce !== existing.versionNonce;
	}
	return true;
}

const Excalidraw = dynamic(
	async () => {
		const mod = await import("@excalidraw/excalidraw");
		return mod.Excalidraw;
	},
	{
		ssr: false,
		loading: () => <div className="p-4">Loading canvas…</div>,
	}
);

const DEFAULT_APP_STATE: Record<string, any> = {
	viewBackgroundColor: "#0000",
	currentItemFontFamily: 1,
};

function sanitizeAppState(appState: any) {
	if (!appState || typeof appState !== "object") return {};
	// Excalidraw uses a non-serializable Map for collaborators.
	// Never persist or hydrate it.
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const { collaborators, ...rest } = appState;
	return rest;
}

type PersistedScene = {
	elements: any[];
	appState: Record<string, any>;
	files: Record<string, any>;
	version: number;
};

function _scenePointToViewport(point: { x: number; y: number }, appState: any) {
	const scrollX = typeof appState?.scrollX === "number" ? appState.scrollX : 0;
	const scrollY = typeof appState?.scrollY === "number" ? appState.scrollY : 0;
	const zoomValue =
		typeof appState?.zoom?.value === "number"
			? appState.zoom.value
			: typeof appState?.zoom === "number"
				? appState.zoom
				: 1;

	return {
		x: (point.x + scrollX) * zoomValue,
		y: (point.y + scrollY) * zoomValue,
	};
}

function getCommonBoundsFallback(elements: any[]) {
	let x1 = Number.POSITIVE_INFINITY;
	let y1 = Number.POSITIVE_INFINITY;
	let x2 = Number.NEGATIVE_INFINITY;
	let y2 = Number.NEGATIVE_INFINITY;

	for (const el of elements || []) {
		if (!el || el.isDeleted) continue;
		const x = typeof el.x === "number" ? el.x : 0;
		const y = typeof el.y === "number" ? el.y : 0;
		const w = typeof el.width === "number" ? el.width : 0;
		const h = typeof el.height === "number" ? el.height : 0;
		x1 = Math.min(x1, x);
		y1 = Math.min(y1, y);
		x2 = Math.max(x2, x + w);
		y2 = Math.max(y2, y + h);
	}

	if (
		!Number.isFinite(x1) ||
		!Number.isFinite(y1) ||
		!Number.isFinite(x2) ||
		!Number.isFinite(y2)
	) {
		return [0, 0, 0, 0] as [number, number, number, number];
	}

	return [x1, y1, x2, y2] as [number, number, number, number];
}

export const ExcalidrawCanvas = () => {
	const saveTimerRef = useRef<number | null>(null);
	const excalidrawApiRef = useRef<ExcalidrawImperativeAPI | null>(null);
	const excalidrawHostRef = useRef<HTMLDivElement | null>(null);
	const latestAppStateRef = useRef<any>(null);
	const excalidrawLibRef = useRef<any>(null);
	const [_excalidrawLibVersion, setExcalidrawLibVersion] = useState(0);
	const isApplyingRemoteSceneRef = useRef(false);
	const suppressBroadcastRef = useRef(false);
	const lastBroadcastedByIdRef = useRef(
		new Map<
			string,
			{ version?: number; versionNonce?: number; isDeleted?: boolean }
		>()
	);
	const lastAppliedVersionRef = useRef<number>(-1);
	const lastLocalWriteVersionRef = useRef<number>(-1);
	const currentVersionRef = useRef<number>(0);
	const isSyncingStickyDecorRef = useRef(false);
	const isAutoLockingToolRef = useRef(false);
	const [aiPrompt, setAiPrompt] = useState("");
	const [isGenerating, setIsGenerating] = useState(false);
	const [toolbarPortalTarget, setToolbarPortalTarget] =
		useState<HTMLElement | null>(null);

	const currentUser = useQuery(api.users.current);

	const ExcalidrawSidebar = excalidrawLibRef.current?.Sidebar as any;

	useEffect(() => {
		let cancelled = false;

		// Important: don't import '@excalidraw/excalidraw' at module scope.
		// It may touch DOM APIs and crash SSR in Next.
		import("@excalidraw/excalidraw")
			.then((mod) => {
				if (cancelled) return;
				excalidrawLibRef.current = mod;
				setExcalidrawLibVersion((v) => v + 1);
			})
			.catch(() => {
				// Best effort.
			});

		return () => {
			cancelled = true;
		};
	}, []);

	const updateMyPresence = useUpdateMyPresence();
	const others = useOthers();
	const broadcast = useBroadcastEvent();

	const hasExcalidrawStorage = useStorage((root) => Boolean(root.excalidraw));
	const needsExcalidrawNormalization = useStorage((root) => {
		const value = root.excalidraw as any;
		if (!value) return false;
		return typeof value.toObject !== "function";
	});
	const storedScene = useStorage((root) => {
		const value = root.excalidraw as any;
		if (!value) return null;
		if (typeof value.toObject === "function") return value.toObject();
		if (typeof value === "object") return value;
		return null;
	});

	useEffect(() => {
		const nextVersion =
			typeof (storedScene as any)?.version === "number"
				? (storedScene as any).version
				: 0;
		currentVersionRef.current = nextVersion;
	}, [storedScene]);

	const ensureExcalidrawStorage = useMutation(({ storage }) => {
		const existing = storage.get("excalidraw") as any;
		if (existing) return;

		storage.set(
			"excalidraw",
			new LiveObject<PersistedScene>({
				elements: [],
				appState: DEFAULT_APP_STATE,
				files: {},
				version: 1,
			})
		);
	}, []);

	// Portal the AI Format trigger into Excalidraw's main tool palette (white box).
	useEffect(() => {
		let cancelled = false;
		let attempts = 0;
		const maxAttempts = 25;

		const tryResolveTarget = () => {
			if (cancelled) return;
			attempts += 1;

			const host = excalidrawHostRef.current;
			const target =
				(host?.querySelector(
					".excalidraw .App-toolbar-container .shapes-section"
				) as HTMLElement | null) ||
				(host?.querySelector(
					".excalidraw .App-toolbar .shapes-section"
				) as HTMLElement | null) ||
				(host?.querySelector(
					".excalidraw .shapes-section"
				) as HTMLElement | null) ||
				(host?.querySelector(
					".excalidraw .App-toolbar__content"
				) as HTMLElement | null);

			if (target) {
				setToolbarPortalTarget(target);
				return;
			}

			if (attempts < maxAttempts) {
				window.setTimeout(tryResolveTarget, 120);
			}
		};

		tryResolveTarget();
		return () => {
			cancelled = true;
		};
	}, []);

	const normalizeExcalidrawStorage = useMutation(({ storage }) => {
		const existing = storage.get("excalidraw") as any;
		if (!existing) return;
		if (typeof existing.toObject === "function") return;

		const raw = typeof existing === "object" && existing ? existing : {};
		const migrated: PersistedScene = {
			elements: Array.isArray((raw as any).elements)
				? (raw as any).elements
				: [],
			appState: {
				...DEFAULT_APP_STATE,
				...sanitizeAppState((raw as any).appState),
			},
			files:
				(raw as any).files && typeof (raw as any).files === "object"
					? (raw as any).files
					: {},
			version:
				typeof (raw as any).version === "number" ? (raw as any).version : 1,
		};

		storage.set("excalidraw", new LiveObject<PersistedScene>(migrated));
		storage.set("lastUpdate", Date.now());
	}, []);

	const persistScene = useMutation(({ storage }, scene: PersistedScene) => {
		const excalidraw = storage.get("excalidraw") as any;

		const safeScene: PersistedScene = {
			elements: Array.isArray(scene.elements) ? scene.elements : [],
			appState: sanitizeAppState(scene.appState),
			files: scene.files && typeof scene.files === "object" ? scene.files : {},
			version: typeof scene.version === "number" ? scene.version : 1,
		};

		if (!excalidraw) {
			storage.set("excalidraw", new LiveObject<PersistedScene>(safeScene));
		} else {
			excalidraw.set("elements", safeScene.elements);
			excalidraw.set("appState", safeScene.appState);
			excalidraw.set("files", safeScene.files);
			excalidraw.set("version", safeScene.version);
		}

		storage.set("lastUpdate", Date.now());
	}, []);

	const generateDiagramFromPrompt = async () => {
		const api = excalidrawApiRef.current;
		if (!api) return;

		const prompt = aiPrompt.trim();
		if (!prompt) {
			toast.error("Enter a prompt first");
			return;
		}

		try {
			setIsGenerating(true);

			const res = await fetch("/api/smart/diagram", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ prompt }),
			});

			const body = await res.json().catch(() => ({}));
			if (!res.ok) {
				const message =
					body?.error || body?.message || "Diagram generation failed";
				throw new Error(message);
			}

			const mermaidRaw = typeof body?.mermaid === "string" ? body.mermaid : "";
			const mermaid = normalizeMermaidCode(mermaidRaw);
			if (!mermaid) {
				toast.error("AI returned empty Mermaid");
				return;
			}

			const { elements: newElements, files } =
				await convertMermaidToExcalidrawScene(mermaid);
			if (!newElements.length) {
				toast.error("Could not convert Mermaid to shapes");
				return;
			}

			// Add any generated files (e.g. embedded images).
			const maybeFiles: any = files as any;
			if (Array.isArray(maybeFiles)) {
				api.addFiles(maybeFiles);
			} else if (maybeFiles && typeof maybeFiles === "object") {
				const values = Object.values(maybeFiles);
				if (values.length) api.addFiles(values as any);
			}

			// Center the generated diagram in the current viewport.
			const appState: any = api.getAppState();
			const zoom =
				typeof appState?.zoom?.value === "number" ? appState.zoom.value : 1;
			const viewportCenterX = -appState.scrollX + appState.width / 2 / zoom;
			const viewportCenterY = -appState.scrollY + appState.height / 2 / zoom;

			const getCommonBounds = excalidrawLibRef.current?.getCommonBounds as
				| ((els: any[]) => [number, number, number, number])
				| undefined;
			const [x1, y1, x2, y2] = (getCommonBounds || getCommonBoundsFallback)(
				newElements as any
			);
			const diagramCenterX = (x1 + x2) / 2;
			const diagramCenterY = (y1 + y2) / 2;
			const dx = viewportCenterX - diagramCenterX;
			const dy = viewportCenterY - diagramCenterY;

			const moved = (newElements as any[]).map((el) => ({
				...el,
				x: (el?.x ?? 0) + dx,
				y: (el?.y ?? 0) + dy,
				locked: false,
			}));

			const existing = api.getSceneElements() as any[];
			isApplyingRemoteSceneRef.current = true;
			try {
				api.updateScene({
					elements: [...existing, ...moved],
					commitToHistory: true,
				} as any);
			} finally {
				isApplyingRemoteSceneRef.current = false;
			}

			toast.success("Diagram added");
		} catch (err: any) {
			toast.error(err?.message || "AI Format failed");
		} finally {
			setIsGenerating(false);
		}
	};

	const collapsibleSidebar = () => {
		const api = excalidrawApiRef.current;
		if (!api) return;
		api.toggleSidebar({ name: "ai-format", force: true });
	};

	useEffect(() => {
		if (!hasExcalidrawStorage) {
			ensureExcalidrawStorage();
		}
	}, [hasExcalidrawStorage, ensureExcalidrawStorage]);

	useEffect(() => {
		if (needsExcalidrawNormalization) {
			normalizeExcalidrawStorage();
		}
	}, [needsExcalidrawNormalization, normalizeExcalidrawStorage]);

	const [theme, setTheme] = useState<"light" | "dark">("light");

	useEffect(() => {
		const updateTheme = () => {
			const isDark = document.documentElement.classList.contains("dark");
			setTheme(isDark ? "dark" : "light");
		};

		updateTheme();

		const observer = new MutationObserver(updateTheme);
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class"],
		});

		return () => observer.disconnect();
	}, []);

	const initialData = useMemo(() => {
		if (!storedScene) {
			return {
				appState: DEFAULT_APP_STATE,
			};
		}

		return {
			elements: Array.isArray(storedScene.elements) ? storedScene.elements : [],
			appState: {
				...DEFAULT_APP_STATE,
				...sanitizeAppState(storedScene.appState || {}),
			},
			files: storedScene.files || {},
		};
	}, [storedScene]);

	useEffect(() => {
		const api = excalidrawApiRef.current;
		if (!api) return;
		if (!storedScene) return;

		const version =
			typeof (storedScene as any).version === "number"
				? (storedScene as any).version
				: 0;
		if (version === lastAppliedVersionRef.current) return;
		if (version === lastLocalWriteVersionRef.current) {
			lastAppliedVersionRef.current = version;
			return;
		}

		const nextScene = {
			elements: Array.isArray((storedScene as any).elements)
				? (storedScene as any).elements
				: [],
			appState: {
				...DEFAULT_APP_STATE,
				...sanitizeAppState((storedScene as any).appState || {}),
			},
			files: (storedScene as any).files || {},
		};

		isApplyingRemoteSceneRef.current = true;
		try {
			api.updateScene(nextScene as any);
		} finally {
			isApplyingRemoteSceneRef.current = false;
			lastAppliedVersionRef.current = version;
		}
	}, [storedScene]);

	// Sync Liveblocks cursor presence into Excalidraw collaborators for real-time cursors.
	useEffect(() => {
		const api = excalidrawApiRef.current;
		if (!api) return;
		// Intentionally do NOT sync collaborators into Excalidraw.
		// Excalidraw renders its own avatars/presence UI from the collaborators map,
		// which duplicates our Convex-based presence in the top-right.
		// We keep only the top-right `LiveParticipants` as the source of truth.
	}, []);

	// Receive incremental element updates and merge into current scene.
	useEventListener(({ event }) => {
		if (!event || (event as any).type !== "excalidraw:delta") return;

		const api = excalidrawApiRef.current;
		if (!api) return;

		const incomingElements = Array.isArray((event as any).elements)
			? (event as any).elements
			: [];
		if (!incomingElements.length) return;

		const existing = api.getSceneElements() as any[];
		const byId = new Map<string, any>(existing.map((el) => [el.id, el]));

		let didChange = false;
		for (const incoming of incomingElements) {
			if (!incoming?.id) continue;
			const current = byId.get(incoming.id);
			if (!current) {
				byId.set(incoming.id, incoming);
				didChange = true;
				continue;
			}

			if (isElementNewer(incoming, current)) {
				byId.set(incoming.id, incoming);
				didChange = true;
			}
		}

		if (!didChange) return;

		suppressBroadcastRef.current = true;
		try {
			api.updateScene({
				elements: Array.from(byId.values()),
				commitToHistory: false,
			} as any);
		} finally {
			suppressBroadcastRef.current = false;
		}
	});

	const insertStickyNote = async () => {
		const api = excalidrawApiRef.current;
		if (!api) return;

		if (!excalidrawLibRef.current) {
			const mod = await import("@excalidraw/excalidraw").catch(() => null);
			if (mod) {
				excalidrawLibRef.current = mod;
				setExcalidrawLibVersion((v) => v + 1);
			}
		}

		const appState: any = api.getAppState();
		const zoom =
			typeof appState?.zoom?.value === "number" ? appState.zoom.value : 1;
		const centerX = -appState.scrollX + appState.width / 2 / zoom;
		const centerY = -appState.scrollY + appState.height / 2 / zoom;

		// Sticky notes should look like paper, regardless of the user's current tool styling.
		const fillStyle = "solid";
		const backgroundColor = "#fff3bf";
		const strokeColor = backgroundColor;
		const strokeWidth = 0;
		const fontFamily = appState?.currentItemFontFamily ?? 1;
		const fontSize = appState?.currentItemFontSize ?? 20;

		const noteId = nanoid();
		const textId = nanoid();
		const shadowId = nanoid();
		const groupId = nanoid();

		const rectX = centerX - STICKY_NOTE_DEFAULT_WIDTH / 2;
		const rectY = centerY - STICKY_NOTE_DEFAULT_HEIGHT / 2;

		const shadowSkeleton = {
			type: "rectangle",
			id: shadowId,
			x: rectX + STICKY_NOTE_SHADOW_OFFSET,
			y: rectY + STICKY_NOTE_SHADOW_OFFSET,
			width: STICKY_NOTE_DEFAULT_WIDTH,
			height: STICKY_NOTE_DEFAULT_HEIGHT,
			fillStyle: "solid",
			backgroundColor: "#1f1f1f",
			strokeColor: "#1f1f1f",
			strokeWidth: 0,
			roughness: 1,
			opacity: 12,
			roundness: null,
			locked: false,
			groupIds: [groupId],
			customData: { proddy: { type: "sticky-note-shadow", noteId } },
		} as any;

		const rectSkeleton = {
			type: "rectangle",
			id: noteId,
			x: rectX,
			y: rectY,
			width: STICKY_NOTE_DEFAULT_WIDTH,
			height: STICKY_NOTE_DEFAULT_HEIGHT,
			fillStyle,
			backgroundColor,
			strokeColor,
			strokeWidth,
			roughness: 1,
			roundness: null,
			boundElements: [{ id: textId, type: "text" }],
			groupIds: [groupId],
			customData: STICKY_NOTE_CUSTOM_DATA,
		} as any;

		const textSkeleton = {
			type: "text",
			id: textId,
			x: rectX + STICKY_NOTE_PADDING,
			y: rectY + STICKY_NOTE_PADDING,
			width: STICKY_NOTE_DEFAULT_WIDTH - STICKY_NOTE_PADDING * 2,
			height: STICKY_NOTE_DEFAULT_HEIGHT - STICKY_NOTE_PADDING * 2,
			text: "",
			fontSize,
			fontFamily,
			textAlign: "left",
			verticalAlign: "top",
			lineHeight: 1.25,
			strokeColor: appState?.currentItemTextColor ?? "#1f1f1f",
			backgroundColor: "transparent",
			containerId: noteId,
			groupIds: [groupId],
		} as any;

		const convertToExcalidrawElements = excalidrawLibRef.current
			?.convertToExcalidrawElements as any;
		const restoreElements = excalidrawLibRef.current?.restoreElements as any;
		const newElements =
			restoreElements && convertToExcalidrawElements
				? restoreElements(
					convertToExcalidrawElements([
						shadowSkeleton,
						rectSkeleton,
						textSkeleton,
					]) as any,
					null
				)
				: ([shadowSkeleton, rectSkeleton, textSkeleton] as any[]);
		const existing = api.getSceneElements() as any[];

		const selection = Object.fromEntries(
			(newElements as any[]).filter((el) => el?.id).map((el) => [el.id, true])
		);

		api.updateScene({
			elements: [...existing, ...(newElements as any[])],
			commitToHistory: true,
			appState: {
				selectedElementIds: Object.keys(selection).length
					? selection
					: { [noteId]: true },
			},
		} as any);

		// Ensure the inserted note is visible even if the user is panned elsewhere.
		window.requestAnimationFrame(() => {
			try {
				(api as any).scrollToContent?.(newElements as any, { animate: true });
			} catch {
				// Best-effort. If scrollToContent isn't available, insertion still works.
			}
		});
	};

	// Keyboard shortcut: N to insert sticky note.
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement | null;
			const isTypingTarget =
				target?.tagName === "INPUT" ||
				target?.tagName === "TEXTAREA" ||
				(target as any)?.isContentEditable;
			if (isTypingTarget) return;
			if (e.key.toLowerCase() === "n") {
				e.preventDefault();
				insertStickyNote();
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [insertStickyNote]);

	useEffect(() => {
		return () => {
			if (saveTimerRef.current) {
				window.clearTimeout(saveTimerRef.current);
			}
		};
	}, []);

	return (
		<div className="h-full w-full" ref={excalidrawHostRef}>
			<div className="relative h-full w-full">
				<Excalidraw
					excalidrawAPI={(api) => {
						excalidrawApiRef.current = api;
					}}
					initialData={initialData}
					onChange={(elements: readonly any[], appState: any, files: any) => {
						latestAppStateRef.current = appState;
						if (isApplyingRemoteSceneRef.current) return;
						if (suppressBroadcastRef.current) return;
						if (isSyncingStickyDecorRef.current) return;
						if (isAutoLockingToolRef.current) return;

						// Keep the selected tool active until the user switches tools.
						// This mimics double-click "tool lock" behavior for all tools.
						const activeTool = appState?.activeTool;
						const activeType = activeTool?.type;
						const isLocked = Boolean(activeTool?.locked);
						const shouldAutoLock =
							activeType &&
							activeType !== "selection" &&
							activeType !== "hand" &&
							!isLocked;

						if (shouldAutoLock) {
							const api = excalidrawApiRef.current;
							if (api) {
								isAutoLockingToolRef.current = true;
								suppressBroadcastRef.current = true;
								try {
									api.updateScene({
										appState: {
											activeTool: {
												...activeTool,
												locked: true,
											},
										},
										commitToHistory: false,
									} as any);
								} finally {
									window.setTimeout(() => {
										isAutoLockingToolRef.current = false;
										suppressBroadcastRef.current = false;
									}, 0);
								}
								return;
							}
						}

						const safeAppState = sanitizeAppState(appState);

						const elementsArray = Array.isArray(elements)
							? Array.from(elements)
							: [];

						// Sticky notes are implemented as multiple elements (note + shadow + text).
						// Excalidraw allows "entering" a group on double-click (editingGroupId), which
						// would let users select/move the shadow separately. Prevent that so the sticky
						// always behaves like a single object.
						const editingGroupId = appState?.editingGroupId;
						if (typeof editingGroupId === "string" && editingGroupId.length) {
							const parentNote = elementsArray.find(
								(el) =>
									isStickyNoteElement(el) &&
									Array.isArray((el as any).groupIds) &&
									(el as any).groupIds.includes(editingGroupId)
							);
							if (parentNote) {
								const api = excalidrawApiRef.current;
								if (api) {
									isSyncingStickyDecorRef.current = true;
									suppressBroadcastRef.current = true;
									try {
										api.updateScene({
											appState: {
												editingGroupId: null,
												selectedElementIds: { [parentNote.id]: true },
											},
											commitToHistory: false,
										} as any);
									} finally {
										window.setTimeout(() => {
											isSyncingStickyDecorRef.current = false;
											suppressBroadcastRef.current = false;
										}, 0);
									}
									return;
								}
							}
						}

						// If the user clicks the shadow, redirect selection to the actual sticky note.
						// This makes the shadow feel "attached" and prevents accidental independent selection.
						const selectedIds = appState?.selectedElementIds;
						if (selectedIds && typeof selectedIds === "object") {
							const selectedKeys = Object.keys(selectedIds).filter(
								(k) => (selectedIds as any)[k]
							);
							const selectedShadow = selectedKeys
								.map((id) => elementsArray.find((el) => el?.id === id))
								.find(
									(el) => getStickyNoteDecorType(el) === "sticky-note-shadow"
								);

							if (selectedShadow) {
								const parentId = getStickyNoteParentId(selectedShadow);
								const parentNote = parentId
									? elementsArray.find(
										(el) => el?.id === parentId && isStickyNoteElement(el)
									)
									: null;
								if (parentNote) {
									const api = excalidrawApiRef.current;
									if (api) {
										isSyncingStickyDecorRef.current = true;
										suppressBroadcastRef.current = true;
										try {
											api.updateScene({
												appState: {
													selectedElementIds: { [parentNote.id]: true },
												},
												commitToHistory: false,
											} as any);
										} finally {
											window.setTimeout(() => {
												isSyncingStickyDecorRef.current = false;
												suppressBroadcastRef.current = false;
											}, 0);
										}
										return;
									}
								}
							}
						}

						// Sticky notes: keep the shadow element synced to the note element.
						// Notes should NOT auto-resize while typing; users can resize manually.
						let didSyncDecor = false;
						for (const el of elementsArray) {
							if (!el || el.type !== "rectangle" || el.isDeleted) continue;
							if (!isStickyNoteElement(el)) continue;

							const w = typeof el.width === "number" ? el.width : 0;
							const h = typeof el.height === "number" ? el.height : 0;
							const x = typeof el.x === "number" ? el.x : 0;
							const y = typeof el.y === "number" ? el.y : 0;

							const shadow = elementsArray.find(
								(candidate) =>
									candidate?.type === "rectangle" &&
									getStickyNoteDecorType(candidate) === "sticky-note-shadow" &&
									getStickyNoteParentId(candidate) === el.id
							);
							if (!shadow) continue;

							// Ensure existing shadows participate in group transforms.
							if (shadow.locked) {
								const mutateElement = excalidrawLibRef.current
									?.mutateElement as any;
								if (mutateElement) {
									mutateElement(shadow, { locked: false }, false);
								} else {
									(shadow as any).locked = false;
								}
								didSyncDecor = true;
							}

							const nextShadowX = x + STICKY_NOTE_SHADOW_OFFSET;
							const nextShadowY = y + STICKY_NOTE_SHADOW_OFFSET;
							if (
								Math.abs((shadow.x ?? 0) - nextShadowX) > 0.5 ||
								Math.abs((shadow.y ?? 0) - nextShadowY) > 0.5 ||
								Math.abs((shadow.width ?? 0) - w) > 0.5 ||
								Math.abs((shadow.height ?? 0) - h) > 0.5
							) {
								const mutateElement = excalidrawLibRef.current
									?.mutateElement as any;
								if (mutateElement) {
									mutateElement(
										shadow,
										{ x: nextShadowX, y: nextShadowY, width: w, height: h },
										false
									);
								} else {
									(shadow as any).x = nextShadowX;
									(shadow as any).y = nextShadowY;
									(shadow as any).width = w;
									(shadow as any).height = h;
								}
								didSyncDecor = true;
							}
						}

						if (didSyncDecor) {
							const api = excalidrawApiRef.current;
							if (api) {
								isSyncingStickyDecorRef.current = true;
								try {
									api.updateScene({
										elements: elementsArray,
										commitToHistory: false,
									} as any);
								} finally {
									window.setTimeout(() => {
										isSyncingStickyDecorRef.current = false;
									}, 0);
								}
								return;
							}
						}

						if (saveTimerRef.current) {
							window.clearTimeout(saveTimerRef.current);
						}

						// Broadcast incremental changes (low-latency). Persisting is still done via debounced snapshot.
						const lastById = lastBroadcastedByIdRef.current;
						const changed: any[] = [];
						for (const el of elementsArray) {
							if (!el?.id) continue;
							const prev = lastById.get(el.id);
							const nextSig = {
								version: el.version,
								versionNonce: el.versionNonce,
								isDeleted: el.isDeleted,
							};
							const didChange =
								!prev ||
								prev.version !== nextSig.version ||
								prev.versionNonce !== nextSig.versionNonce ||
								prev.isDeleted !== nextSig.isDeleted;
							if (didChange) changed.push(el);
							lastById.set(el.id, nextSig);
						}

						if (changed.length) {
							broadcast({
								type: "excalidraw:delta",
								elements: changed,
							} as any);
						}

						saveTimerRef.current = window.setTimeout(() => {
							const base = Math.max(
								currentVersionRef.current,
								lastLocalWriteVersionRef.current,
								Date.now() * 1000
							);
							const nextVersion = base + (Math.floor(Math.random() * 1000) + 1);
							lastLocalWriteVersionRef.current = nextVersion;

							persistScene({
								elements: elementsArray,
								appState: safeAppState,
								files: files && typeof files === "object" ? files : {},
								version: nextVersion,
							});
						}, 250);
					}}
					onPointerUpdate={({ pointer, button }: any) => {
						if (!pointer) return;
						const api = excalidrawApiRef.current;
						const appState = api?.getAppState?.() || latestAppStateRef.current;
						const scrollX =
							typeof appState?.scrollX === "number" ? appState.scrollX : 0;
						const scrollY =
							typeof appState?.scrollY === "number" ? appState.scrollY : 0;
						const zoom =
							typeof appState?.zoom?.value === "number"
								? appState.zoom.value
								: typeof appState?.zoom === "number"
									? appState.zoom
									: 1;
						const width =
							typeof appState?.width === "number" ? appState.width : 0;
						const height =
							typeof appState?.height === "number" ? appState.height : 0;

						const isLikelyViewport =
							width > 0 &&
							height > 0 &&
							pointer.x >= 0 &&
							pointer.x <= width &&
							pointer.y >= 0 &&
							pointer.y <= height;

						const sceneX = isLikelyViewport
							? pointer.x / zoom - scrollX
							: pointer.x;
						const sceneY = isLikelyViewport
							? pointer.y / zoom - scrollY
							: pointer.y;
						const viewportX = isLikelyViewport
							? pointer.x
							: (pointer.x + scrollX) * zoom;
						const viewportY = isLikelyViewport
							? pointer.y
							: (pointer.y + scrollY) * zoom;

						updateMyPresence({
							cursor: {
								viewport: { x: viewportX, y: viewportY },
								scene: { x: sceneX, y: sceneY },
								tool: pointer.tool,
								button,
							} as any,
							lastActivity: Date.now(),
						});
					}}
					renderTopRightUI={() => {
						const name = currentUser?.name || "Anonymous";
						const image = currentUser?.image;
						const bg = generateUserColor((currentUser as any)?._id || name);
						const showToolFallback = !toolbarPortalTarget;

						return (
							<div className="flex items-center gap-2">
								{showToolFallback ? (
									<>
										<button
											aria-label="Sticky Note"
											className="ToolIcon ToolIcon_type_button"
											onClick={insertStickyNote}
											title="Sticky Note (N)"
											type="button"
										>
											<div aria-hidden className="ToolIcon__icon">
												<span style={{ fontSize: 16, lineHeight: 1 }}>🗒</span>
											</div>
										</button>
										<button
											aria-label="AI Format"
											className="ToolIcon ToolIcon_type_button"
											onClick={collapsibleSidebar}
											title="AI Format"
											type="button"
										>
											<div aria-hidden className="ToolIcon__icon">
												<span style={{ fontSize: 16, lineHeight: 1 }}>✨</span>
											</div>
										</button>
									</>
								) : null}

								<LiveParticipants />

								<Avatar className="h-7 w-7 border-2 border-muted">
									<AvatarImage src={image} />
									<AvatarFallback
										className="text-xs font-semibold text-white"
										style={{ backgroundColor: bg }}
									>
										{name?.[0] || "A"}
									</AvatarFallback>
								</Avatar>
							</div>
						);
					}}
					theme={theme}
				>
					{/* Sticky Note + AI Format: toolbar buttons (inside tool palette) */}
					{toolbarPortalTarget
						? createPortal(
							<>
								<button
									aria-label="Sticky Note"
									className="ToolIcon ToolIcon_type_button"
									onClick={insertStickyNote}
									title="Sticky Note (N)"
									type="button"
								>
									<div aria-hidden className="ToolIcon__icon">
										<span style={{ fontSize: 16, lineHeight: 1 }}>🗒</span>
									</div>
								</button>
								<button
									aria-label="AI Format"
									className="ToolIcon ToolIcon_type_button"
									onClick={collapsibleSidebar}
									title="AI Format"
									type="button"
								>
									<div aria-hidden className="ToolIcon__icon">
										<span style={{ fontSize: 16, lineHeight: 1 }}>✨</span>
									</div>
								</button>
							</>,
							toolbarPortalTarget
						)
						: null}

					{ExcalidrawSidebar ? (
						<ExcalidrawSidebar name="ai-format">
							<ExcalidrawSidebar.Header>AI Format</ExcalidrawSidebar.Header>
							<div className="flex flex-col gap-3 p-3">
								<textarea
									className="min-h-[160px] w-full resize-y rounded-md border border-input bg-background p-2 text-sm outline-none"
									onChange={(e) => setAiPrompt(e.target.value)}
									placeholder='Describe a diagram, e.g. "User login flow with email/password, OTP verification, success and failure paths"'
									value={aiPrompt}
								/>
								<Button
									disabled={isGenerating}
									onClick={generateDiagramFromPrompt}
								>
									{isGenerating ? "Generating…" : "Generate"}
								</Button>
							</div>
						</ExcalidrawSidebar>
					) : null}
				</Excalidraw>
				{/* Live cursors overlay (Liveblocks presence). */}
				<div className="pointer-events-none absolute inset-0 z-50">
					{others.map((other) => {
						const cursor = (other as any)?.presence?.cursor;
						if (!cursor) return null;

						const point =
							cursor?.viewport &&
								typeof cursor.viewport.x === "number" &&
								typeof cursor.viewport.y === "number"
								? { x: cursor.viewport.x, y: cursor.viewport.y }
								: typeof cursor.x === "number" && typeof cursor.y === "number"
									? { x: cursor.x, y: cursor.y }
									: null;
						if (!point) return null;

						const x = point.x;
						const y = point.y;
						const name = other.info?.name || "Anonymous";
						const color = generateUserColor(other.id || name);

						return (
							<div
								className="absolute left-0 top-0"
								key={other.connectionId}
								style={{ transform: `translate(${x}px, ${y}px)` }}
							>
								<div className="flex items-start gap-1">
									<svg fill="none" height="18" viewBox="0 0 24 24" width="18">
										<path
											d="M5 3L19 12L13 13L11 19L5 3Z"
											fill={color}
											stroke={color}
											strokeWidth="1"
										/>
									</svg>
									<div
										className="rounded-md px-2 py-0.5 text-xs font-semibold text-white"
										style={{ backgroundColor: color }}
									>
										{name}
									</div>
								</div>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
};
