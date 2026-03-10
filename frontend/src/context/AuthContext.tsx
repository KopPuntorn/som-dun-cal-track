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

            // Clone or create init to avoid mutating the original reference in a way that breaks re-tries
            let fetchInit = init ? { ...init } : {};

            if (url.includes('/api/') && !url.includes('/auth/')) {
                const currentToken = localStorage.getItem("auth_token");
                if (currentToken) {
                    fetchInit.headers = {
                        ...fetchInit.headers,
                        'Authorization': `Bearer ${currentToken}`
                    };
                }
            }

            try {
                const response = await originalFetch(input, fetchInit);

                const isAuthEndpoint = url.includes('/auth/');
                const isUserEndpoint = url.includes('/api/user');

                if ((response.status === 401 && !isAuthEndpoint) || (response.status === 404 && isUserEndpoint)) {
                    // Token likely expired, invalid, or user was deleted from DB
                    console.warn(`Auth failure (${response.status}) at ${url}. Logging out...`);
                    handleForceLogout();
                }

                return response;
            } catch (error) {
                // Handle network errors which might be CORS preflight failures (e.g. expired token causing 401 on OPTIONS)
                console.error(`Fetch error at ${url}:`, error);

                // If it's a protected route and we have a token, but got a network error, 
                // it's highly likely a CORS/Auth issue on direct page load
                if (url.includes('/api/') && !url.includes('/auth/')) {
                    const hasToken = !!localStorage.getItem("auth_token");
                    if (hasToken) {
                        console.warn("Possible Auth/CORS error detected via network failure. Checking session...");
                        // We don't force logout immediately on EVERY network error to be safe, 
                        // but for critical app-load path it might be necessary.
                        // However, the backend fix (AllowHeaders) should prevent this.
                    }
                }
                throw error;
            }
        };

        const handleForceLogout = () => {
            localStorage.removeItem("auth_token");
            localStorage.removeItem("auth_user");
            setToken(null);
            setUser(null);
            // Use window.location as a fallback if the app state isn't immediately reactive
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
