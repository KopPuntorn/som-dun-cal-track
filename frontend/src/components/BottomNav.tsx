"use client";

import React, { useState, useRef, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";

interface BottomNavProps {
    aiNotificationCount?: number;
}

export default function BottomNav({ aiNotificationCount = 0 }: BottomNavProps) {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const { t, language, setLanguage } = useLanguage();
    const [moreMenuState, setMoreMenuState] = useState({ isOpen: false, pathname });
    const menuRef = useRef<HTMLDivElement>(null);
    const isAddActive = pathname === '/' && searchParams?.get('add') === 'true';
    const moreMenuOpen = moreMenuState.isOpen && moreMenuState.pathname === pathname;

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setMoreMenuState((current) => ({ ...current, isOpen: false }));
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (pathname === '/login' || pathname === '/signup' || pathname === '/onboarding' || pathname === '/ai-chat') {
        return null;
    }

    return (
        <>
            <div className="bottom-nav-spacer" />
            <nav className="bottom-nav" role="navigation" aria-label="Main navigation">
                <Link 
                    href="/" 
                    className={`nav-item ${pathname === '/' ? 'active' : ''}`}
                    aria-current={pathname === '/' ? 'page' : undefined}
                    aria-label={t('navHome') || 'Home'}
                >
                    <div className="nav-icon-wrapper">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                    </div>
                    <span>{t('navHome') || 'Home'}</span>
                </Link>
                <Link 
                    href="/dashboard" 
                    className={`nav-item ${pathname === '/dashboard' ? 'active' : ''}`}
                    aria-current={pathname === '/dashboard' ? 'page' : undefined}
                    aria-label={t('navDashboard') || 'Dashboard'}
                >
                    <div className="nav-icon-wrapper">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                    </div>
                    <span>{t('navDashboard') || 'Dashboard'}</span>
                </Link>
                <Link 
                    href="/?add=true" 
                    id="add-action-btn-mobile" 
                    className={`nav-item main-action ${isAddActive ? 'active' : ''}`}
                    aria-current={isAddActive ? 'page' : undefined}
                    aria-label={t('navAdd') || 'Add Food'}
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
                    aria-current={pathname === '/ai-chat' ? 'page' : undefined}
                    aria-label={t('navAiAssistant') || 'AI Assistant'}
                >
                    <div className="nav-icon-wrapper">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                        {aiNotificationCount > 0 && (
                            <span className="nav-badge" aria-label={`${aiNotificationCount} new messages`}>{aiNotificationCount > 9 ? '9+' : aiNotificationCount}</span>
                        )}
                    </div>
                    <span>{t('navAiAssistant')}</span>
                </Link>
                <button 
                    className={`nav-item more-menu-btn ${moreMenuOpen ? 'active' : ''}`}
                    onClick={() => setMoreMenuState({ isOpen: !moreMenuOpen, pathname })}
                    aria-label="More options"
                    aria-expanded={moreMenuOpen}
                    aria-haspopup="true"
                >
                    <div className="nav-icon-wrapper">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle></svg>
                    </div>
                    <span>{t('navMore') || 'More'}</span>
                </button>
                {moreMenuOpen && (
                    <div className="bottom-nav-menu" ref={menuRef} role="menu">
                        <Link href="/profile" className="bottom-nav-menu-item" role="menuitem" onClick={() => setMoreMenuState((current) => ({ ...current, isOpen: false }))}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                            <span>{t('navProfile')}</span>
                        </Link>
                        <Link href="/player-card" className="bottom-nav-menu-item" role="menuitem" onClick={() => setMoreMenuState((current) => ({ ...current, isOpen: false }))}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
                            <span>{t('navPlayerCard')}</span>
                        </Link>
                        <button className="bottom-nav-menu-item" role="menuitem" onClick={() => { setLanguage(language === 'en' ? 'th' : 'en'); setMoreMenuState((current) => ({ ...current, isOpen: false })); }}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                            <span>{language === 'en' ? 'ภาษาไทย' : 'English'}</span>
                        </button>
                    </div>
                )}
            </nav>
        </>
    );
}
