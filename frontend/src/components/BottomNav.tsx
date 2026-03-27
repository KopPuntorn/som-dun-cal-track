"use client";

import React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";

export default function BottomNav() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { t } = useLanguage();
    const isAddActive = pathname === '/' && searchParams?.get('add') === 'true';

    // Hide on login/onboarding or AI chat for full screen
    if (pathname === '/login' || pathname === '/signup' || pathname === '/onboarding' || pathname === '/ai-chat') {
        return null;
    }

    return (
        <>
            <div className="bottom-nav-spacer" style={{ height: '80px' }} />
            <nav className="bottom-nav">
                <Link href="/" className={`nav-item ${pathname === '/' ? 'active' : ''}`}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                    <span>{t('navHome') || 'Home'}</span>
                </Link>
                <Link href="/dashboard" className={`nav-item ${pathname === '/dashboard' ? 'active' : ''}`}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                    <span>{t('navDashboard') || 'Dashboard'}</span>
                </Link>
                <Link 
                    href="/?add=true" 
                    id="add-action-btn-mobile" 
                    className={`nav-item main-action ${isAddActive ? 'active' : ''}`} 
                    onClick={(e) => {
                        if (pathname === '/') {
                            e.preventDefault();
                            window.dispatchEvent(new Event('openAddFoodModal'));
                        }
                    }}
                >
                    <div className="center-btn">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    </div>
                    <span>{t('navAdd') || 'Add'}</span>
                </Link>
                <Link 
                    href="/ai-chat" 
                    id="chat-toggle-btn-mobile" 
                    className={`nav-item ${pathname === '/ai-chat' ? 'active' : ''}`} 
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                    <span>{t('navAiAssistant')}</span>
                </Link>
                <Link id="profile-btn-mobile" href="/profile" className={`nav-item ${pathname === '/profile' ? 'active' : ''}`}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    <span>{t('navProfile')}</span>
                </Link>
            </nav>
        </>
    );
}
