"use client";

import type { ExcalidrawElementSkeleton } from "@excalidraw/excalidraw/types/data/transform";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/types/element/types";
import type {
	AppState,
	BinaryFiles,
	ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types/types";
import type { Mutable } from "@excalidraw/excalidraw/types/utility-types";
import { LiveObject } from "@liveblocks/client";
import { useQuery } from "convex/react";
import { Network, StickyNote } from "lucide-react";
import { nanoid } from "nanoid";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/../convex/_generated/api";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
	convertMermaidToExcalidrawScene,
	normalizeMermaidCode,
} from "@/features/canvas/lib/mermaid";
import { LiveParticipants } from "@/features/live/components/live-participants";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
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

function isStickyNoteElement(el: ExcalidrawElement | null | undefined) {
	return el?.customData?.proddy?.type === "sticky-note";
}

function getStickyNoteDecorType(
	el: ExcalidrawElement | null | undefined
): string | null {
	const t = el?.customData?.proddy?.type;
	if (t === "sticky-note-shadow") return t;
	return null;
}

function getStickyNoteParentId(
	el: ExcalidrawElement | null | undefined
): string | null {
	const noteId = el?.customData?.proddy?.noteId;
	return typeof noteId === "string" ? noteId : null;
}

function isElementNewer(
	incoming: ExcalidrawElement | null | undefined,
	existing: ExcalidrawElement | null | undefined
) {
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
		loading: () => (
			<div className="relative size-full bg-background">
				<div className="absolute inset-x-0 top-4 flex justify-center">
					<Skeleton className="h-12 w-[420px] rounded-lg" />
				</div>
				<div className="absolute right-4 top-4 flex items-center gap-2">
					<Skeleton className="h-7 w-16 rounded-full" />
					<Skeleton className="size-7 rounded-full" />
				</div>
			</div>
		),
	}
);

const DEFAULT_APP_STATE = {
	viewBackgroundColor: "#0000",
	currentItemFontFamily: 1,
};

function sanitizeAppState(appState: unknown): Record<string, unknown> {
	if (!appState || typeof appState !== "object") return {};
	// Excalidraw uses a non-serializable Map for collaborators.
	// Never persist or hydrate it.
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const { collaborators, ...rest } = appState as Record<string, unknown>;
	return rest;
}

// Kept as a loose (any-backed) bag rather than the real Excalidraw types:
// `PersistedScene` is the generic parameter of `LiveObject<PersistedScene>`
// (from @liveblocks/client), which requires its shape to structurally satisfy
// `LsonObject` (values assignable to `Json`). `ExcalidrawElement`/`AppState`
// carry readonly arrays, branded numeric types, and non-JSON fields (e.g. a
// `Map` for collaborators), so swapping in the precise Excalidraw types here
// makes `new LiveObject<PersistedScene>(...)` fail to satisfy that
// constraint. `any` is what lets this bypass the JSON-shape check.
type PersistedScene = {
	elements: any[];
	appState: Record<string, any>;
	files: Record<string, any>;
	version: number;
};

// Legacy/corrupted Liveblocks storage may hold a plain object instead of the
// expected LiveObject<PersistedScene>; this captures only the fields
// normalizeExcalidrawStorage defensively reads off of it.
interface LegacyExcalidrawStorageShape {
	elements?: unknown;
	appState?: unknown;
	files?: unknown;
	version?: unknown;
}

