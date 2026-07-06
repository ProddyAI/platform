import { useProfileMemberId } from "@/features/members/hooks/use-profile-member-id";
import { useParentMessageId } from "@/features/messages/hooks/use-parent-message-id";

export const usePanel = () => {
	const [parentMessageId, setParentMessageId] = useParentMessageId();
	const [profileMemberId, setProfileMemberId] = useProfileMemberId();

	const onOpenMessage = (messageId: string) => {
		setParentMessageId(messageId);
		setProfileMemberId(null);
	};

	const onOpenProfile = (memberId: string) => {
		setProfileMemberId(memberId);
		setParentMessageId(null);
	};

	const onClose = () => {
		setParentMessageId(null);
		setProfileMemberId(null);
	};

	return {
		parentMessageId,
		profileMemberId,
		onOpenMessage,
		onOpenProfile,
		onClose,
	};
};
