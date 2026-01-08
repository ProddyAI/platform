"use client";

import type { ExcalidrawElement } from "@excalidraw/excalidraw/types/element/types";
import type {
	AppState as ExcalidrawAppState,
	BinaryFiles as ExcalidrawBinaryFiles,
	ExcalidrawImperativeAPI,
	ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/types/types";
import {
	type Json,
	type JsonObject,
	LiveObject,
	type LsonObject,
} from "@liveblocks/client";
import { useQuery } from "convex/react";
import { nanoid } from "nanoid";
import dynamic from "next/dynamic";
import {
	type ComponentType,
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
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

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getProddyType(el: unknown): string | null {
	if (!isRecord(el)) return null;
	const customData = el.customData;
	if (!isRecord(customData)) return null;
	const proddy = customData.proddy;
	if (!isRecord(proddy)) return null;
	const type = proddy.type;
	return typeof type === "string" ? type : null;
}

function getProddyNoteId(el: unknown): string | null {
	if (!isRecord(el)) return null;
	const customData = el.customData;
	if (!isRecord(customData)) return null;
	const proddy = customData.proddy;
	if (!isRecord(proddy)) return null;
	const noteId = proddy.noteId;
	return typeof noteId === "string" ? noteId : null;
}

function isStickyNoteElement(el: unknown) {
	return getProddyType(el) === "sticky-note";
}

function getStickyNoteDecorType(el: unknown): string | null {
	const t = getProddyType(el);
	if (t === "sticky-note-shadow") return t;
	return null;
}

function getStickyNoteParentId(el: unknown): string | null {
	return getProddyNoteId(el);
}

function isElementNewer(incoming: unknown, existing: unknown) {
	if (!existing) return true;
	if (
		isRecord(incoming) &&
		isRecord(existing) &&
		typeof incoming.version === "number" &&
		typeof existing.version === "number"
	) {
		if (incoming.version !== existing.version) {
			return incoming.version > existing.version;
		}
	}
	if (
		isRecord(incoming) &&
		isRecord(existing) &&
		typeof incoming.updated === "number" &&
		typeof existing.updated === "number"
	) {
		if (incoming.updated !== existing.updated) {
			return incoming.updated > existing.updated;
		}
	}
	// Fall back to versionNonce if present.
	if (
		isRecord(incoming) &&
		isRecord(existing) &&
		incoming.versionNonce &&
		existing.versionNonce
	) {
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

const DEFAULT_APP_STATE: JsonObject = {
	viewBackgroundColor: "#0000",
	currentItemFontFamily: 1,
};

function sanitizeAppState(appState: unknown): JsonObject {
	if (!isRecord(appState)) return {};
	// Excalidraw uses a non-serializable Map for collaborators.
	// Never persist or hydrate it.
	const { collaborators: _collaborators, ...rest } = appState;
	return rest as JsonObject;
}

type PersistedScene = LsonObject & {
	elements: Json[];
	appState: JsonObject;
	files: JsonObject;
	version: number;
};

function _scenePointToViewport(
	point: { x: number; y: number },
	appState: Readonly<ExcalidrawAppState> | null | undefined
) {
	const scrollX = typeof appState?.scrollX === "number" ? appState.scrollX : 0;
	const scrollY = typeof appState?.scrollY === "number" ? appState.scrollY : 0;
	const zoomValue =
		typeof appState?.zoom?.value === "number" ? appState.zoom.value : 1;

	return {
		x: (point.x + scrollX) * zoomValue,
		y: (point.y + scrollY) * zoomValue,
	};
}

function getCommonBoundsFallback(elements: readonly unknown[]) {
	let x1 = Number.POSITIVE_INFINITY;
	let y1 = Number.POSITIVE_INFINITY;
	let x2 = Number.NEGATIVE_INFINITY;
	let y2 = Number.NEGATIVE_INFINITY;

	for (const el of elements || []) {
		if (!isRecord(el)) continue;
		if (el.isDeleted) continue;
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
	const latestAppStateRef = useRef<Readonly<ExcalidrawAppState> | null>(null);
	const excalidrawLibRef = useRef<Record<string, unknown> | null>(null);
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

	type ExcalidrawSidebarComponent = ComponentType<{
		name: string;
		children?: ReactNode;
	}> & {
		Header: ComponentType<{ children?: ReactNode }>;
	};

	const ExcalidrawSidebar = (excalidrawLibRef.current?.Sidebar ??
		undefined) as unknown as ExcalidrawSidebarComponent | undefined;

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
		const value = root.excalidraw;
		if (!value) return false;
		return typeof (value as { toObject?: unknown }).toObject !== "function";
	});
	const storedScene = useStorage((root): PersistedScene | null => {
		const value = root.excalidraw;
		if (!value) return null;

		const toObject = (value as { toObject?: unknown }).toObject;
		const raw =
			typeof toObject === "function" ? (toObject as () => unknown)() : value;
		if (!isRecord(raw)) return null;

		const elements = Array.isArray(raw.elements)
			? (raw.elements as Json[])
			: [];
		const appState = isRecord(raw.appState) ? (raw.appState as JsonObject) : {};
		const files = isRecord(raw.files) ? (raw.files as JsonObject) : {};
		const version = typeof raw.version === "number" ? raw.version : 0;

		return {
			elements,
			appState,
			files,
			version,
		};
	});

	useEffect(() => {
		currentVersionRef.current = storedScene?.version ?? 0;
	}, [storedScene]);

	const ensureExcalidrawStorage = useMutation(({ storage }) => {
		const existing = storage.get("excalidraw");
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
		const existing = storage.get("excalidraw");
		if (!existing) return;
		if (typeof (existing as { toObject?: unknown }).toObject === "function")
			return;

		const raw: UnknownRecord =
			typeof existing === "object" && existing
				? (existing as unknown as UnknownRecord)
				: {};
		const migrated: PersistedScene = {
			elements: Array.isArray(raw.elements) ? (raw.elements as Json[]) : [],
			appState: {
				...DEFAULT_APP_STATE,
				...sanitizeAppState(raw.appState),
			},
			files:
				raw.files && typeof raw.files === "object"
					? (raw.files as JsonObject)
					: {},
			version: typeof raw.version === "number" ? raw.version : 1,
		};

		storage.set("excalidraw", new LiveObject<PersistedScene>(migrated));
		storage.set("lastUpdate", Date.now());
	}, []);

	const persistScene = useMutation(({ storage }, scene: PersistedScene) => {
		const excalidraw = storage.get("excalidraw");

		const safeScene: PersistedScene = {
			elements: Array.isArray(scene.elements) ? scene.elements : [],
			appState: sanitizeAppState(scene.appState),
			files: scene.files && typeof scene.files === "object" ? scene.files : {},
			version: typeof scene.version === "number" ? scene.version : 1,
		};

		if (!excalidraw) {
			storage.set("excalidraw", new LiveObject<PersistedScene>(safeScene));
		} else {
			const live = excalidraw as { set?: unknown };
			if (typeof live.set === "function") {
				(live.set as (key: string, value: unknown) => void)(
					"elements",
					safeScene.elements
				);
				(live.set as (key: string, value: unknown) => void)(
					"appState",
					safeScene.appState
				);
				(live.set as (key: string, value: unknown) => void)(
					"files",
					safeScene.files
				);
				(live.set as (key: string, value: unknown) => void)(
					"version",
					safeScene.version
				);
			}
		}

		storage.set("lastUpdate", Date.now());
	}, []);

	const generateDiagramFromPrompt = async () => {
		const excalidrawApi = excalidrawApiRef.current;
		if (!excalidrawApi) return;

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
			const maybeFiles = files as unknown;
			if (Array.isArray(maybeFiles)) {
				excalidrawApi.addFiles(maybeFiles as never);
			} else if (maybeFiles && typeof maybeFiles === "object") {
				const values = Object.values(maybeFiles);
				if (values.length) excalidrawApi.addFiles(values as never);
			}

			// Center the generated diagram in the current viewport.
			const appState = excalidrawApi.getAppState();
			const zoom =
				typeof appState?.zoom?.value === "number" ? appState.zoom.value : 1;
			const viewportCenterX = -appState.scrollX + appState.width / 2 / zoom;
			const viewportCenterY = -appState.scrollY + appState.height / 2 / zoom;

			const getCommonBounds = excalidrawLibRef.current
				?.getCommonBounds as unknown as
				| ((els: readonly unknown[]) => [number, number, number, number])
				| undefined;
			const [x1, y1, x2, y2] = (getCommonBounds || getCommonBoundsFallback)(
				newElements as unknown as readonly unknown[]
			);
			const diagramCenterX = (x1 + x2) / 2;
			const diagramCenterY = (y1 + y2) / 2;
			const dx = viewportCenterX - diagramCenterX;
			const dy = viewportCenterY - diagramCenterY;

			const moved = newElements.map((el) => {
				const base: Record<string, unknown> =
					el && typeof el === "object" ? (el as Record<string, unknown>) : {};

				const baseX = typeof base.x === "number" ? base.x : 0;
				const baseY = typeof base.y === "number" ? base.y : 0;

				return {
					...base,
					x: baseX + dx,
					y: baseY + dy,
					locked: false,
				};
			});

			const existing = excalidrawApi.getSceneElements();
			isApplyingRemoteSceneRef.current = true;
			try {
				excalidrawApi.updateScene({
					elements: [...existing, ...moved],
					commitToHistory: true,
				} as never);
			} finally {
				isApplyingRemoteSceneRef.current = false;
			}

			toast.success("Diagram added");
		} catch (err: unknown) {
			toast.error(err instanceof Error ? err.message : "AI Format failed");
		} finally {
			setIsGenerating(false);
		}
	};

	const openAiFormatSidebar = () => {
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

	const initialData = useMemo<ExcalidrawInitialDataState>(() => {
		if (!storedScene) {
			return {
				appState: DEFAULT_APP_STATE as unknown as Partial<ExcalidrawAppState>,
			};
		}

		return {
			elements: Array.isArray(storedScene.elements)
				? (storedScene.elements as unknown as readonly ExcalidrawElement[])
				: [],
			appState: {
				...(DEFAULT_APP_STATE as unknown as Partial<ExcalidrawAppState>),
				...(sanitizeAppState(
					storedScene.appState || {}
				) as unknown as Partial<ExcalidrawAppState>),
			},
			files: (storedScene.files || {}) as unknown as ExcalidrawBinaryFiles,
		};
	}, [storedScene]);

	useEffect(() => {
		const api = excalidrawApiRef.current;
		if (!api) return;
		if (!storedScene) return;

		const version = storedScene.version;
		if (version === lastAppliedVersionRef.current) return;
		if (version === lastLocalWriteVersionRef.current) {
			lastAppliedVersionRef.current = version;
			return;
		}

		const nextScene = {
			elements: Array.isArray(storedScene.elements) ? storedScene.elements : [],
			appState: {
				...DEFAULT_APP_STATE,
				...sanitizeAppState(storedScene.appState || {}),
			},
			files: storedScene.files || {},
		};

		isApplyingRemoteSceneRef.current = true;
		try {
			api.updateScene(nextScene as never);
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
		if (!event || event.type !== "excalidraw:delta") return;

		const api = excalidrawApiRef.current;
		if (!api) return;

		const incomingElements = (Array.isArray(event.elements)
			? event.elements
			: []) as unknown as ExcalidrawElement[];
		if (!incomingElements.length) return;

		const existing = api.getSceneElements();
		const byId = new Map<string, ExcalidrawElement>(
			existing.map((el) => [el.id, el])
		);

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
			} as never);
		} finally {
			suppressBroadcastRef.current = false;
		}
	});

	const insertStickyNote = useCallback(async () => {
		const api = excalidrawApiRef.current;
		if (!api) return;

		if (!excalidrawLibRef.current) {
			const mod = await import("@excalidraw/excalidraw").catch(() => null);
			if (mod) {
				excalidrawLibRef.current = mod;
				setExcalidrawLibVersion((v) => v + 1);
			}
		}

		const appState = api.getAppState();
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

		const shadowSkeleton: Record<string, unknown> = {
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
		};

		const rectSkeleton: Record<string, unknown> = {
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
		};

		const textSkeleton: Record<string, unknown> = {
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
			strokeColor: appState?.currentItemStrokeColor ?? "#1f1f1f",
			backgroundColor: "transparent",
			containerId: noteId,
			groupIds: [groupId],
		};

		const convertToExcalidrawElements =
			excalidrawLibRef.current?.convertToExcalidrawElements;
		const restoreElements = excalidrawLibRef.current?.restoreElements;
		const newElements =
			typeof restoreElements === "function" &&
			typeof convertToExcalidrawElements === "function"
				? (restoreElements as (els: unknown, appState: unknown) => unknown)(
						(convertToExcalidrawElements as (els: unknown) => unknown)([
							shadowSkeleton,
							rectSkeleton,
							textSkeleton,
						]),
						null
					)
				: [shadowSkeleton, rectSkeleton, textSkeleton];
		const existing = api.getSceneElements();

		const selection = Object.fromEntries(
			(Array.isArray(newElements) ? newElements : [])
				.filter((el) => Boolean((el as { id?: unknown } | null)?.id))
				.map((el) => [(el as { id: string }).id, true])
		);

		api.updateScene({
			elements: [
				...existing,
				...(Array.isArray(newElements) ? newElements : []),
			],
			commitToHistory: true,
			appState: {
				selectedElementIds: Object.keys(selection).length
					? selection
					: { [noteId]: true },
			},
		} as never);

		// Ensure the inserted note is visible even if the user is panned elsewhere.
		window.requestAnimationFrame(() => {
			try {
				const apiWithScroll = api as unknown as {
					scrollToContent?: (elements: unknown, opts?: unknown) => void;
				};
				apiWithScroll.scrollToContent?.(newElements, { animate: true });
			} catch {
				// Best-effort. If scrollToContent isn't available, insertion still works.
			}
		});
	}, []);

	// Keyboard shortcut: N to insert sticky note.
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			const target = e.target as HTMLElement | null;
			const isTypingTarget =
				target?.tagName === "INPUT" ||
				target?.tagName === "TEXTAREA" ||
				target?.isContentEditable;
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
					theme={theme}
					initialData={initialData}
					excalidrawAPI={(api) => {
						excalidrawApiRef.current = api;
					}}
					renderTopRightUI={() => {
						const name = currentUser?.name || "Anonymous";
						const image = currentUser?.image;
						const userKey =
							currentUser &&
							typeof (currentUser as { _id?: unknown })._id === "string"
								? (currentUser as { _id: string })._id
								: name;
						const bg = generateUserColor(userKey);
						const showToolFallback = !toolbarPortalTarget;

						return (
							<div className="flex items-center gap-2">
								{showToolFallback ? (
									<>
										<button
											type="button"
											className="ToolIcon ToolIcon_type_button"
											title="Sticky Note (N)"
											aria-label="Sticky Note"
											onClick={insertStickyNote}
										>
											<div className="ToolIcon__icon" aria-hidden>
												<span style={{ fontSize: 16, lineHeight: 1 }}>🗒</span>
											</div>
										</button>
										<button
											type="button"
											className="ToolIcon ToolIcon_type_button"
											title="AI Format"
											aria-label="AI Format"
											onClick={openAiFormatSidebar}
										>
											<div className="ToolIcon__icon" aria-hidden>
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
					onPointerUpdate={(payload) => {
						const { pointer } = payload as {
							pointer?: { x: number; y: number; tool?: "pointer" | "laser" };
						};
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
						const viewportX = isLikelyViewport
							? pointer.x
							: (pointer.x + scrollX) * zoom;
						const viewportY = isLikelyViewport
							? pointer.y
							: (pointer.y + scrollY) * zoom;

						updateMyPresence({
							cursor: { x: viewportX, y: viewportY, tool: pointer.tool },
							lastActivity: Date.now(),
						});
					}}
					onChange={(elements, appState, files) => {
						latestAppStateRef.current =
							appState && typeof appState === "object"
								? (appState as Readonly<ExcalidrawAppState>)
								: null;
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
									} as never);
								} finally {
									queueMicrotask(() => {
										isAutoLockingToolRef.current = false;
										suppressBroadcastRef.current = false;
									});
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
							const parentNote = elementsArray.find((el) => {
								if (!isStickyNoteElement(el)) return false;
								const groupIds = (el as { groupIds?: unknown }).groupIds;
								return (
									Array.isArray(groupIds) && groupIds.includes(editingGroupId)
								);
							});
							if (parentNote) {
								const excalidrawApi = excalidrawApiRef.current;
								if (excalidrawApi) {
									isSyncingStickyDecorRef.current = true;
									suppressBroadcastRef.current = true;
									try {
										excalidrawApi.updateScene({
											appState: {
												editingGroupId: null,
												selectedElementIds: { [parentNote.id]: true },
											},
											commitToHistory: false,
										} as never);
									} finally {
										queueMicrotask(() => {
											isSyncingStickyDecorRef.current = false;
											suppressBroadcastRef.current = false;
										});
									}
									return;
								}
							}
						}

						// If the user clicks the shadow, redirect selection to the actual sticky note.
						// This makes the shadow feel "attached" and prevents accidental independent selection.
						const selectedIds = appState?.selectedElementIds;
						if (selectedIds && typeof selectedIds === "object") {
							const selectedRecord = selectedIds as Record<string, unknown>;
							const selectedKeys = Object.keys(selectedRecord).filter((k) =>
								Boolean(selectedRecord[k])
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
									const excalidrawApi = excalidrawApiRef.current;
									if (excalidrawApi) {
										isSyncingStickyDecorRef.current = true;
										suppressBroadcastRef.current = true;
										try {
											excalidrawApi.updateScene({
												appState: {
													selectedElementIds: { [parentNote.id]: true },
												},
												commitToHistory: false,
											} as never);
										} finally {
											queueMicrotask(() => {
												isSyncingStickyDecorRef.current = false;
												suppressBroadcastRef.current = false;
											});
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
								const mutateElement = excalidrawLibRef.current?.mutateElement;
								if (typeof mutateElement === "function") {
									(
										mutateElement as (
											element: unknown,
											update: Record<string, unknown>,
											commitToHistory: boolean
										) => void
									)(shadow, { locked: false }, false);
								} else if (isRecord(shadow)) {
									shadow.locked = false;
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
								const mutateElement = excalidrawLibRef.current?.mutateElement;
								if (typeof mutateElement === "function") {
									(
										mutateElement as (
											element: unknown,
											update: Record<string, unknown>,
											commitToHistory: boolean
										) => void
									)(
										shadow,
										{ x: nextShadowX, y: nextShadowY, width: w, height: h },
										false
									);
								} else if (isRecord(shadow)) {
									shadow.x = nextShadowX;
									shadow.y = nextShadowY;
									shadow.width = w;
									shadow.height = h;
								}
								didSyncDecor = true;
							}
						}

						if (didSyncDecor) {
							const excalidrawApi = excalidrawApiRef.current;
							if (excalidrawApi) {
								isSyncingStickyDecorRef.current = true;
								try {
									excalidrawApi.updateScene({
										elements: elementsArray,
										commitToHistory: false,
									} as never);
								} finally {
									queueMicrotask(() => {
										isSyncingStickyDecorRef.current = false;
									});
								}
								return;
							}
						}

						if (saveTimerRef.current) {
							window.clearTimeout(saveTimerRef.current);
						}

						// Broadcast incremental changes (low-latency). Persisting is still done via debounced snapshot.
						const lastById = lastBroadcastedByIdRef.current;
						const changed: ExcalidrawElement[] = [];
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
								elements: changed as unknown as Json[],
							});
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
				>
					{/* Sticky Note + AI Format: toolbar buttons (inside tool palette) */}
					{toolbarPortalTarget
						? createPortal(
								<>
									<button
										type="button"
										className="ToolIcon ToolIcon_type_button"
										title="Sticky Note (N)"
										aria-label="Sticky Note"
										onClick={insertStickyNote}
									>
										<div className="ToolIcon__icon" aria-hidden>
											<span style={{ fontSize: 16, lineHeight: 1 }}>🗒</span>
										</div>
									</button>
									<button
										type="button"
										className="ToolIcon ToolIcon_type_button"
										title="AI Format"
										aria-label="AI Format"
										onClick={openAiFormatSidebar}
									>
										<div className="ToolIcon__icon" aria-hidden>
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
									placeholder='Describe a diagram, e.g. "User login flow with email/password, OTP verification, success and failure paths"'
									value={aiPrompt}
									onChange={(e) => setAiPrompt(e.target.value)}
								/>
								<Button
									onClick={generateDiagramFromPrompt}
									disabled={isGenerating}
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
						const cursor = other.presence?.cursor;
						if (!cursor) return null;
						if (typeof cursor.x !== "number" || typeof cursor.y !== "number") {
							return null;
						}

						const x = cursor.x;
						const y = cursor.y;
						const name = other.info?.name || "Anonymous";
						const color = generateUserColor(other.id || name);

						return (
							<div
								key={other.connectionId}
								style={{ transform: `translate(${x}px, ${y}px)` }}
								className="absolute left-0 top-0"
							>
								<div className="flex items-start gap-1">
									<svg width="18" height="18" viewBox="0 0 24 24" fill="none">
										<title>{name}</title>
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
