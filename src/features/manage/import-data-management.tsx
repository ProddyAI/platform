"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
    Download,
    ExternalLink,
    CheckCircle2,
    AlertCircle,
    Loader2,
    RefreshCw,
    Trash2,
    Upload
} from "lucide-react";
import {
    SiClickup,
    SiLinear,
    SiMiro,
    SiNotion,
    SiSlack,
    SiTodoist
} from "react-icons/si";
import type { Doc, Id } from "@/../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useGetImportConnections } from "@/features/imports/api/use-get-import-connections";
import { useGetImportJobs } from "@/features/imports/api/use-get-import-jobs";
import { useInitiateSlackOAuth } from "@/features/imports/api/use-initiate-slack-oauth";
import { useStartSlackImport } from "@/features/imports/api/use-start-slack-import";
import { useDisconnectImport } from "@/features/imports/api/use-disconnect-import";
import { useCancelImportJob } from "@/features/imports/api/use-cancel-import-job";

interface ImportDataManagementProps {
    workspaceId: Id<"workspaces">;
    currentMember: Doc<"members">;
}

// Platform configuration
const PLATFORMS = [
    {
        id: "slack",
        name: "Slack",
        description: "Import channels, messages, and user data from Slack workspaces",
        icon: SiSlack,
        color: "bg-purple-100 text-purple-700 border-purple-300",
        available: true,
    },
    {
        id: "todoist",
        name: "Todoist",
        description: "Import tasks, projects, and labels from Todoist",
        icon: SiTodoist,
        color: "bg-red-100 text-red-700 border-red-300",
        available: false, // Coming soon
    },
    {
        id: "linear",
        name: "Linear",
        description: "Import issues, projects, and workflows from Linear",
        icon: SiLinear,
        color: "bg-blue-100 text-blue-700 border-blue-300",
        available: false, // Coming soon
    },
    {
        id: "notion",
        name: "Notion",
        description: "Import pages, databases, and content from Notion",
        icon: SiNotion,
        color: "bg-gray-100 text-gray-700 border-gray-300",
        available: false, // Coming soon
    },
    {
        id: "miro",
        name: "Miro",
        description: "Import boards, frames, and collaboration data from Miro",
        icon: SiMiro,
        color: "bg-yellow-100 text-yellow-700 border-yellow-300",
        available: false, // Coming soon
    },
    {
        id: "clickup",
        name: "ClickUp",
        description: "Import tasks, lists, and spaces from ClickUp",
        icon: SiClickup,
        color: "bg-pink-100 text-pink-700 border-pink-300",
        available: false, // Coming soon
    },
];

