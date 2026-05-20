"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface NoteEditorErrorBoundaryProps {
	children: ReactNode;
	noteId: string;
	onReinitialize?: () => void;
}

interface NoteEditorErrorBoundaryState {
	hasError: boolean;
	error: Error | null;
}

/**
 * Error boundary specifically for the BlockNote / ProseMirror editor.
 *
 * Catches crashes like:
 *   - RangeError: Invalid array passed to renderSpec
 *   - Any other uncaught editor initialization errors
 *
 * Shows a friendly fallback UI with a reinitialize button instead of
 * crashing the entire Notes page with "Application error".
 */
export class NoteEditorErrorBoundary extends Component<
	NoteEditorErrorBoundaryProps,
	NoteEditorErrorBoundaryState
> {
	constructor(props: NoteEditorErrorBoundaryProps) {
		super(props);
		this.state = { hasError: false, error: null };
	}

	static getDerivedStateFromError(
		error: Error
	): NoteEditorErrorBoundaryState {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, info: ErrorInfo) {
		// Log to console so developers can still see the error
		console.error("[NoteEditorErrorBoundary] Editor crashed:", error, info);
	}

	handleReset = () => {
		this.setState({ hasError: false, error: null });
		this.props.onReinitialize?.();
	};

	render() {
		if (this.state.hasError) {
			return (
				<div className="flex h-full w-full items-center justify-center">
					<div className="text-center space-y-4 max-w-sm px-6">
						{/* Icon */}
						<div className="mx-auto w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
							<AlertTriangle className="h-8 w-8 text-amber-500" />
						</div>

						{/* Message */}
						<div>
							<h3 className="text-lg font-semibold mb-1">
								This note couldn&apos;t be loaded
							</h3>
							<p className="text-sm text-muted-foreground leading-relaxed">
								The note&apos;s content appears to be corrupted or in an
								unsupported format.
							</p>
						</div>

						{/* Error detail (collapsed, for devs) */}
						{this.state.error && (
							<details className="text-left">
								<summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
									Show error details
								</summary>
								<pre className="mt-2 text-xs bg-muted p-3 rounded-lg overflow-auto max-h-32 text-left whitespace-pre-wrap break-all">
									{this.state.error.message}
								</pre>
							</details>
						)}

						{/* Actions */}
						<div className="flex flex-col gap-2">
							<button
								className="flex items-center justify-center gap-2 px-4 py-2 bg-violet-600 text-white text-sm rounded-lg hover:bg-violet-700 transition-colors"
								onClick={this.handleReset}
								type="button"
							>
								<RefreshCw className="h-4 w-4" />
								Try Again
							</button>
							<p className="text-xs text-muted-foreground">
								If this keeps happening, contact your admin to re-initialize
								this note.
							</p>
						</div>
					</div>
				</div>
			);
		}

		return this.props.children;
	}
}
