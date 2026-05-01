"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

export default function AutoLogin() {
    const { signIn } = useAuthActions();
    const { isAuthenticated, isLoading } = useConvexAuth();
    const hasAttempted = useRef(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        if (isAuthenticated) {
            window.location.href = "/workspace";
            return;
        }

        if (!isLoading && !isAuthenticated && !hasAttempted.current) {
            hasAttempted.current = true;
            const doBypass = async () => {
                try {
                    // Try to sign in
                    await signIn("password", { email: "admin@proddy.ai", password: "password123", flow: "signIn" });
                } catch (e) {
                    // If it fails, sign up
                    try {
                        await signIn("password", { email: "admin@proddy.ai", password: "password123", name: "Admin", flow: "signUp" });
                    } catch (err: any) {
                        console.error("Auto login failed:", err);
                        setErrorMsg(err.message || String(err));
                    }
                }
            };
            doBypass();
        }
    }, [isAuthenticated, isLoading, signIn]);

    if (errorMsg) {
        return (
            <div className="flex h-screen w-full flex-col items-center justify-center bg-[#4A0D68] text-white">
                <p className="text-xl font-bold text-red-400">Auto-login Failed</p>
                <p className="mt-2 text-sm">{errorMsg}</p>
                <button 
                    onClick={() => window.location.reload()} 
                    className="mt-4 rounded bg-white px-4 py-2 text-[#4A0D68]"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="flex h-screen w-full items-center justify-center bg-[#4A0D68] text-white">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="text-lg font-medium animate-pulse">Authenticating Workspace...</p>
            </div>
        </div>
    );
}
