"use client";

import { AlertCircle, CheckCircle, XCircle } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

export default function StreamDebugPage() {
	const [debugInfo, setDebugInfo] = useState<any>(null);
	const [tokenInfo, setTokenInfo] = useState<any>(null);
	const [loading, setLoading] = useState(false);

	const checkCredentials = async () => {
		setLoading(true);
		try {
			const response = await fetch("/api/stream", {
				method: "GET",
			});
			const data = await response.json();
			setDebugInfo(data);
		} catch (error) {
			setDebugInfo({
				error: error instanceof Error ? error.message : "Unknown error",
			});
		}
		setLoading(false);
	};

	const testTokenGeneration = async () => {
		setLoading(true);
		try {
			const response = await fetch("/api/stream", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					userId: "test-user-123",
					userName: "Test User",
					userImage: null,
				}),
			});
			const data = await response.json();
			setTokenInfo(data);
		} catch (error) {
			setTokenInfo({
				error: error instanceof Error ? error.message : "Unknown error",
			});
		}
		setLoading(false);
	};

	const getStatusIcon = (exists: boolean) => {
		return exists ? (
			<CheckCircle className="h-4 w-4 text-green-500" />
		) : (
			<XCircle className="h-4 w-4 text-red-500" />
		);
	};

	const clientApiKey = process.env.NEXT_PUBLIC_STREAM_API_KEY;

	return (
		<div className="container mx-auto p-6 max-w-4xl">
			<div className="mb-6">
				<h1 className="text-3xl font-bold">Stream API Debug</h1>
				<p className="text-muted-foreground">
					Debug your Stream API configuration and credentials
				</p>
			</div>

			{/* Client-side API Key Check */}
			<Card className="mb-6">
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						Client-side API Key
						{getStatusIcon(!!clientApiKey)}
					</CardTitle>
					<CardDescription>
						Checking NEXT_PUBLIC_STREAM_API_KEY availability on the client
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<span>API Key Present:</span>
							<Badge variant={clientApiKey ? "default" : "destructive"}>
								{clientApiKey ? "Yes" : "No"}
							</Badge>
						</div>
						{clientApiKey && (
							<>
								<div className="flex items-center justify-between">
									<span>API Key Length:</span>
									<Badge variant="outline">{clientApiKey.length}</Badge>
								</div>
								<div className="flex items-center justify-between">
									<span>API Key Prefix:</span>
									<Badge variant="outline">
										{clientApiKey.substring(0, 4)}...
									</Badge>
								</div>
								{clientApiKey.length !== 12 && (
									<div className="flex items-center gap-2 text-amber-600">
										<AlertCircle className="h-4 w-4" />
										<span className="text-sm">
											Warning: Stream API keys are typically 12 characters long
										</span>
									</div>
								)}
							</>
						)}
					</div>
				</CardContent>
			</Card>

			{/* Server-side Credentials Check */}
			<Card className="mb-6">
				<CardHeader>
					<CardTitle>Server-side Credentials</CardTitle>
					<CardDescription>
						Check if both API key and secret are available on the server
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Button
						className="mb-4"
						disabled={loading}
						onClick={checkCredentials}
					>
						{loading ? "Checking..." : "Check Server Credentials"}
					</Button>

					{debugInfo && (
						<div className="space-y-2">
							{debugInfo.error ? (
								<div className="text-red-600">Error: {debugInfo.error}</div>
							) : (
								<>
									<div className="flex items-center justify-between">
										<span>API Key Present:</span>
										<Badge
											variant={
												debugInfo.apiKeyExists ? "default" : "destructive"
											}
										>
											{debugInfo.apiKeyExists ? "Yes" : "No"}
										</Badge>
									</div>
									<div className="flex items-center justify-between">
										<span>API Secret Present:</span>
										<Badge
											variant={
												debugInfo.apiSecretExists ? "default" : "destructive"
											}
										>
											{debugInfo.apiSecretExists ? "Yes" : "No"}
										</Badge>
									</div>
									{debugInfo.apiKeyExists && (
										<>
											<div className="flex items-center justify-between">
												<span>API Key Length:</span>
												<Badge variant="outline">
													{debugInfo.apiKeyLength}
												</Badge>
											</div>
											<div className="flex items-center justify-between">
												<span>API Key Prefix:</span>
												<Badge variant="outline">
													{debugInfo.apiKeyPrefix}...
												</Badge>
											</div>
										</>
									)}
									{debugInfo.apiSecretExists && (
										<div className="flex items-center justify-between">
											<span>API Secret Length:</span>
											<Badge variant="outline">
												{debugInfo.apiSecretLength}
											</Badge>
										</div>
									)}
									<div className="flex items-center justify-between">
										<span>Environment:</span>
										<Badge variant="outline">{debugInfo.environment}</Badge>
									</div>
								</>
							)}
						</div>
					)}
				</CardContent>
			</Card>

			{/* Token Generation Test */}
			<Card className="mb-6">
				<CardHeader>
					<CardTitle>Token Generation Test</CardTitle>
					<CardDescription>
						Test if the server can generate a valid Stream token
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Button
						className="mb-4"
						disabled={loading}
						onClick={testTokenGeneration}
					>
						{loading ? "Testing..." : "Test Token Generation"}
					</Button>

					{tokenInfo && (
						<div className="space-y-2">
							{tokenInfo.error ? (
								<div className="text-red-600">Error: {tokenInfo.error}</div>
							) : (
								<>
									<div className="flex items-center justify-between">
										<span>Token Generated:</span>
										<Badge variant="default">Success</Badge>
									</div>
									<div className="flex items-center justify-between">
										<span>Token Length:</span>
										<Badge variant="outline">
											{tokenInfo.token?.length || 0}
										</Badge>
									</div>
									{tokenInfo.debug && (
										<div className="mt-4 p-3 bg-muted rounded-lg">
											<h4 className="font-medium mb-2">Debug Info:</h4>
											<pre className="text-sm">
												{JSON.stringify(tokenInfo.debug, null, 2)}
											</pre>
										</div>
									)}
								</>
							)}
						</div>
					)}
				</CardContent>
			</Card>

			{/* Troubleshooting Guide */}
			<Card>
				<CardHeader>
					<CardTitle>Troubleshooting Guide</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						<div>
							<h4 className="font-medium mb-2">Common Issues:</h4>
							<ul className="list-disc list-inside space-y-1 text-sm">
								<li>
									API key and secret are from different Stream applications
								</li>
								<li>
									API key was regenerated but not updated in production
									environment
								</li>
								<li>Environment variables not properly set in production</li>
								<li>API key/secret copied with extra spaces or characters</li>
							</ul>
						</div>
						<div>
							<h4 className="font-medium mb-2">Next Steps:</h4>
							<ol className="list-decimal list-inside space-y-1 text-sm">
								<li>Verify both credentials exist and have correct lengths</li>
								<li>
									Check your Stream dashboard for the correct API key and secret
								</li>
								<li>
									Ensure both credentials are from the same Stream application
								</li>
								<li>Update your production environment variables if needed</li>
							</ol>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
