"use client";

import { AuthProvider } from "./AuthContext";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { LanguageProvider } from "./LanguageContext";
import { ToastProvider } from "./ToastContext";

export function Providers({ children }: { children: React.ReactNode }) {
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "PLACEHOLDER_CLIENT_ID";

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
