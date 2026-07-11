"use client";

import type { LucideIcon } from "lucide-react";
import {
	createContext,
	isValidElement,
	type ReactNode,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";

interface WorkspaceTitleContextType {
	title: ReactNode;
	setTitle: (title: ReactNode) => void;
}

const WorkspaceTitleContext = createContext<
	WorkspaceTitleContextType | undefined
>(undefined);

/**
 * Mounted once by the workspace layout, above every routed page. WorkspaceToolbar
 * reads the current title-slot content from here instead of taking it as a
 * prop, so the toolbar itself (search/notifications/theme-toggle/user-menu)
 * can live in the shared layout while each page only supplies its own title.
 */
export const WorkspaceTitleProvider = ({
	children,
}: {
	children: ReactNode;
}) => {
	const [title, setTitle] = useState<ReactNode>(null);

	return (
		<WorkspaceTitleContext.Provider value={{ title, setTitle }}>
			{children}
		</WorkspaceTitleContext.Provider>
	);
};

const useWorkspaceTitleContext = () => {
	const context = useContext(WorkspaceTitleContext);
	if (context === undefined) {
		throw new Error(
			"useWorkspaceTitleContext must be used within a WorkspaceTitleProvider"
		);
	}
	return context;
};

/** Used by WorkspaceToolbar to render the page-supplied title slot. */
export const useWorkspaceTitleSlot = () => useWorkspaceTitleContext().title;

function shallowEqualProps(
	a: Record<string, unknown>,
	b: Record<string, unknown>
): boolean {
	const aKeys = Object.keys(a);
	const bKeys = Object.keys(b);
	if (aKeys.length !== bKeys.length) return false;
	return aKeys.every((key) => Object.is(a[key], b[key]));
}

/**
 * Title-slot content is typically recreated as a fresh element on every
 * render of the calling page (JSX always allocates a new object), even when
 * its actual content hasn't changed. Comparing by reference would re-register
 * the title - and therefore re-render every context consumer, including the
 * calling page itself - on every single render, which loops forever. This
 * compares the element's type + own props one level deep instead, which is
 * enough for the common `<WorkspaceTitle icon label />` case.
 */
function titlesAreEquivalent(a: ReactNode, b: ReactNode): boolean {
	if (a === b) return true;
	if (isValidElement(a) && isValidElement(b)) {
		return (
			a.type === b.type &&
			shallowEqualProps(
				a.props as Record<string, unknown>,
				b.props as Record<string, unknown>
			)
		);
	}
	return false;
}

/**
 * Called by a workspace page to populate the toolbar's title slot for as long
 * as it stays mounted (unregisters on unmount). Most pages just need a static
 * icon + label — see the `WorkspaceTitle` component below. Pages with an
 * interactive title slot (e.g. the channel settings trigger, or the member
 * profile button) can pass their own markup instead - if that markup has
 * unstable nested content (inline callbacks, deeply nested children), wrap it
 * in `useMemo`/`useCallback` at the call site so it doesn't defeat the
 * shallow-equality check below.
 */
export const useSetWorkspaceTitle = (title: ReactNode) => {
	const { setTitle } = useWorkspaceTitleContext();
	const prevTitleRef = useRef<ReactNode>(null);

	// Runs on every render (title's reference always changes), but only
	// actually updates shared state when the content meaningfully differs.
	useEffect(() => {
		if (!titlesAreEquivalent(prevTitleRef.current, title)) {
			prevTitleRef.current = title;
			setTitle(title);
		}
	}, [title, setTitle]);

	// Separate mount/unmount-only effect so clearing the slot never races
	// with the sync effect above.
	useEffect(() => {
		return () => setTitle(null);
	}, [setTitle]);
};

interface WorkspaceTitleProps {
	icon: LucideIcon;
	label: ReactNode;
}

/**
 * Standard non-interactive title-slot heading (icon + label) used by most
 * workspace pages.
 */
export const WorkspaceTitle = ({ icon: Icon, label }: WorkspaceTitleProps) => (
	<h1 className="flex w-auto items-center overflow-hidden px-3 py-2 text-lg font-semibold text-foreground">
		<Icon className="mr-2 size-5 text-muted-foreground" />
		<span className="truncate">{label}</span>
	</h1>
);