function _scenePointToViewport(
	point: { x: number; y: number },
	appState: Partial<AppState> | null | undefined
) {
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

function getCommonBoundsFallback(elements: readonly ExcalidrawElement[]) {
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

// The real (non-fabricated) persistence state of the scene: "pending" while
// a change is sitting in the debounce window / hasn't been committed yet,
// "saved" once the Liveblocks storage mutation has been applied, "error" if
// that mutation threw. Callers (e.g. the canvas page's header) can subscribe
// via `onSaveStatusChange` instead of hardcoding a status.
export type ExcalidrawCanvasSaveStatus = "saved" | "pending" | "error";

interface ExcalidrawCanvasProps {
	onSaveStatusChange?: (status: ExcalidrawCanvasSaveStatus) => void;
}

export const ExcalidrawCanvas = ({
	onSaveStatusChange,
}: ExcalidrawCanvasProps = {}) => {
	const workspaceId = useWorkspaceId();
	const saveTimerRef = useRef<number | null>(null);
	const pendingCommitRef = useRef<(() => void) | null>(null);
	const excalidrawApiRef = useRef<ExcalidrawImperativeAPI | null>(null);
	const excalidrawHostRef = useRef<HTMLDivElement | null>(null);
	const latestAppStateRef = useRef<AppState | null>(null);
	const excalidrawLibRef = useRef<
		typeof import("@excalidraw/excalidraw") | null
	>(null);
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
	const [generateError, setGenerateError] = useState<string | null>(null);
	const [saveStatus, setSaveStatus] =
		useState<ExcalidrawCanvasSaveStatus>("saved");

	const currentUser = useQuery(api.workspace.users.current);

	const ExcalidrawSidebar = excalidrawLibRef.current?.Sidebar;

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
		const value: unknown = root.excalidraw;
		if (!value) return false;
		return typeof (value as { toObject?: unknown }).toObject !== "function";
	});
	// `value` is intentionally left as `any` here (rather than `unknown`):
	// `root.excalidraw` is declared as `LiveObject<ExcalidrawSceneData>`, but
	// legacy/corrupted storage can hold a plain object instead (that's what
	// `needsExcalidrawNormalization`/`normalizeExcalidrawStorage` detect and
	// fix up). `storedScene`'s inferred type flows into ~10 call sites across
	// this component (`initialData`, the remote-scene-apply effect, the
	// version-tracking effect) that all read it with loose/defensive
	// `typeof`/`Array.isArray` checks; typing it as `unknown` would require
	// re-typing every one of those unrelated call sites too.
	const storedScene = useStorage((root) => {
		const value = root.excalidraw as any;
		if (!value) return null;
		if (typeof value.toObject === "function") return value.toObject();
		if (typeof value === "object") return value;
		return null;
	});

	useEffect(() => {
		const nextVersion =
			typeof storedScene?.version === "number" ? storedScene.version : 0;
		currentVersionRef.current = nextVersion;
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

	const normalizeExcalidrawStorage = useMutation(({ storage }) => {
		const existing = storage.get("excalidraw") as unknown;
		if (!existing) return;
		if (typeof (existing as { toObject?: unknown }).toObject === "function") {
			return;
		}

		const raw = (
			typeof existing === "object" && existing ? existing : {}
		) as LegacyExcalidrawStorageShape;
		const migrated: PersistedScene = {
			elements: Array.isArray(raw.elements) ? raw.elements : [],
			appState: {
				...DEFAULT_APP_STATE,
				...sanitizeAppState(raw.appState),
			},
			files:
				raw.files && typeof raw.files === "object"
					? (raw.files as Record<string, unknown>)
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
			excalidraw.set("elements", safeScene.elements);
			excalidraw.set("appState", safeScene.appState);
			excalidraw.set("files", safeScene.files);
			excalidraw.set("version", safeScene.version);
		}

		storage.set("lastUpdate", Date.now());
	}, []);

	const generateAbortRef = useRef<AbortController | null>(null);

	const generateDiagramFromPrompt = async () => {
		const api = excalidrawApiRef.current;
		if (!api) return;

		const prompt = aiPrompt.trim();
		if (!prompt) return;

		const controller = new AbortController();
		generateAbortRef.current = controller;

		try {
			setIsGenerating(true);
			setGenerateError(null);

			const res = await fetch("/api/smart/diagram", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ prompt, workspaceId }),
				signal: controller.signal,
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
				setGenerateError("The AI didn't return a diagram. Try rephrasing.");
				return;
			}

			const { elements: newElements, files } =
				await convertMermaidToExcalidrawScene(mermaid);
			if (!newElements.length) {
				setGenerateError("Could not turn that into shapes. Try rephrasing.");
				return;
			}

			// Add any generated files (e.g. embedded images).
			const maybeFiles = files;
			if (Array.isArray(maybeFiles)) {
				api.addFiles(maybeFiles);
			} else if (maybeFiles && typeof maybeFiles === "object") {
				const values = Object.values(maybeFiles);
				if (values.length) api.addFiles(values);
			}

			// Center the generated diagram in the current viewport.
			const appState = api.getAppState();
			const zoom =
				typeof appState?.zoom?.value === "number" ? appState.zoom.value : 1;
			const viewportCenterX = -appState.scrollX + appState.width / 2 / zoom;
			const viewportCenterY = -appState.scrollY + appState.height / 2 / zoom;

			const getCommonBounds = excalidrawLibRef.current?.getCommonBounds;
			const [x1, y1, x2, y2] = (getCommonBounds || getCommonBoundsFallback)(
				newElements as ExcalidrawElement[]
			);
			const diagramCenterX = (x1 + x2) / 2;
			const diagramCenterY = (y1 + y2) / 2;
			const dx = viewportCenterX - diagramCenterX;
			const dy = viewportCenterY - diagramCenterY;

			const moved = (newElements as ExcalidrawElement[]).map((el) => ({
				...el,
				x: (el?.x ?? 0) + dx,
				y: (el?.y ?? 0) + dy,
				locked: false,
			}));

			const existing = api.getSceneElements();
			isApplyingRemoteSceneRef.current = true;
			try {
				api.updateScene({
					elements: [...existing, ...moved],
					commitToHistory: true,
				});
			} finally {
				isApplyingRemoteSceneRef.current = false;
			}

			toast.success("Diagram added");
		} catch (err) {
			if ((err as Error)?.name === "AbortError") return;
			setGenerateError((err as Error)?.message || "Diagram generation failed");
		} finally {
			setIsGenerating(false);
			generateAbortRef.current = null;
		}
	};

	const cancelGenerateDiagram = () => {
		generateAbortRef.current?.abort();
	};

	const collapsibleSidebar = () => {
		const api = excalidrawApiRef.current;
		if (!api) return;
		api.toggleSidebar({ name: "generate-diagram", force: true });
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
			typeof storedScene.version === "number" ? storedScene.version : 0;
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
			// `nextScene` can't be typed precisely here: `updateScene`'s real
			// signature is `<K extends keyof AppState>(sceneData: {
			// appState?: Pick<AppState, K> | null; ... })`, and TS can only infer
			// `K` from a fresh object literal with concrete keys. `nextScene.appState`
			// is built by spreading `sanitizeAppState(storedScene.appState)` — the
			// sanitized result of an arbitrary, dynamically-shaped stored value —
			// so it can never have statically-known keys. Passing it as anything
			// other than `any` (including the library's own exported `SceneData`
			// type) makes `K` default to `keyof AppState`, which then requires
			// every AppState field to be present.
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
		if (!event || event.type !== "excalidraw:delta") return;

		const api = excalidrawApiRef.current;
		if (!api) return;

		const incomingElements = Array.isArray(event.elements)
			? event.elements
			: [];
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
			});
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
		} as ExcalidrawElementSkeleton;

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
		} as ExcalidrawElementSkeleton;

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
			strokeColor:
				(appState as { currentItemTextColor?: string }).currentItemTextColor ??
				"#1f1f1f",
			backgroundColor: "transparent",
			containerId: noteId,
			groupIds: [groupId],
			// Kept as `any` (unlike the shadow/rect skeletons above): Excalidraw's own
			// `ExcalidrawTextElement.lineHeight` is a branded type
			// (`number & { _brand: "unitlessLineHeight" }`) that only its internal
			// `getLineHeight()` helper can produce — a plain numeric literal like
			// `1.25` can't satisfy `ExcalidrawElementSkeleton` without an equally
			// unsafe brand cast.
		} as any;

		const convertToExcalidrawElements =
			excalidrawLibRef.current?.convertToExcalidrawElements;
		const restoreElements = excalidrawLibRef.current?.restoreElements;
		const newElements =
			restoreElements && convertToExcalidrawElements
				? restoreElements(
						convertToExcalidrawElements([
							shadowSkeleton,
							rectSkeleton,
							textSkeleton,
						]),
						null
					)
				: [shadowSkeleton, rectSkeleton, textSkeleton];
		const existing = api.getSceneElements();

		const selection = Object.fromEntries(
			newElements.filter((el) => el?.id).map((el) => [el.id, true])
		);

		api.updateScene({
			elements: [...existing, ...newElements],
			commitToHistory: true,
			appState: {
				selectedElementIds: Object.keys(selection).length
					? selection
					: { [noteId]: true },
			},
		});

		// Ensure the inserted note is visible even if the user is panned elsewhere.
		const prefersReducedMotion = window.matchMedia?.(
			"(prefers-reduced-motion: reduce)"
		).matches;
		window.requestAnimationFrame(() => {
			try {
				api.scrollToContent?.(newElements, { animate: !prefersReducedMotion });
			} catch {
				// Best-effort. If scrollToContent isn't available, insertion still works.
			}
		});
	}, []);

	// Keyboard shortcut: N to insert sticky note. Scoped to the canvas host so
	// focus elsewhere in the page (sidebar, header, an open dialog/menu) never
	// hijacks the key.
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key.toLowerCase() !== "n") return;

			const target = e.target as HTMLElement | null;
			const isTypingTarget =
				target?.tagName === "INPUT" ||
				target?.tagName === "TEXTAREA" ||
				target?.isContentEditable;
			if (isTypingTarget) return;

			const host = excalidrawHostRef.current;
			const activeElement = document.activeElement;
			const isWithinCanvas =
				!host ||
				!activeElement ||
				activeElement === document.body ||
				host.contains(activeElement);
			if (!isWithinCanvas) return;

			const hasOpenOverlay = document.querySelector(
				'[role="dialog"], [role="alertdialog"], [role="menu"]'
			);
			if (hasOpenOverlay) return;

			e.preventDefault();
			insertStickyNote();
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [insertStickyNote]);

	// Flush any pending (debounced but not-yet-persisted) save immediately
	// instead of silently dropping it when the user closes the tab, switches
	// away, or navigates elsewhere in the app.
	useEffect(() => {
		const flushPendingSave = () => {
			if (saveTimerRef.current) {
				window.clearTimeout(saveTimerRef.current);
				saveTimerRef.current = null;
			}
			const commit = pendingCommitRef.current;
			pendingCommitRef.current = null;
			commit?.();
		};

		const handleVisibilityChange = () => {
			if (document.visibilityState === "hidden") flushPendingSave();
		};

		window.addEventListener("beforeunload", flushPendingSave);
		document.addEventListener("visibilitychange", handleVisibilityChange);
		return () => {
			window.removeEventListener("beforeunload", flushPendingSave);
			document.removeEventListener("visibilitychange", handleVisibilityChange);
			flushPendingSave();
		};
	}, []);

	useEffect(() => {
		onSaveStatusChange?.(saveStatus);
	}, [saveStatus, onSaveStatusChange]);

	return (
		<div className="size-full" ref={excalidrawHostRef}>
			<div className="relative size-full">
				<Excalidraw
					excalidrawAPI={(api) => {
						excalidrawApiRef.current = api;
					}}
					initialData={initialData}
					onChange={(
						elements: readonly ExcalidrawElement[],
						appState: AppState,
						files: BinaryFiles
					) => {
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
									});
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
									Array.isArray(el.groupIds) &&
									el.groupIds.includes(editingGroupId)
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
										});
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
								(k) => selectedIds[k]
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
											});
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
								const mutateElement = excalidrawLibRef.current?.mutateElement;
								if (mutateElement) {
									mutateElement(shadow, { locked: false }, false);
								} else {
									// ExcalidrawElement's fields are readonly; mutateElement is the
									// library's sanctioned way to write through that. When it isn't
									// loaded yet, fall back to the same escape hatch it uses
									// internally (`Mutable<ExcalidrawElement>`) rather than `any`.
									(shadow as Mutable<ExcalidrawElement>).locked = false;
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
								if (mutateElement) {
									mutateElement(
										shadow,
										{ x: nextShadowX, y: nextShadowY, width: w, height: h },
										false
									);
								} else {
									const mutableShadow = shadow as Mutable<ExcalidrawElement>;
									mutableShadow.x = nextShadowX;
									mutableShadow.y = nextShadowY;
									mutableShadow.width = w;
									mutableShadow.height = h;
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
									});
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
							saveTimerRef.current = null;
						}

						// Broadcast incremental changes (low-latency). Persisting is still done via debounced snapshot.
						const lastById = lastBroadcastedByIdRef.current;
						const changed: unknown[] = [];
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
							});
						}

						const commitSave = () => {
							saveTimerRef.current = null;
							pendingCommitRef.current = null;

							const base = Math.max(
								currentVersionRef.current,
								lastLocalWriteVersionRef.current,
								Date.now() * 1000
							);
							const nextVersion = base + (Math.floor(Math.random() * 1000) + 1);
							lastLocalWriteVersionRef.current = nextVersion;

							try {
								persistScene({
									elements: elementsArray,
									appState: safeAppState,
									files: files && typeof files === "object" ? files : {},
									version: nextVersion,
								});
								setSaveStatus("saved");
							} catch {
								setSaveStatus("error");
							}
						};

						pendingCommitRef.current = commitSave;
						setSaveStatus("pending");
						saveTimerRef.current = window.setTimeout(commitSave, 1500);
					}}
					onPointerUpdate={({
						pointer,
						button,
					}: {
						pointer: { x: number; y: number; tool: "pointer" | "laser" };
						button: "down" | "up";
					}) => {
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
							// The `Presence.cursor` type declared in liveblocks.config.ts is
							// `{ x, y, tool?, button? } | null` (flat coordinates only), but
							// this payload deliberately sends richer `viewport`/`scene`
							// sub-objects instead — the reader below (`other.presence.cursor`)
							// falls back to flat `x`/`y` for older/other clients. Fixing this
							// precisely means widening the shared, unexported `Presence` type
							// in liveblocks.config.ts, which is outside this file.
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
						const bg = generateUserColor(currentUser?._id || name);

						return (
							<div className="flex items-center gap-2">
								<button
									aria-label="Insert sticky note"
									className="ToolIcon ToolIcon_type_button"
									onClick={insertStickyNote}
									title="Sticky note (N)"
									type="button"
								>
									<div aria-hidden className="ToolIcon__icon">
										<StickyNote className="size-5" />
									</div>
								</button>
								<button
									aria-label="Generate diagram"
									className="ToolIcon ToolIcon_type_button"
									onClick={collapsibleSidebar}
									title="Generate diagram"
									type="button"
								>
									<div aria-hidden className="ToolIcon__icon">
										<Network className="size-5" />
									</div>
								</button>

								<LiveParticipants />

								<Avatar className="size-7 border-2 border-muted">
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
					{ExcalidrawSidebar ? (
						<ExcalidrawSidebar name="generate-diagram">
							<ExcalidrawSidebar.Header>
								Generate diagram
							</ExcalidrawSidebar.Header>
							<div className="flex flex-col gap-3 p-3">
								<div className="flex flex-col gap-1.5">
									<label
										className="text-sm font-medium text-foreground"
										htmlFor="canvas-generate-diagram-prompt"
									>
										Describe the diagram
									</label>
									<Textarea
										aria-invalid={Boolean(generateError)}
										className="min-h-[160px]"
										id="canvas-generate-diagram-prompt"
										onChange={(e) => {
											setAiPrompt(e.target.value);
											if (generateError) setGenerateError(null);
										}}
										onKeyDown={(e) => {
											if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
												e.preventDefault();
												if (aiPrompt.trim() && !isGenerating) {
													generateDiagramFromPrompt();
												}
											}
										}}
										placeholder='e.g. "User login flow with email/password, OTP verification, success and failure paths"'
										value={aiPrompt}
									/>
									{generateError ? (
										<p className="text-xs text-destructive">{generateError}</p>
									) : !aiPrompt.trim() ? (
										<p className="text-xs text-muted-foreground">
											Describe a diagram to enable generation.
										</p>
									) : null}
								</div>
								<div className="flex gap-2">
									<Button
										disabled={!aiPrompt.trim()}
										loading={isGenerating}
										onClick={generateDiagramFromPrompt}
									>
										{isGenerating ? "Generating…" : "Generate diagram"}
									</Button>
									{isGenerating ? (
										<Button
											onClick={cancelGenerateDiagram}
											type="button"
											variant="outline"
										>
											Cancel
										</Button>
									) : null}
								</div>
							</div>
						</ExcalidrawSidebar>
					) : null}
				</Excalidraw>
				{/* Live cursors overlay (Liveblocks presence). */}
				<div className="pointer-events-none absolute inset-0 z-50">
					{others.map((other) => {
						// See the matching comment in `onPointerUpdate` above: the real
						// `Presence.cursor` type only declares flat `x`/`y`, but this reads
						// the richer `viewport`/`scene` shape this component actually
						// writes (with a flat-`x`/`y` fallback for other clients).
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
									<svg
										aria-hidden="true"
										fill="none"
										height="18"
										viewBox="0 0 24 24"
										width="18"
									>
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
