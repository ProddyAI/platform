"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWorkspaceId } from "@/hooks/use-workspace-id";

import { useInviteMemberModal } from "../store/use-invite-member-modal";

export const InviteMemberModal = () => {
    const workspaceId = useWorkspaceId();
    const [open, setOpen] = useInviteMemberModal();

    const [email, setEmail] = useState("");
    const [inviteLoading, setInviteLoading] = useState(false);

    const handleClose = () => {
        setOpen(false);
        setEmail("");
    };

    const sendInvite = async () => {
        // Email validation regex
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!email || !emailRegex.test(email.trim())) {
            toast.error("Enter a valid email address");
            return;
        }

        try {
            setInviteLoading(true);
            const res = await fetch("/api/account/invite", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    workspaceId,
                    email,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Failed to send invite");
            }

            toast.success("Invite sent successfully");
            handleClose();
        } catch (err: unknown) {
            const errorMessage =
                err instanceof Error ? err.message : "Failed to send invite";
            toast.error(errorMessage);
        } finally {
            setInviteLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && !inviteLoading) {
            e.preventDefault();
            sendInvite();
        }
    };

    return (
        <Dialog onOpenChange={handleClose} open={open}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Invite Member</DialogTitle>
                    <DialogDescription>
                        Send an email invitation to join your workspace
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="invite-email">Email Address</Label>
                        <Input
                            autoFocus
                            disabled={inviteLoading}
                            id="invite-email"
                            onChange={(e) => setEmail(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="colleague@example.com"
                            type="email"
                            value={email}
                        />
                    </div>
                    <div className="flex justify-end gap-3">
                        <Button
                            disabled={inviteLoading}
                            onClick={handleClose}
                            variant="outline"
                        >
                            Cancel
                        </Button>
                        <Button disabled={inviteLoading || !email} onClick={sendInvite}>
                            {inviteLoading ? "Sending..." : "Send Invite"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};
