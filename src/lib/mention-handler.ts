"use client";

import { useRouter } from "next/navigation";
import type { Id } from "@/../convex/_generated/dataModel";
import { navigateWithoutReload } from "./navigation-utils";

/**
 * Builds the URL for a member profile page
 * @param memberId - The ID of the member
 * @param workspaceId - The ID of the workspace (string from DOM attributes)
 * @returns The URL path to the member's profile
 */
export const buildMemberProfileUrl = (
	memberId: Id<"members"> | string,
	workspaceId: string
): string => {
	return `/workspace/${workspaceId}/member/${memberId}`;
};

export const createMentionElement = (
	memberId: Id<"members">,
	memberName: string,
	workspaceId: string
): string => {
	const mentionId = `mention-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
	const profileUrl = buildMemberProfileUrl(memberId, workspaceId);
	return `<a
    href="${profileUrl}"
    id="${mentionId}"
    class="user-mention"
    data-member-id="${memberId}"
    data-workspace-id="${workspaceId}"
    target="_self"
    style="color: #6366f1; font-weight: bold; cursor: pointer; text-decoration: none;">@${memberName}</a>`;
};

// Function to add click handlers to mentions in a container
export const addMentionClickHandlers = (container: HTMLElement): void => {
	const mentions = container.querySelectorAll(".user-mention");

	mentions.forEach((mention) => {
		const memberId = mention.getAttribute("data-member-id");
		const workspaceId = mention.getAttribute("data-workspace-id");

		if (memberId && workspaceId) {
			const oldElement = mention;
			const newElement = oldElement.cloneNode(true);
			if (oldElement.parentNode) {
				oldElement.parentNode.replaceChild(newElement, oldElement);
			}

			newElement.addEventListener("click", (e) => {
				e.preventDefault();
				e.stopPropagation();

				const url = buildMemberProfileUrl(memberId, workspaceId);
				navigateWithoutReload(url);
			});
		}
	});
};

// Add a global click handler for mentions
export const setupGlobalMentionHandler = (): void => {
	if (typeof window === "undefined") return;
	if ((window as any).__mentionHandlerSetup) return;

	(window as any).__mentionHandlerSetup = true;

	document.addEventListener("click", (e) => {
		const target = e.target as HTMLElement;
		const mention = target.closest(".user-mention");

		if (mention) {
			e.preventDefault();
			e.stopPropagation();

			const memberId = mention.getAttribute("data-member-id");
			const workspaceId = mention.getAttribute("data-workspace-id");

			if (memberId && workspaceId) {
				const url = buildMemberProfileUrl(memberId, workspaceId);
				navigateWithoutReload(url);
			}
		}
	});
};

/**
 * Hook for programmatic navigation to member profiles
 *
 * This hook provides a function to navigate to a member's profile page within a workspace.
 * It uses Next.js router.push internally to perform client-side navigation.
 *
 * @returns An object containing the navigateToMemberProfile function
 *
 * @example
 * ```tsx
 * import { useMentionNavigation } from '@/lib/mention-handler';
 *
 * function MyComponent() {
 *   const { navigateToMemberProfile } = useMentionNavigation();
 *
 *   const handleClick = () => {
 *     navigateToMemberProfile(memberId, workspaceId);
 *   };
 *
 *   return <button onClick={handleClick}>View Profile</button>;
 * }
 * ```
 */
export const useMentionNavigation = () => {
	const router = useRouter();

	/**
	 * Navigate to a member's profile page
	 * @param memberId - The ID of the member to navigate to (Id<"members">)
	 * @param workspaceId - The workspace ID (string)
	 */
	const navigateToMemberProfile = (
		memberId: Id<"members">,
		workspaceId: string
	) => {
		const url = buildMemberProfileUrl(memberId, workspaceId);
		router.push(url);
	};

	return { navigateToMemberProfile };
};