export const ImportDataManagement = ({
    workspaceId,
    currentMember,
}: ImportDataManagementProps) => {
    const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
    const [configDialogOpen, setConfigDialogOpen] = useState(false);
    const [importConfig, setImportConfig] = useState({
        includeFiles: true,
        includeThreads: true,
        channels: [] as string[],
    });

    // Hooks
    const { data: connections, isLoading: isLoadingConnections } = useGetImportConnections({ workspaceId });
    const { data: jobs, isLoading: isLoadingJobs } = useGetImportJobs({ workspaceId, limit: 10 });
    const initiateSlackOAuth = useInitiateSlackOAuth();
    const startSlackImport = useStartSlackImport();
    const disconnectImport = useDisconnectImport();
    const cancelImportJob = useCancelImportJob();

    const handleConnect = async (platformId: string) => {
        if (platformId !== "slack") {
            toast.info("This platform will be available soon!");
            return;
        }

        try {
            const result = await initiateSlackOAuth.mutate(
                { workspaceId },
                { throwError: true }
            );

            if (result?.authUrl) {
                window.location.href = result.authUrl;
            }
        } catch (error) {
            toast.error("Failed to start connection");
        }
    };

    const handleStartImport = (platformId: string) => {
        setSelectedPlatform(platformId);
        setConfigDialogOpen(true);
    };

    const handleConfirmImport = async () => {
        try {
            await startSlackImport.mutate(
                {
                    workspaceId,
                    config: {
                        includeFiles: importConfig.includeFiles,
                        includeThreads: importConfig.includeThreads,
                    },
                },
                { throwError: true }
            );

            toast.success("Import started! You'll receive an email when it's complete.");
            setConfigDialogOpen(false);
        } catch (error) {
            toast.error("Failed to start import");
        }
    };

    const handleDisconnect = async (connectionId: Id<"import_connections">) => {
        try {
            await disconnectImport.mutate(
                { connectionId },
                { throwError: true }
            );
            toast.success("Disconnected successfully");
        } catch (error) {
            toast.error("Failed to disconnect");
        }
    };

    const handleCancelJob = async (jobId: Id<"import_jobs">) => {
        try {
            await cancelImportJob.mutate(
                { jobId },
                { throwError: true }
            );
            toast.success("Import cancelled");
        } catch (error) {
            toast.error("Failed to cancel import");
        }
    };

    const getConnectionForPlatform = (platformId: string) => {
        return connections?.find((c: any) => c.platform === platformId && c.status === "active");
    };

    const getLatestJobForPlatform = (platformId: string) => {
        return jobs?.find((j: any) => j.platform === platformId);
    };

    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleString();
    };

    const getStatusBadge = (status: string) => {
        const variants: Record<string, { variant: any; icon: any }> = {
            active: { variant: "default", icon: <CheckCircle2 className="h-3 w-3" /> },
            expired: { variant: "secondary", icon: <AlertCircle className="h-3 w-3" /> },
            revoked: { variant: "destructive", icon: <Trash2 className="h-3 w-3" /> },
            pending: { variant: "outline", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
            in_progress: { variant: "outline", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
            completed: { variant: "default", icon: <CheckCircle2 className="h-3 w-3" /> },
            failed: { variant: "destructive", icon: <AlertCircle className="h-3 w-3" /> },
            cancelled: { variant: "secondary", icon: <AlertCircle className="h-3 w-3" /> },
        };

        const config = variants[status] || variants.active;
        return (
            <Badge variant={config.variant} className="flex items-center gap-1">
                {config.icon}
                {status.replace("_", " ")}
            </Badge>
        );
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h3 className="text-lg font-medium">Import Data</h3>
                <p className="text-sm text-muted-foreground">
                    Connect to external platforms and import your data into Proddy. Currently supports Slack with more platforms coming soon.
                </p>
            </div>

            <Separator />

            {/* Platform Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {PLATFORMS.map((platform) => {
                    const connection = getConnectionForPlatform(platform.id);
                    const latestJob = getLatestJobForPlatform(platform.id);

                    return (
                        <Card key={platform.id} className={`relative ${!platform.available ? "opacity-60" : ""}`}>
                            <CardHeader>
                                <div className="flex items-start justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-lg border ${platform.color}`}>
                                            <platform.icon className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-base">{platform.name}</CardTitle>
                                            {!platform.available && (
                                                <Badge variant="secondary" className="mt-1">Coming Soon</Badge>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <CardDescription className="text-xs mt-2">
                                    {platform.description}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {connection ? (
                                    <>
                                        <div className="flex items-center gap-2 text-sm">
                                            {getStatusBadge(connection.status)}
                                            <span className="text-muted-foreground text-xs">
                                                Connected {connection.teamName && `to ${connection.teamName}`}
                                            </span>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                className="flex-1"
                                                onClick={() => handleStartImport(platform.id)}
                                                disabled={!platform.available}
                                            >
                                                <Upload className="h-4 w-4 mr-2" />
                                                Start Import
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleDisconnect(connection._id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </>
                                ) : (
                                    <Button
                                        size="sm"
                                        className="w-full"
                                        onClick={() => handleConnect(platform.id)}
                                        disabled={!platform.available}
                                    >
                                        <ExternalLink className="h-4 w-4 mr-2" />
                                        Connect {platform.name}
                                    </Button>
                                )}

                                {latestJob && (
                                    <div className="pt-2 border-t">
                                        <div className="flex items-center justify-between text-xs mb-1">
                                            <span className="text-muted-foreground">Latest Import</span>
                                            {getStatusBadge(latestJob.status)}
                                        </div>
                                        {latestJob.status === "in_progress" && (
                                            <div className="space-y-1">
                                                <Progress value={(latestJob.progress.messagesImported / (latestJob.progress.messagesTotal || 1)) * 100} />
                                                <p className="text-xs text-muted-foreground">
                                                    {latestJob.progress.currentStep}
                                                </p>
                                            </div>
                                        )}
                                        {latestJob.status === "completed" && latestJob.result && (
                                            <p className="text-xs text-muted-foreground">
                                                {latestJob.result.channelsCreated.length} channels, {latestJob.result.messagesCreated.toLocaleString()} messages
                                            </p>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Import History */}
            {jobs && jobs.length > 0 && (
                <>
                    <Separator />
                    <div>
                        <h3 className="text-lg font-medium mb-4">Import History</h3>
                        <div className="border rounded-lg">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Platform</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Started</TableHead>
                                        <TableHead>Progress</TableHead>
                                        <TableHead>Results</TableHead>
                                        <TableHead>Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {jobs.map((job: any) => (
                                        <TableRow key={job._id}>
                                            <TableCell className="font-medium">
                                                {PLATFORMS.find(p => p.id === job.platform)?.name || job.platform}
                                            </TableCell>
                                            <TableCell>{getStatusBadge(job.status)}</TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {job.startedAt ? formatDate(job.startedAt) : "—"}
                                            </TableCell>
                                            <TableCell>
                                                {job.status === "in_progress" ? (
                                                    <div className="space-y-1 min-w-[150px]">
                                                        <Progress
                                                            value={(job.progress.messagesImported / (job.progress.messagesTotal || 1)) * 100}
                                                        />
                                                        <p className="text-xs text-muted-foreground">
                                                            {job.progress.currentStep}
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <span className="text-sm text-muted-foreground">
                                                        {job.status === "completed" ? "100%" : "—"}
                                                    </span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {job.result ? (
                                                    <div className="text-xs space-y-1">
                                                        <div>{job.result.channelsCreated.length} channels</div>
                                                        <div>{job.result.messagesCreated.toLocaleString()} messages</div>
                                                    </div>
                                                ) : (
                                                    <span className="text-sm text-muted-foreground">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {job.status === "in_progress" && (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => handleCancelJob(job._id)}
                                                    >
                                                        Cancel
                                                    </Button>
                                                )}
                                                {job.status === "failed" && (
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => handleStartImport(job.platform)}
                                                    >
                                                        <RefreshCw className="h-4 w-4 mr-1" />
                                                        Retry
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                </>
            )}

            {/* Import Configuration Dialog */}
            <Dialog open={configDialogOpen} onOpenChange={setConfigDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Configure Import</DialogTitle>
                        <DialogDescription>
                            Choose what to import from {selectedPlatform && PLATFORMS.find(p => p.id === selectedPlatform)?.name}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="includeFiles"
                                checked={importConfig.includeFiles}
                                onCheckedChange={(checked) =>
                                    setImportConfig(prev => ({ ...prev, includeFiles: checked as boolean }))
                                }
                            />
                            <Label htmlFor="includeFiles" className="text-sm font-normal">
                                Include file attachments
                            </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="includeThreads"
                                checked={importConfig.includeThreads}
                                onCheckedChange={(checked) =>
                                    setImportConfig(prev => ({ ...prev, includeThreads: checked as boolean }))
                                }
                            />
                            <Label htmlFor="includeThreads" className="text-sm font-normal">
                                Include threaded conversations
                            </Label>
                        </div>
                        <div className="pt-2">
                            <p className="text-sm text-muted-foreground">
                                The import will include all accessible channels and messages. This may take several minutes depending on the amount of data.
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfigDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleConfirmImport}>
                            <Download className="h-4 w-4 mr-2" />
                            Start Import
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};
