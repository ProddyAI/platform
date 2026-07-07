import { Crown, Eye, type LucideIcon, Users } from "lucide-react";

export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";

interface RoleMeta {
	label: string;
	description: string;
	icon: LucideIcon;
}

/**
 * Single source of truth for role labels/descriptions/icons, shared by the
 * invite modal, the members-management admin table, and the per-member
 * profile role dropdown. `viewer` is a valid ongoing membership role but is
 * not offered on new invites (see INVITE_ROLES below) — the backend schema
 * keeps it in workspaceInvites only for backward compatibility with older
 * pending invite documents.
 */
export const ROLE_META: Record<WorkspaceRole, RoleMeta> = {
	owner: {
		label: "Owner",
		description: "Full billing, workspace, and role control",
		icon: Crown,
	},
	admin: {
		label: "Admin",
		description: "Full management and settings access",
		icon: Crown,
	},
	member: {
		label: "Member",
		description: "Standard access to workspace features",
		icon: Users,
	},
	viewer: {
		label: "Viewer",
		description: "Read-only access to workspace content",
		icon: Eye,
	},
};

/** Roles offered when inviting a brand-new member (excludes viewer). */
export const INVITE_ROLES: WorkspaceRole[] = ["member", "admin", "owner"];
