type AssignmentRole = "owner" | "admin" | "member";

export function canAssignTaskToMember(options: {
	currentMemberId: string;
	currentRole: AssignmentRole;
	targetMemberId: string;
	targetWasInvitedByCurrentMember: boolean;
}) {
	if (options.currentMemberId === options.targetMemberId) {
		return true;
	}

	if (options.currentRole === "owner" || options.currentRole === "admin") {
		return true;
	}

	return options.targetWasInvitedByCurrentMember;
}
