"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
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
};

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
    const [isLoading] = useState(false);
    const router = useRouter();
    const pathname = usePathname();

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
                    handleForceLogout();
                }

                return response;
            } catch (error) {
                console.error(`Fetch network error at ${url}:`, error);
                throw error;
            }
        };

        const handleForceLogout = () => {
            localStorage.removeItem("auth_token");
            localStorage.removeItem("auth_user");
            setToken(null);
            setUser(null);
            if (window.location.pathname !== "/login") {
                window.location.href = "/login";
            }
        };

        return () => {
            window.fetch = originalFetch;
        };
    }, []);

    useEffect(() => {
        if (!isLoading) {
            // Allow unrestricted access to login page
            if (!token) {
                if (pathname !== "/login") {
                    router.push("/login");
                }
            } else {
                // User is logged in
                if (!user?.onboarded && pathname !== "/onboarding") {
                    router.push("/onboarding");
                } else if (user?.onboarded && (pathname === "/login" || pathname === "/onboarding")) {
                    router.push("/");
                }
            }
        }
    }, [isLoading, token, user?.onboarded, pathname, router]);

    const login = (newToken: string, newUser: UserProfile) => {
        localStorage.setItem("auth_token", newToken);
        localStorage.setItem("auth_user", JSON.stringify(newUser));
        setToken(newToken);
        setUser(newUser);
        router.push("/");
    };

    const logout = () => {
        localStorage.removeItem("auth_token");
        localStorage.removeItem("auth_user");
        setToken(null);
        setUser(null);
        router.push("/login"); // Immediately send user out
    };

    const refreshUser = async () => {
        const currentToken = typeof window !== 'undefined' ? localStorage.getItem("auth_token") : null;
        if (!currentToken || !originalFetch) return;

        const API_BASE = (process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL !== "undefined") 
            ? process.env.NEXT_PUBLIC_API_URL 
            : "http://localhost:8080/api";

        try {
            const response = await originalFetch(`${API_BASE}/user`, {
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

const originalFetch = typeof window !== 'undefined' ? window.fetch : null;

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
