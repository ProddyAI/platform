"use client";

import { Loader, Undo2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import VerificationInput from "react-verification-input";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useGetWorkspaceInfo } from "@/features/workspaces/api/use-get-workspace-info";
import { useJoin } from "@/features/workspaces/api/use-join";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import { cn } from "@/lib/utils";

const JoinWorkspaceIdPage = () => {
	const router = useRouter();
	const searchParams = useSearchParams();
	const workspaceId = useWorkspaceId();
	const codeFromUrl = searchParams.get("code");
	const inviteHash = searchParams.get("invite");
	const [code, setCode] = useState(codeFromUrl || "");
	const [inviteLoading, setInviteLoading] = useState(false);
	const [inviteError, setInviteError] = useState<string | null>(null);
	const verificationAttemptedRef = useRef(false);

	const { mutate, isPending } = useJoin();
	const { data, isLoading } = useGetWorkspaceInfo({ id: workspaceId });

	const isMember = useMemo(() => data?.isMember, [data?.isMember]);

	useEffect(() => {
		if (isMember) router.push(`/workspace/${workspaceId}`);
	}, [isMember, router, workspaceId]);

	// Handle email invite verification
	useEffect(() => {
		if (
			!inviteHash ||
			isLoading ||
			isMember ||
			verificationAttemptedRef.current
		)
			return;

		const verifyInvite = async () => {
			verificationAttemptedRef.current = true;
			setInviteLoading(true);
			setInviteError(null);

			try {
				const response = await fetch("/api/account/invite/verify", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ workspaceId, invite: inviteHash }),
				});

				const data = await response.json();

				if (data.success) {
					toast.success("Workspace joined successfully!");
					router.push(`/workspace/${workspaceId}`);
				} else {
					setInviteError(data.error || "Failed to verify invite");
					toast.error(data.error || "Failed to verify invite");
				}
			} catch (_error) {
				setInviteError("Failed to verify invite");
				toast.error("Failed to verify invite");
			} finally {
				setInviteLoading(false);
			}
		};

		verifyInvite();
	}, [inviteHash, isLoading, isMember, workspaceId, router]);

	const handleComplete = (value: string) => {
		mutate(
			{ workspaceId, joinCode: value },
			{
				onSuccess: (id) => {
					router.replace(`/workspace/${id}`);
					toast.success("Workspace joined.");
				},
				onError: () => {
					toast.error("Failed to join workspace.");
				},
			}
		);
	};

	// Auto-join if code is provided in URL
	useEffect(() => {
		if (
			codeFromUrl &&
			codeFromUrl.length === 6 &&
			!isPending &&
			!isLoading &&
			!isMember
		) {
			handleComplete(codeFromUrl);
		}
	}, [codeFromUrl, isLoading, isMember, handleComplete, isPending]);

	if (isLoading || isMember || inviteLoading) {
		return (
			<div className="flex h-full items-center justify-center">
				<Loader className="size-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	// Show error state for email invite flow
	if (inviteHash && inviteError) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-y-8 rounded-lg bg-white p-8 shadow-md">
				<Image alt="Logo" height={60} src="/logo-nobg.png" width={60} />

				<div className="flex max-w-md flex-col items-center justify-center gap-y-4">
					<div className="flex flex-col items-center justify-center gap-y-2">
						<h1 className="text-2xl font-bold">Invite Error</h1>
						<p className="text-md text-center text-destructive">
							{inviteError}
						</p>
					</div>
				</div>

				<div className="flex gap-x-4">
					<Button asChild size="lg" variant="outline">
						<Link href="/home">
							<Undo2 className="mr-2 size-4" /> Back to home
						</Link>
					</Button>
				</div>
			</div>
		);
	}

	// Show join code input (default flow)
	return (
		<div className="flex h-full flex-col items-center justify-center gap-y-8 rounded-lg bg-white p-8 shadow-md">
			<Image alt="Logo" height={60} src="/logo-nobg.png" width={60} />

			<div className="flex max-w-md flex-col items-center justify-center gap-y-4">
				<div className="flex flex-col items-center justify-center gap-y-2">
					<h1 className="text-2xl font-bold">
						Join {data?.name ?? "Workspace"}
					</h1>

					<p className="text-md text-muted-foreground">
						Enter the workspace code to join.
					</p>
				</div>

				<VerificationInput
					autoFocus={!codeFromUrl}
					classNames={{
						container: cn(
							"flex gap-x-2",
							isPending && "opacity-50 cursor-not-allowed pointer-events-none"
						),
						character:
							"uppercase h-auto rounded-md border border-gray-300 outline-rose-500 flex items-center justify-center text-lg font-medium text-gray-500",
						characterInactive: "bg-muted",
						characterSelected: "bg-white text-black",
						characterFilled: "bg-white text-black",
					}}
					length={6}
					onChange={setCode}
					onComplete={handleComplete}
					validChars="A-Za-z0-9"
					value={code}
				/>
			</div>

			<div className="flex gap-x-4">
				<Button asChild size="lg" variant="outline">
					<Link href="/home">
						<Undo2 className="mr-2 size-4" /> Back to home
					</Link>
				</Button>
			</div>
		</div>
	);
};

export default JoinWorkspaceIdPage;
