"use client";

import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { Doc } from "@/../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useUpdateWorkspaceFeatures } from "@/features/workspaces/api/use-update-workspace-features";

const FEATURE_OPTIONS = [
    {
        id: "canvas",
        label: "Canvas",
        description: "Enable visual brainstorming in channel tabs.",
    },
    {
        id: "notes",
        label: "Notes",
        description: "Enable structured notes in channel tabs.",
    },
    {
        id: "boards",
        label: "Boards",
        description: "Enable kanban boards in channel tabs.",
    },
] as const;

type FeatureKey = (typeof FEATURE_OPTIONS)[number]["id"];

interface FeaturesManagementProps {
    workspace: Doc<"workspaces">;
}

export const FeaturesManagement = ({
    workspace,
}: FeaturesManagementProps) => {
    const updateFeatures = useUpdateWorkspaceFeatures();
    const [enabledFeatures, setEnabledFeatures] = useState<FeatureKey[]>([]);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const current = (workspace.enabledFeatures ?? []) as FeatureKey[];
        setEnabledFeatures(current);
    }, [workspace.enabledFeatures]);

    const featureSet = useMemo(
        () => new Set<FeatureKey>(enabledFeatures),
        [enabledFeatures]
    );

    const handleToggle = async (feature: FeatureKey) => {
        const previous = enabledFeatures;
        const nextFeatures = featureSet.has(feature)
            ? enabledFeatures.filter((item) => item !== feature)
            : [...enabledFeatures, feature];

        setEnabledFeatures(nextFeatures);

        try {
            await updateFeatures.mutate({
                id: workspace._id,
                enabledFeatures: nextFeatures,
            });
        } catch (_error) {
            toast.error("Failed to update feature settings");
            setEnabledFeatures(previous);
        }
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div>
                    <CardTitle className="text-base font-semibold">
                        Channel Defaults
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                        Applies to new channels created in this workspace.
                    </p>
                </div>
                <Button
                    className="gap-2"
                    onClick={() => setIsOpen((prev) => !prev)}
                    size="sm"
                    variant="outline"
                >
                    <Plus className="size-4" />
                    {isOpen ? "Hide Options" : "Set Defaults"}
                </Button>
            </CardHeader>
            {isOpen && (
                <CardContent className="space-y-4">
                    <div className="text-sm text-muted-foreground">
                        Existing channels keep their current settings.
                    </div>
                    <div className="space-y-3">
                        {FEATURE_OPTIONS.map((feature) => {
                            const isEnabled = featureSet.has(feature.id);

                            return (
                                <div
                                    className="flex items-center justify-between gap-4 rounded-lg border border-border/70 p-3"
                                    key={feature.id}
                                >
                                    <div>
                                        <div className="text-sm font-medium">
                                            {feature.label}
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            {feature.description}
                                        </p>
                                    </div>
                                    <Switch
                                        checked={isEnabled}
                                        disabled={updateFeatures.isPending}
                                        onCheckedChange={() => handleToggle(feature.id)}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            )}
        </Card>
    );
};
