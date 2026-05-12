"use client";

import { useSyncExternalStore } from "react";

function subscribeToOnlineStatus(onStoreChange: () => void) {
    window.addEventListener("offline", onStoreChange);
    window.addEventListener("online", onStoreChange);

    return () => {
        window.removeEventListener("offline", onStoreChange);
        window.removeEventListener("online", onStoreChange);
    };
}

function getOnlineStatus() {
    return typeof navigator === "undefined" ? true : navigator.onLine;
}

export default function OfflineIndicator() {
    const isOnline = useSyncExternalStore(subscribeToOnlineStatus, getOnlineStatus, () => true);

    if (isOnline) return null;

    return (
        <div style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 99999,
            background: "linear-gradient(135deg, #966e6e, #c25050)",
            color: "#fff",
            textAlign: "center",
            padding: "10px 16px",
            fontSize: "13px",
            fontWeight: 700,
            letterSpacing: "0.5px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            animation: "slideDown 0.3s ease",
        }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="1" y1="1" x2="23" y2="23"></line>
                <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"></path>
                <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"></path>
                <path d="M10.71 5.05A16 16 0 0 1 22.56 9"></path>
                <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"></path>
                <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
                <line x1="12" y1="20" x2="12.01" y2="20"></line>
            </svg>
            You are offline
        </div>
    );
}
