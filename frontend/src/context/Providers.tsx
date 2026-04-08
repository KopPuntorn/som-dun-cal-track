"use client";

import { AuthProvider } from "./AuthContext";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { LanguageProvider } from "./LanguageContext";
import { ToastProvider } from "./ToastContext";

export function Providers({ children }: { children: React.ReactNode }) {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() || "";

    if (!clientId) {
        console.error("NEXT_PUBLIC_GOOGLE_CLIENT_ID is not configured. Google sign-in is disabled.");
        return (
            <LanguageProvider>
                <ToastProvider>
                    <AuthProvider>{children}</AuthProvider>
                </ToastProvider>
            </LanguageProvider>
        );
    }

    return (
        <GoogleOAuthProvider clientId={clientId}>
            <LanguageProvider>
                <ToastProvider>
                    <AuthProvider>{children}</AuthProvider>
                </ToastProvider>
            </LanguageProvider>
        </GoogleOAuthProvider>
    );
}
