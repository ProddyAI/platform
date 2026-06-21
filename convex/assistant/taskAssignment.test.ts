import { describe, expect, test } from "bun:test";
import { canAssignTaskToMember } from "./taskAssignment";

describe("canAssignTaskToMember", () => {
	test("allows self-assignment", () => {
		expect(
			canAssignTaskToMember({
				currentMemberId: "member_1",
				currentRole: "member",
				targetMemberId: "member_1",
				targetWasInvitedByCurrentMember: false,
			})
		).toBe(true);
	});

	test("allows owner and admin cross-member assignment", () => {
		expect(
			canAssignTaskToMember({
				currentMemberId: "member_1",
				currentRole: "owner",
				targetMemberId: "member_2",
				targetWasInvitedByCurrentMember: false,
			})
		).toBe(true);

		expect(
			canAssignTaskToMember({
				currentMemberId: "member_1",
				currentRole: "admin",
				targetMemberId: "member_2",
				targetWasInvitedByCurrentMember: false,
			})
		).toBe(true);
	});

	test("allows inviters to assign to accepted invitees they brought in", () => {
		expect(
			canAssignTaskToMember({
				currentMemberId: "member_1",
				currentRole: "member",
				targetMemberId: "member_2",
				targetWasInvitedByCurrentMember: true,
			})
		).toBe(true);
	});

	test("rejects cross-member assignment without elevated role or invite relationship", () => {
		expect(
			canAssignTaskToMember({
				currentMemberId: "member_1",
				currentRole: "member",
				targetMemberId: "member_2",
				targetWasInvitedByCurrentMember: false,
			})
		).toBe(false);
	});
});
