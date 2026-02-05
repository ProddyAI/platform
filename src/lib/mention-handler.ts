"use client";

import { useRouter } from "next/navigation";
import type { Id } from "@/../convex/_generated/dataModel";
import { navigateWithoutReload } from "./navigation-utils";

export const createMentionElement = (
	memberId: Id<"members">,
	memberName: string,
	workspaceId: string
): string => {
	const mentionId = `mention-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
	return `<a
    href="/workspace/${workspaceId}/member/${memberId}"
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

				const url = `/workspace/${workspaceId}/member/${memberId}`;
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
				const url = `/workspace/${workspaceId}/member/${memberId}`;
				navigateWithoutReload(url);
			}
		}
	});
};

export const useMentionNavigation = () => {
	const router = useRouter();

	const navigateToMemberProfile = (memberId: string, workspaceId: string) => {
		const url = `/workspace/${workspaceId}/member/${memberId}`;
		router.push(url);
	};

	return { navigateToMemberProfile };
};
