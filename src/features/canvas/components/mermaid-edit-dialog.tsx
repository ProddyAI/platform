"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface MermaidEditDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	mermaidCode: string;
	onSave: (code: string) => void;
}

export const MermaidEditDialog = ({
	open,
	onOpenChange,
	mermaidCode,
	onSave,
}: MermaidEditDialogProps) => {
	const [code, setCode] = useState(mermaidCode);
	const [isSaving, setIsSaving] = useState(false);

	// Reset code when dialog opens
	const handleOpenChange = (newOpen: boolean) => {
		if (newOpen) {
			setCode(mermaidCode);
		}
		onOpenChange(newOpen);
	};

	const handleSave = async () => {
		const trimmedCode = code.trim();

		if (!trimmedCode) {
			return; // Don't save empty code
		}

		setIsSaving(true);
		try {
			onSave(trimmedCode);
			onOpenChange(false);
		} catch (error) {
			console.error("Error saving mermaid code:", error);
		} finally {
			setIsSaving(false);
		}
	};

	const handleCancel = () => {
		setCode(mermaidCode); // Reset to original code
		onOpenChange(false);
	};

	const isCodeValid = code.trim().length > 0;

	return (
		<Dialog onOpenChange={handleOpenChange} open={open}>
			<DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
				<DialogHeader>
					<DialogTitle>Edit Mermaid Diagram</DialogTitle>
					<DialogDescription>
						Edit the Mermaid diagram code. The diagram will be updated when you
						save.
					</DialogDescription>
				</DialogHeader>

				<div className="flex-1 space-y-4 overflow-hidden">
					<div className="space-y-2">
						<Label htmlFor="mermaid-code">Mermaid Code</Label>
						<Textarea
							className="min-h-[300px] font-mono text-sm resize-none"
							id="mermaid-code"
							onChange={(e) => setCode(e.target.value)}
							placeholder="Enter your Mermaid diagram code here..."
							style={{ fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace' }}
							value={code}
						/>
					</div>

					{/* Basic validation feedback */}
					{!isCodeValid && (
						<p className="text-sm text-red-600">
							Please enter some Mermaid code.
						</p>
					)}

					{/* Example hint */}
					<div className="text-xs text-muted-foreground">
						<p className="font-medium mb-1">Example:</p>
						<pre className="bg-muted p-2 rounded text-xs overflow-x-auto">
							{`graph TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    C --> E[End]
    D --> E`}
						</pre>
					</div>
				</div>

				<DialogFooter className="flex-shrink-0">
					<Button disabled={isSaving} onClick={handleCancel} variant="outline">
						Cancel
					</Button>
					<Button disabled={!isCodeValid || isSaving} onClick={handleSave}>
						{isSaving ? "Saving..." : "Save"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
