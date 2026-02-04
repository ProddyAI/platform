"use client";

import { FileText, Loader2, Sparkles } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { Point } from "../types/canvas";

type FlowchartGeneratorProps = {
	onGenerateFlowchart: (mermaidCode: string, position: Point) => void;
	camera: { x: number; y: number };
	children: React.ReactNode;
};

export const FlowchartGenerator = ({
	onGenerateFlowchart,
	camera,
	children,
}: FlowchartGeneratorProps) => {
	const [isOpen, setIsOpen] = useState(false);
	const [prompt, setPrompt] = useState("");
	const [isGenerating, setIsGenerating] = useState(false);

	const handleGenerate = async () => {
		if (!prompt.trim()) {
			toast.error("Please enter a description for your flowchart");
			return;
		}

		setIsGenerating(true);

		try {
			const response = await fetch("/api/smart/flowchart", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					prompt: prompt.trim(),
				}),
			});

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data = await response.json();

			if (data.error) {
				throw new Error(data.error);
			}

			// Calculate position to place the diagram at the center of the current view
			const centerPosition: Point = {
				x: -camera.x + window.innerWidth / 2,
				y: -camera.y + window.innerHeight / 2,
			};

			// Generate the flowchart
			onGenerateFlowchart(data.mermaidCode, centerPosition);

			// Show success message
			if (data.fallback) {
				toast.warning("AI generation failed, using fallback diagram");
			} else {
				toast.success("Flowchart generated successfully!");
			}

			// Reset and close
			setPrompt("");
			setIsOpen(false);
		} catch (error) {
			console.error("Error generating flowchart:", error);
			toast.error("Failed to generate flowchart. Please try again.");
		} finally {
			setIsGenerating(false);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
			e.preventDefault();
			handleGenerate();
		}
	};

	const examplePrompts = [
		"User login process with authentication",
		"Order processing workflow for e-commerce",
		"Bug reporting and resolution process",
		"Employee onboarding steps",
		"Data backup and recovery procedure",
	];

	const handleExampleClick = (example: string) => {
		setPrompt(example);
	};

	return (
		<Dialog onOpenChange={setIsOpen} open={isOpen}>
			<DialogTrigger asChild>{children}</DialogTrigger>
			<DialogContent className="sm:max-w-[600px]">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Sparkles className="h-5 w-5 text-purple-600" />
						Generate AI Flowchart
					</DialogTitle>
				</DialogHeader>

				<div className="space-y-4">
					<div>
						<label
							className="text-sm font-medium text-gray-700 mb-2 block"
							htmlFor="prompt"
						>
							Describe your process or workflow:
						</label>
						<Textarea
							className="min-h-[100px] resize-none"
							disabled={isGenerating}
							id="prompt"
							onChange={(e) => setPrompt(e.target.value)}
							onKeyDown={handleKeyDown}
							placeholder="e.g., 'Create a flowchart for user registration process with email verification'"
							value={prompt}
						/>
						<p className="text-xs text-gray-500 mt-1">
							Press Ctrl+Enter to generate
						</p>
					</div>

					{/* Example prompts */}
					<div>
						<p className="text-sm font-medium text-gray-700 mb-2">
							Try these examples:
						</p>
						<div className="flex flex-wrap gap-2">
							{examplePrompts.map((example) => (
								<Button
<<<<<<< HEAD
									key={example}
									variant="outline"
									size="sm"
									onClick={() => handleExampleClick(example)}
									disabled={isGenerating}
=======
>>>>>>> 7b9cc96a09880de15193206296b24a5439aa03c2
									className="text-xs h-7"
									disabled={isGenerating}
									key={index}
									onClick={() => handleExampleClick(example)}
									size="sm"
									variant="outline"
								>
									{example}
								</Button>
							))}
						</div>
					</div>

					{/* Action buttons */}
					<div className="flex justify-end gap-2 pt-4">
						<Button
							disabled={isGenerating}
							onClick={() => setIsOpen(false)}
							variant="outline"
						>
							Cancel
						</Button>
						<Button
							className="bg-purple-600 hover:bg-purple-700"
							disabled={isGenerating || !prompt.trim()}
							onClick={handleGenerate}
						>
							{isGenerating ? (
								<>
									<Loader2 className="h-4 w-4 mr-2 animate-spin" />
									Generating...
								</>
							) : (
								<>
									<FileText className="h-4 w-4 mr-2" />
									Generate Flowchart
								</>
							)}
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
};
