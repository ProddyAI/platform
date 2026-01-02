"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  RefreshCw,
  Shield,
  Trash2,
  UserCog,
  UserPlus,
  Eye,
  EyeOff,
  Copy,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGetMembers } from "@/features/members/api/use-get-members";
import { useUpdateMember } from "@/features/members/api/use-update-member";
import { useRemoveMember } from "@/features/members/api/use-remove-member";
import { useNewJoinCode } from "@/features/workspaces/api/use-new-join-code";
import { useGetWorkspace } from "@/features/workspaces/api/use-get-workspace";
import { InviteModal } from "@/app/workspace/[workspaceId]/invitation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { Id, Doc } from "@/../convex/_generated/dataModel";

interface MembersManagementProps {
  workspaceId: Id<"workspaces">;
  currentMember: Doc<"members">;
}

export const MembersManagement = ({
  workspaceId,
  currentMember,
}: MembersManagementProps) => {
  const { data: members, isLoading } = useGetMembers({ workspaceId });
  const { data: workspace, isLoading: workspaceLoading } = useGetWorkspace({
    id: workspaceId,
  });
  const [selectedMemberId, setSelectedMemberId] =
    useState<Id<"members"> | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [showJoinCode, setShowJoinCode] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);

  const updateMember = useUpdateMember();
  const removeMember = useRemoveMember();
  const newJoinCode = useNewJoinCode();

  const isOwner = currentMember.role === "owner";
  const isAdmin = currentMember.role === "admin";

  // Count the number of owners in the workspace
  const ownerCount = members?.filter((m) => m.role === "owner").length || 0;
  const isOnlyOwner = isOwner && ownerCount === 1;

  const handleUpdateRole = async (
    memberId: Id<"members">,
    role: "owner" | "admin" | "member"
  ) => {
    // Prevent the only owner from downgrading themselves
    if (memberId === currentMember._id && isOnlyOwner && role !== "owner") {
      toast.error("Cannot change role", {
        description: "You are the only owner. Assign another owner first before changing your role.",
      });
      return;
    }

    setIsUpdating(true);

    try {
      await updateMember.mutate({
        id: memberId,
        role,
      });

      toast.success(`User role updated to ${role}`);
    } catch (error: any) {
      toast.error(error.message || "Failed to update user role");
    } finally {
      setIsUpdating(false);
    }
  };

  const openRemoveDialog = (memberId: Id<"members">) => {
    setSelectedMemberId(memberId);
    setRemoveDialogOpen(true);
  };

  const handleRemoveMember = async () => {
    if (!selectedMemberId) return;

    setIsRemoving(true);

    try {
      await removeMember.mutate({
        id: selectedMemberId,
      });

      toast.success("Member removed from workspace");
      setRemoveDialogOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to remove member");
    } finally {
      setIsRemoving(false);
    }
  };

  const handleGenerateNewCode = async () => {
    setIsGeneratingCode(true);

    try {
      await newJoinCode.mutate({
        workspaceId,
      });

      toast.success("New join code generated");
    } catch (error) {
      toast.error("Failed to generate new join code");
    } finally {
      setIsGeneratingCode(false);
    }
  };

  const handleCopyJoinCode = () => {
    if (!workspace) return;

    navigator.clipboard.writeText(workspace.joinCode);
    toast.success("Join code copied to clipboard");
  };

  const handleCopyJoinLink = () => {
    if (!workspace) return;

    const joinLink = `${window.location.origin}/join/${workspaceId}`;
    navigator.clipboard.writeText(joinLink);
    toast.success("Join link copied to clipboard");
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "owner":
        return "bg-purple-100 text-purple-800 hover:bg-purple-200";
      case "admin":
        return "bg-blue-100 text-blue-800 hover:bg-blue-200";
      default:
        return "bg-gray-100 text-gray-800 hover:bg-gray-200";
    }
  };

  return (
    <>
      {workspace && (
        <InviteModal
          open={inviteOpen}
          setOpen={setInviteOpen}
          name={workspace.name}
          joinCode={workspace.joinCode}
        />
      )}
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-medium">Members</h3>
            <p className="text-sm text-muted-foreground">
              Manage the members in your workspace and their roles
            </p>
          </div>

          {(isOwner || isAdmin) && (
            <Button onClick={() => setInviteOpen(true)} className="ml-auto">
              <UserPlus className="mr-2 h-4 w-4" />
              Invite People
            </Button>
          )}
        </div>

        {(isOwner || isAdmin) && workspace && (
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="grid gap-2">
              <Label htmlFor="joinCode">Workspace Join Code</Label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    id="joinCode"
                    value={showJoinCode ? workspace.joinCode : "••••••"}
                    readOnly
                    className="flex-1 pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2"
                    onClick={() => setShowJoinCode(!showJoinCode)}
                  >
                    {showJoinCode ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <div className="h-8 w-px bg-gradient-to-b from-transparent via-border to-transparent" />
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={handleCopyJoinCode}
                  className="gap-1.5 h-8 px-2.5"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline text-xs italic font-medium">Copy Code</span>
                </Button>
                <Button 
                  variant="outline"
                  size="sm"
                  onClick={handleCopyJoinLink}
                  className="gap-1.5 h-8 px-2.5"
                >
                  <Link2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline text-xs italic font-medium">Copy Link</span>
                </Button>
                <div className="h-8 w-px bg-gradient-to-b from-transparent via-border to-transparent" />
                <Button
                  variant="outline"
                  onClick={handleGenerateNewCode}
                  disabled={isGeneratingCode}
                >
                  {isGeneratingCode ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Share this code with others to invite them to your workspace
              </p>
            </div>
          </div>
        )}

        <Separator />

        {isLoading ? (
          <div className="flex justify-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !members || members.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Shield className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">No members</h3>
            <p className="text-sm text-muted-foreground">
              Invite members to your workspace
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="w-[200px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((member) => (
                <TableRow key={member._id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage
                          src={member.user.image}
                          alt={member.user.name}
                        />
                        <AvatarFallback>
                          {member.user.name?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{member.user.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {member.user.email}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getRoleBadgeColor(member.role)}>
                      {member.role}
                    </Badge>
                  </TableCell>
                   <TableCell>
                    <div className="flex items-center gap-2">
                      {/* Role Management Dropdown */}
                      {(isOwner || (isAdmin && member.role === "member")) && 
                       !(member._id === currentMember._id && isOnlyOwner) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isUpdating}
                            >
                              <UserCog className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {isOwner && (
                              <DropdownMenuItem
                                onClick={() =>
                                  handleUpdateRole(member._id, "owner")
                                }
                                disabled={member.role === "owner"}
                              >
                                Make Owner
                              </DropdownMenuItem>
                            )}
                            {(isOwner || isAdmin) && (
                              <DropdownMenuItem
                                onClick={() =>
                                  handleUpdateRole(member._id, "admin")
                                }
                                disabled={member.role === "admin"}
                              >
                                Make Admin
                              </DropdownMenuItem>
                            )}
                            {(isOwner || isAdmin) && (
                              <DropdownMenuItem
                                onClick={() =>
                                  handleUpdateRole(member._id, "member")
                                }
                                disabled={member.role === "member"}
                              >
                                Make Member
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                      {/* Show a badge for the only owner instead of role change button */}
                      {member._id === currentMember._id && isOnlyOwner && (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          Only Owner
                        </Badge>
                      )}

                      {/* Remove Member Button */}
                      {((isOwner && member.role !== "owner") ||
                        (isAdmin && member.role === "member")) && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10"
                            onClick={() => openRemoveDialog(member._id)}
                            disabled={member._id === currentMember._id}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Remove Member Dialog */}
        <AlertDialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will remove the member from
                your workspace and delete all of their messages and reactions.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRemoveMember}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={isRemoving}
              >
                {isRemoving ? "Removing..." : "Remove Member"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );
};
