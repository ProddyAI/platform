"use client";

import { ChevronDown, Plus, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { Doc } from "@/../convex/_generated/dataModel";
import { Hint } from "@/components/hint";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useGetWorkspaces } from "@/features/workspaces/api/use-get-workspaces";
import { useCreateWorkspaceModal } from "@/features/workspaces/store/use-create-workspace-modal";
import { cn } from "@/lib/utils";

import { InviteModal } from "./invitation";

interface WorkspaceHeaderProps {
	workspace: Doc<"workspaces">;
	isAdmin: boolean;
	isCollapsed?: boolean;
}

export const WorkspaceHeader = ({
	workspace,
	isAdmin,
	isCollapsed = false,
}: WorkspaceHeaderProps) => {
	const router = useRouter();
	const [inviteOpen, setInviteOpen] = useState(false);
	const [switchOpen, setSwitchOpen] = useState(false);
	const [_, setCreateOpen] = useCreateWorkspaceModal();
	const { data: workspaces } = useGetWorkspaces();

	const onWorkspaceClick = (id: string) => {
		setSwitchOpen(false); // updated reference
		router.push(`/workspace/${id}`);
	};

	return (
		<>
			<InviteModal
				open={inviteOpen}
				setOpen={setInviteOpen}
				name={workspace.name}
				joinCode={workspace.joinCode}
			/>

			<div
				className={cn(
					"flex h-14 md:h-16 items-center justify-between gap-1 border-b border-primary/20",
					isCollapsed ? "px-1 md:px-2" : "px-2 md:px-6"
				)}
			>
				<div className="flex items-center gap-1">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							{isCollapsed ? (
								<Hint label={workspace.name} side="right" align="center">
									<Button
										variant="ghost"
										className="mt-3 md:mt-5 h-12 md:h-14 group flex items-center justify-center p-1 md:p-1.5 text-secondary-foreground hover:bg-secondary-foreground/10 transition-standard"
										size="icon"
									>
										<div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-[10px] bg-secondary text-secondary-foreground shadow-md transition-standard group-hover:shadow-lg flex-shrink-0">
											{workspace.name.charAt(0).toUpperCase()}
										</div>
									</Button>
								</Hint>
							) : (
								<Button
									variant="ghost"
									className="mt-3 md:mt-5 h-12 md:h-14 group flex items-center gap-2 md:gap-4 overflow-hidden p-1.5 md:p-2.5 text-secondary-foreground hover:bg-secondary-foreground/10 transition-standard"
									size="lg"
								>
									<div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-[10px] bg-secondary text-secondary-foreground shadow-md transition-standard group-hover:shadow-lg flex-shrink-0">
										{workspace.name.charAt(0).toUpperCase()}
									</div>
									<div className="flex flex-col items-start min-w-0">
										<span className="text-sm md:text-base font-semibold tracking-tight truncate max-w-[100px] md:max-w-full">
											{workspace.name}
										</span>
										<span className="text-xs text-secondary-foreground/70 hidden md:inline-block">
											Active Workspace
										</span>
									</div>
									<ChevronDown className="ml-0.5 size-3.5 shrink-0 opacity-70 transition-transform duration-200 group-hover:rotate-180" />
								</Button>
							)}
						</DropdownMenuTrigger>

						<DropdownMenuContent
							side="bottom"
							align="start"
							className="w-64 p-2"
						>
							<DropdownMenuItem className="cursor-pointer capitalize rounded-[8px] p-3 mb-1 hover:bg-accent/20">
								<div className="relative mr-3 flex size-10 items-center justify-center overflow-hidden rounded-[10px] bg-secondary text-xl font-semibold text-secondary-foreground shadow-md">
									{workspace.name.charAt(0).toUpperCase()}
								</div>

								<div className="flex flex-col items-start">
									<p className="font-bold tracking-tight">{workspace.name}</p>
									<p className="text-xs text-muted-foreground">
										Active workspace
									</p>
								</div>
							</DropdownMenuItem>

							{isAdmin && (
								<>
									<DropdownMenuSeparator />

									<DropdownMenuItem
										className="cursor-pointer py-2.5 flex items-center gap-3 group rounded-[8px] hover:bg-accent/20"
										onClick={() => setInviteOpen(true)}
									>
										<div className="flex h-6 w-6 items-center justify-center rounded-[8px] bg-secondary/10 transition-standard group-hover:bg-secondary/20">
											<Plus className="size-3.5 text-secondary transition-transform duration-200 group-hover:scale-125" />
										</div>
										<span className="font-medium">
											Invite to {workspace.name}
										</span>
									</DropdownMenuItem>
								</>
							)}

							<DropdownMenuSeparator />
							<DropdownMenuItem
								className="cursor-pointer py-2.5 flex items-center gap-3 group rounded-[8px] hover:bg-accent/20"
								onClick={() => setSwitchOpen(true)} // updated here
							>
								<div className="flex h-6 w-6 items-center justify-center rounded-[8px] bg-secondary/10 transition-standard group-hover:bg-secondary/20">
									<RefreshCw className="size-3.5 text-secondary transition-transform duration-200 group-hover:rotate-45" />
								</div>
								<span className="font-medium">Switch Workspace</span>
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>

					<Dialog open={switchOpen} onOpenChange={setSwitchOpen}>
						{" "}
						{/* updated here */}
						<DialogContent className="overflow-hidden p-0 rounded-[12px] border-0 shadow-xl">
							<DialogHeader className="border-b p-5 bg-muted/30">
								<DialogTitle className="text-xl font-semibold tracking-tight">
									Workspaces
								</DialogTitle>
								<DialogDescription className="text-sm text-muted-foreground">
									Select a workspace to switch to.
								</DialogDescription>
							</DialogHeader>

							<div className="flex flex-col gap-y-3 p-5">
								{workspaces?.map((item) => (
									<button
										key={item._id}
										onClick={() => onWorkspaceClick(item._id)}
										className="flex w-full cursor-pointer items-center gap-x-4 rounded-[10px] border bg-card px-4 py-3 hover:bg-accent/10 transition-standard hover:translate-x-1 group"
									>
										<div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-secondary text-secondary-foreground shadow-md transition-standard group-hover:shadow-lg">
											{item.name.charAt(0).toUpperCase()}
										</div>
										<div className="flex flex-col items-start">
											<p className="text-sm font-semibold tracking-tight">
												{item.name}
											</p>
											{item._id === workspace._id && (
												<p className="text-xs text-muted-foreground">
													Current workspace
												</p>
											)}
										</div>
										{item._id === workspace._id && (
											<div className="ml-auto rounded-full bg-secondary/10 px-3 py-1 text-xs font-medium text-secondary shadow-sm">
												Active
											</div>
										)}
									</button>
								))}

								<button
									onClick={() => {
										setSwitchOpen(false); // updated here
										setCreateOpen(true);
									}}
									className="flex w-full cursor-pointer items-center gap-x-4 rounded-[10px] border border-dashed bg-card/50 px-4 py-3 hover:bg-accent/10 transition-standard hover:translate-x-1 group mt-2"
								>
									<div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-secondary text-secondary-foreground shadow-md transition-standard group-hover:shadow-lg">
										<Plus className="size-5 transition-transform duration-200 group-hover:scale-125" />
									</div>
									<p className="text-sm font-semibold tracking-tight">
										Create New Workspace
									</p>
								</button>
							</div>
						</DialogContent>
					</Dialog>
				</div>
			</div>
		</>
	);
};
