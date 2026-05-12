"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";

export type UserProfile = {
    id: string;
    name: string;
    email: string;
    age: number;
    weight: number;
    height: number;
    sex: string;
    googleId?: string;
    onboarded: boolean;
    xp: number;
    level: number;
    streakDays?: number;
    lastActiveDate?: string;
    tier: "free" | "pro";
    usage?: {
        aiScanCount: number;
        aiChatCount: number;
    };
};

async function safeReadJson(response: Response): Promise<unknown> {
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
        return null;
    }

    try {
        return await response.clone().json();
    } catch {
        return null;
    }
}

function isPaywallResponse(data: unknown): data is { code: "LIMIT_REACHED" | "PRO_REQUIRED" } {
    return (
        typeof data === "object" &&
        data !== null &&
        "code" in data &&
        (data.code === "LIMIT_REACHED" || data.code === "PRO_REQUIRED")
    );
}

const API_BASE = (process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL !== "undefined")
    ? process.env.NEXT_PUBLIC_API_URL
    : "http://localhost:8080/api";

function isJwtExpired(token: string): boolean {
    try {
        const [, payload] = token.split(".");
        if (!payload) return true;

        const normalizedPayload = payload.replace(/-/g, "+").replace(/_/g, "/");
        const decodedPayload = JSON.parse(window.atob(normalizedPayload));
        const expiresAt = typeof decodedPayload.exp === "number" ? decodedPayload.exp * 1000 : 0;

        return !expiresAt || Date.now() >= expiresAt;
    } catch {
        return true;
    }
}

type AuthContextType = {
    user: UserProfile | null;
    token: string | null;
    login: (token: string, user: UserProfile) => void;
    logout: () => void;
    isLoading: boolean;
    refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<UserProfile | null>(() => {
        if (typeof window === "undefined") return null;
        const storedUser = localStorage.getItem("auth_user");
        if (!storedUser) return null;
        try {
            return JSON.parse(storedUser) as UserProfile;
        } catch {
            localStorage.removeItem("auth_token");
            localStorage.removeItem("auth_user");
            return null;
        }
    });
    const [token, setToken] = useState<string | null>(() => {
        if (typeof window === "undefined") return null;
        return localStorage.getItem("auth_token");
    });
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();
    const publicRoutes = new Set(["/login", "/privacy", "/terms", "/forgot-password"]);
    const isPublicRoute = pathname ? publicRoutes.has(pathname) : false;
    const isAuthEntryRoute = pathname === "/login";

    const forceLogout = useCallback((redirect = true) => {
        localStorage.removeItem("auth_token");
        localStorage.removeItem("auth_user");
        setToken(null);
        setUser(null);

        if (redirect && window.location.pathname !== "/login") {
            window.location.href = "/login";
        }
    }, []);

    useEffect(() => {
        // Setup global fetch interceptor
        const originalFetch = window.fetch;
        window.fetch = async (input, init) => {
            const url = typeof input === 'string' ? input : (input instanceof Request ? input.url : '');
            
            // Bypass interceptor for non-API calls or auth calls (to avoid infinite loops)
            if (!url.includes('/api/') || url.includes('/auth/')) {
                return originalFetch(input, init);
            }

            const currentToken = localStorage.getItem("auth_token");
            let fetchInit = init || {};
            
            if (currentToken) {
                // Use Headers object for more reliable merging
                const headers = new Headers(fetchInit.headers);
                if (!headers.has('Authorization')) {
                    headers.set('Authorization', `Bearer ${currentToken}`);
                }
                fetchInit = { ...fetchInit, headers };
            }

            try {
                const response = await originalFetch(input, fetchInit);

                if (response.status === 401 || (response.status === 404 && url.includes('/api/user'))) {
                    console.warn(`Auth failure (${response.status}) at ${url}. Logging out...`);
                    forceLogout();
                }

                if (response.status === 403) {
                    const data = await safeReadJson(response);
                    if (isPaywallResponse(data)) {
                        // Trigger global paywall UI
                        window.dispatchEvent(new CustomEvent("trigger-paywall", { detail: data }));
                    }
                }

                return response;
            } catch (error) {
                console.error(`Fetch network error at ${url}:`, error);
                throw error;
            }
        };

        return () => {
            window.fetch = originalFetch || window.fetch;
        };
    }, [forceLogout]);

    useEffect(() => {
        let isActive = true;

        const validateSession = async () => {
            const storedToken = localStorage.getItem("auth_token");
            if (!storedToken || isJwtExpired(storedToken)) {
                forceLogout(!isPublicRoute);
                if (isActive) setIsLoading(false);
                return;
            }

            try {
                const response = await fetch(`${API_BASE}/user`, {
                    headers: {
                        "Authorization": `Bearer ${storedToken}`,
                    },
                });

                if (!response.ok) {
                    forceLogout(!isPublicRoute);
                    return;
                }

                const freshUser = await response.json();
                if (!isActive) return;

                setToken(storedToken);
                setUser(freshUser);
                localStorage.setItem("auth_user", JSON.stringify(freshUser));
            } catch (err) {
                console.error("Failed to validate auth session:", err);
                forceLogout(!isPublicRoute);
            } finally {
                if (isActive) setIsLoading(false);
            }
        };

        validateSession();

        return () => {
            isActive = false;
        };
    }, [forceLogout, isPublicRoute]);

    useEffect(() => {
        if (!isLoading) {
            if (!token) {
                if (!isPublicRoute) {
                    router.push("/login");
                }
            } else {
                // User is logged in
                if (!user?.onboarded && pathname !== "/onboarding") {
                    router.push("/onboarding");
                } else if (user?.onboarded && (isAuthEntryRoute || pathname === "/onboarding")) {
                    router.push("/");
                }
            }
        }
    }, [isLoading, token, user?.onboarded, pathname, router, isPublicRoute, isAuthEntryRoute]);

    const login = (newToken: string, newUser: UserProfile) => {
        localStorage.setItem("auth_token", newToken);
        localStorage.setItem("auth_user", JSON.stringify(newUser));
        setToken(newToken);
        setUser(newUser);
        setIsLoading(false);
        router.push("/");
    };

    const logout = () => {
        forceLogout(false);
        router.push("/login"); // Immediately send user out
    };

    const refreshUser = async () => {
        const currentToken = typeof window !== 'undefined' ? localStorage.getItem("auth_token") : null;
        if (!currentToken) return;

        try {
            const response = await fetch(`${API_BASE}/user`, {
                headers: {
                    "Authorization": `Bearer ${currentToken}`
                }
            });
            if (response.ok) {
                const updatedUser = await response.json();
                setUser(updatedUser);
                localStorage.setItem("auth_user", JSON.stringify(updatedUser));
            }
        } catch (err) {
            console.error("Failed to refresh user profile:", err);
        }
    };

    return (
        <AuthContext.Provider value={{ user, token, login, logout, isLoading, refreshUser }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
