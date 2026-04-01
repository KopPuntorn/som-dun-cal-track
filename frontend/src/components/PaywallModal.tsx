"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";

export default function PaywallModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState<"limit" | "pro">("limit");
  const { user, refreshUser } = useAuth();
  const [isLifting, setIsLifting] = useState(false);

  useEffect(() => {
    const handleTrigger = (e: any) => {
      const code = e.detail?.code;
      if (code === "LIMIT_REACHED") setReason("limit");
      else if (code === "PRO_REQUIRED") setReason("pro");
      setIsOpen(true);
    };

    window.addEventListener("trigger-paywall", handleTrigger);
    return () => window.removeEventListener("trigger-paywall", handleTrigger);
  }, []);

  const handleMockUpgrade = async () => {
    setIsLifting(true);
    try {
      const API_BASE = (process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL !== "undefined")
        ? process.env.NEXT_PUBLIC_API_URL
        : "http://localhost:8080/api";
      
      const token = localStorage.getItem("auth_token");
      await fetch(`${API_BASE}/user/mock-upgrade`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      
      await refreshUser();
      setIsOpen(false);
    } catch (err) {
      console.error("Upgrade failed:", err);
    } finally {
      setIsLifting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl relative">
        {/* Decorative Background */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-yellow-500 to-orange-500" />
        
        <div className="p-8 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-orange-500/20">
            <span className="text-4xl">👑</span>
          </div>
          
          <h2 className="text-2xl font-bold text-white mb-3">
            {reason === "limit" ? "Daily Limit Reached!" : "Pro Feature Detected"}
          </h2>
          
          <p className="text-zinc-400 mb-8 leading-relaxed">
            {reason === "limit" 
              ? "You've used up your free daily AI credits. Upgrade to Pro for unlimited scans and expert consulting."
              : "This feature is reserved for our Pro members. Join today to unlock your full potential."}
          </p>

          <div className="space-y-3">
            <button
              onClick={handleMockUpgrade}
              disabled={isLifting}
              className="w-full py-4 bg-white text-black font-bold rounded-2xl hover:bg-zinc-200 transition-all transform active:scale-95 flex items-center justify-center gap-2"
            >
              {isLifting ? (
                <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
              ) : (
                <>Unlock Unlimited Access</>
              )}
            </button>
            
            <button
              onClick={() => setIsOpen(false)}
              className="w-full py-4 bg-zinc-800 text-white font-semibold rounded-2xl hover:bg-zinc-700 transition-colors"
            >
              Maybe Later
            </button>
          </div>

          <p className="mt-6 text-xs text-zinc-500">
            Current Tier: <span className="text-zinc-300 uppercase font-bold">{user?.tier}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
