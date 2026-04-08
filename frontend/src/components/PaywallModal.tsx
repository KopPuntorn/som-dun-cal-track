"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";

const BILLING_URL = process.env.NEXT_PUBLIC_BILLING_URL?.trim() || "";
const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || "";

export default function PaywallModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState<"limit" | "pro">("limit");
  const { user } = useAuth();
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

  const handleUpgrade = async () => {
    setIsLifting(true);
    try {
      if (BILLING_URL) {
        window.location.href = BILLING_URL;
        return;
      }

      if (SUPPORT_EMAIL) {
        window.location.href = `mailto:${SUPPORT_EMAIL}?subject=Somdun%20Pro%20Upgrade`;
        return;
      }

      console.warn("Billing CTA clicked but no billing URL or support email is configured.");
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

          {!BILLING_URL && (
            <p className="mb-6 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              {SUPPORT_EMAIL
                ? `Billing is not connected yet. Use the contact option below and we'll help you upgrade manually.`
                : "Billing is not connected yet. Add NEXT_PUBLIC_BILLING_URL to enable a live upgrade flow."}
            </p>
          )}

          <div className="space-y-3">
            <button
              onClick={handleUpgrade}
              disabled={isLifting}
              className="w-full py-4 bg-white text-black font-bold rounded-2xl hover:bg-zinc-200 transition-all transform active:scale-95 flex items-center justify-center gap-2"
            >
              {isLifting ? (
                <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
              ) : (
                <>{BILLING_URL ? "Upgrade to Pro" : SUPPORT_EMAIL ? "Contact to Upgrade" : "Billing Setup Required"}</>
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
