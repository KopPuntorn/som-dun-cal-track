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
};

type AuthContextType = {
    user: UserProfile | null;
    token: string | null;
    login: (token: string, user: UserProfile) => void;
    logout: () => void;
    isLoading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        // Check local storage for existing session
        const storedToken = localStorage.getItem("auth_token");
        const storedUser = localStorage.getItem("auth_user");

        if (storedToken && storedUser) {
            setToken(storedToken);
            try {
                setUser(JSON.parse(storedUser));
            } catch (err) {
                localStorage.removeItem("auth_token");
                localStorage.removeItem("auth_user");
            }
        }

        setIsLoading(false);

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

    return (
        <AuthContext.Provider value={{ user, token, login, logout, isLoading }}>
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
