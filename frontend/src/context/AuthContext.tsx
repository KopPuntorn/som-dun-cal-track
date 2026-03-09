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
            if (url.includes('/api/') && !url.includes('/auth/')) {
                const currentToken = localStorage.getItem("auth_token");
                if (currentToken) {
                    init = init || {};
                    init.headers = {
                        ...init.headers,
                        'Authorization': `Bearer ${currentToken}`
                    };
                }
            }
            return originalFetch(input, init);
        };

        return () => {
            window.fetch = originalFetch;
        };
    }, []);

    useEffect(() => {
        if (!isLoading) {
            // Allow unrestricted access to login page
            if (!token && pathname !== "/login") {
                router.push("/login");
            } else if (token && pathname === "/login") {
                router.push("/");
            }
        }
    }, [isLoading, token, pathname, router]);

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
