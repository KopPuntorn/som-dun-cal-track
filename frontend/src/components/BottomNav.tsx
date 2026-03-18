"use client";

import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";

export default function BottomNav() {
    const pathname = usePathname();
    const router = useRouter();
    const { t } = useLanguage();
    const [isVisible, setIsVisible] = useState(false);

    // Determine if BottomNav should be shown. 
    // We'll hide it on the login page.
    useEffect(() => {
        if (pathname === '/login' || pathname === '/signup' || pathname === '/onboarding') {
            setIsVisible(false);
        } else {
            setIsVisible(true);
        }
    }, [pathname]);

    if (!isVisible) return null;

    return (
        <>
            <div className="bottom-nav-spacer" style={{ height: '80px' }} />
            <nav className="bottom-nav">
                <Link href="/dashboard" className={`nav-item ${pathname === '/dashboard' ? 'active' : ''}`}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                    <span>{t('navDashboard')}</span>
                </Link>
                <a href="#" id="add-food-btn-mobile" className={`nav-item main-action ${pathname === '/' ? 'active' : ''}`} onClick={(e) => {
                    e.preventDefault();
                    if (pathname !== '/') {
                        router.push('/?add=true');
                    } else {
                        window.dispatchEvent(new Event('openAddFoodModal'));
                    }
                }}>
                    <div className="center-btn">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                    </div>
                    <span>{t('navAddFood')}</span>
                </a>
                <Link id="profile-btn-mobile" href="/profile" className={`nav-item ${pathname === '/profile' ? 'active' : ''}`}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                    <span>{t('navProfile')}</span>
                </Link>
            </nav>
        </>
    );
}
