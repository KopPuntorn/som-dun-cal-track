"use client";

import { useState } from "react";
import Image from "next/image";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL !== "undefined")
    ? process.env.NEXT_PUBLIC_API_URL
    : "http://localhost:8080/api";

export default function LoginPage() {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [acceptedPolicy, setAcceptedPolicy] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    const { login } = useAuth();
    const { t } = useLanguage();

    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password || (!isLogin && !name)) {
            setError("Please fill all fields");
            return;
        }

        if (!isLogin && !acceptedPolicy) {
            setError("Please accept the Privacy Policy to continue");
            return;
        }

        setLoading(true);
        setError(null);

        const endpoint = isLogin ? "/auth/login" : "/auth/register";
        const body = isLogin ? { email, password } : { email, password, name };

        try {
            const res = await fetch(`${API_BASE}${endpoint}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            const data = await res.json();

            if (res.ok) {
                login(data.token, data.user);
            } else {
                setError(data.error || "Authentication failed");
            }
        } catch (err) {
            setError("Network error. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSuccess = async (credentialResponse: any) => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch(`${API_BASE}/auth/google`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                // Fallback for mocked token if testing without real client ID
                body: JSON.stringify({ token: credentialResponse.credential || "MOCK_GOOGLE_TOKEN_123" }),
            });

            const data = await res.json();
            if (res.ok) {
                login(data.token, data.user);
            } else {
                setError(data.error || "Google Auth failed");
            }
        } catch (err) {
            setError("Network error communicating with server");
        } finally {
            setLoading(false);
        }
    };

    // Allow a secret bypass for local testing without real Google Client ID
    const handleMockGoogleLogin = () => {
        handleGoogleSuccess({ credential: "MOCK_GOOGLE_TOKEN_123" });
    };

    return (
        <div className="page-shell page-shell--center login-screen" style={{ width: '100vw', overflowX: 'hidden', overflowY: 'auto', padding: '20px 16px' }}>
            <div className="floating-blob floating-blob-1" />
            <div className="floating-blob floating-blob-2" />
            <div className="floating-blob floating-blob-3" />

            <div className="glass-panel login-panel" style={{ width: "100%", maxWidth: "400px", zIndex: 1, display: "flex", flexDirection: "column", gap: "16px", padding: '20px 16px', borderRadius: '32px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', margin: 'auto' }}>

                <div style={{ textAlign: "center", marginBottom: "0px", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
                    <div style={{ position: 'relative', width: '60px', height: '60px', borderRadius: '18px', overflow: 'hidden', background: '#fff', boxShadow: '0 8px 20px rgba(255,107,0,0.1)', padding: '2px' }}>
                        <div style={{ width: '100%', height: '100%', borderRadius: '16px', overflow: 'hidden', background: '#fff', position: 'relative' }}>
                            <Image
                                src="/logo.png"
                                alt="SomDun Logo"
                                fill
                                style={{ objectFit: 'contain', padding: '8px' }}
                            />
                        </div>
                    </div>
                    <div>
                        <h1 style={{ fontSize: "28px", fontWeight: 900, marginBottom: "0px", background: 'var(--accent-cal-gradient)', WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: '-1px' }}>
                            SomDun
                        </h1>
                        <p style={{ color: "var(--text-secondary)", fontSize: "10px", fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', opacity: 0.7 }}>
                            Performance Hub
                        </p>
                    </div>
                </div>

                {/* Custom Tab Switcher */}
                <div style={{ display: "flex", background: "rgba(255,255,255,0.03)", borderRadius: '20px', padding: "6px", border: '1px solid var(--panel-border)', boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.2)' }}>
                    <button
                        type="button"
                        onClick={() => { setIsLogin(true); setError(null); }}
                        className={`glass-btn ${isLogin ? 'active' : ''}`}
                        style={{
                            flex: 1,
                            border: 'none',
                            borderRadius: '16px',
                            height: '40px',
                            background: isLogin ? 'var(--accent-cal-gradient)' : 'transparent',
                            color: isLogin ? '#fff' : 'var(--text-secondary)',
                            fontWeight: 700,
                            letterSpacing: '1px',
                            transition: 'all 0.3s ease'
                        }}
                    >
                        {t('login')}
                    </button>
                    <button
                        type="button"
                        onClick={() => { setIsLogin(false); setError(null); }}
                        className={`glass-btn ${!isLogin ? 'active' : ''}`}
                        style={{
                            flex: 1,
                            border: 'none',
                            borderRadius: '16px',
                            height: '40px',
                            background: !isLogin ? 'var(--accent-cal-gradient)' : 'transparent',
                            color: !isLogin ? '#fff' : 'var(--text-secondary)',
                            fontWeight: 700,
                            letterSpacing: '1px',
                            transition: 'all 0.3s ease'
                        }}
                    >
                        {t('signup')}
                    </button>
                </div>

                {error && (
                    <div style={{ background: "rgba(255, 45, 85, 0.1)", borderLeft: "4px solid var(--danger)", padding: "14px 20px", borderRadius: "4px 12px 12px 4px", fontSize: "14px", color: "var(--text-primary)", fontWeight: 500 }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleEmailAuth} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {!isLogin && (
                        <div className="input-group">
                            <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '6px', display: 'block' }}>{t('fullName')}</label>
                            <div style={{ position: 'relative' }}>
                                <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                </span>
                                <input type="text" placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} disabled={loading} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--panel-border)", height: "48px", borderRadius: '12px', padding: '0 16px 0 46px', width: '100%', fontSize: '14px' }} />
                            </div>
                        </div>
                    )}

                    <div className="input-group">
                        <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '6px', display: 'block' }}>{t('email')}</label>
                        <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                            </span>
                            <input type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} disabled={loading} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--panel-border)", height: "48px", borderRadius: '12px', padding: '0 16px 0 46px', width: '100%', fontSize: '14px' }} />
                        </div>
                    </div>

                    <div className="input-group">
                        <label style={{ fontSize: '10px', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '6px', display: 'block' }}>{t('password')}</label>
                        <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                            </span>
                            <input type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} disabled={loading} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--panel-border)", height: "48px", borderRadius: '12px', padding: '0 46px 0 46px', width: '100%', fontSize: '14px' }} />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5, color: 'var(--text-secondary)', padding: '4px' }}
                                title={showPassword ? t('hidePassword') : t('showPassword')}
                            >
                                {showPassword ? (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"></path><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                                ) : (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                )}
                            </button>
                        </div>
                    </div>

                    {!isLogin && (
                        <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", marginTop: "4px" }}>
                            <input
                                type="checkbox"
                                id="policy"
                                checked={acceptedPolicy}
                                onChange={(e) => setAcceptedPolicy(e.target.checked)}
                                style={{ marginTop: "4px", width: "18px", height: "18px", accentColor: "var(--accent-cal)", cursor: 'pointer' }}
                            />
                            <label htmlFor="policy" style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.5" }}>
                                I agree to the <span style={{ color: "var(--accent-cal)", fontWeight: 600, textDecoration: "underline", cursor: "pointer" }}>Privacy Policy</span> and <span style={{ color: "var(--accent-cal)", fontWeight: 600, textDecoration: "underline", cursor: "pointer" }}>Terms of Service</span>.
                            </label>
                        </div>
                    )}

                    <button type="submit" className="primary-btn active" disabled={loading} style={{ height: "48px", marginTop: "8px", fontSize: "15px", fontWeight: 800, letterSpacing: "1.5px", borderRadius: '14px', boxShadow: '0 8px 20px rgba(255, 107, 0, 0.2)' }}>
                        {loading ? (
                            <div className="loading-dots">Wait...</div>
                        ) : (isLogin ? t('login').toUpperCase() : t('signup').toUpperCase())}
                    </button>
                </form>

                <div style={{ position: "relative", textAlign: "center", margin: "4px 0" }}>
                    <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: "1px", background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)", zIndex: 0 }}></div>
                    <span style={{ position: "relative", zIndex: 1, background: "#0c0c0c", padding: "0 24px", fontSize: '8px', fontWeight: 800, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "3px" }}>
                        {t('continueWith')}
                    </span>
                </div>

                <div style={{ display: "flex", justifyContent: "center", width: "100%", overflow: 'hidden' }}>
                    {/* Centered and slightly narrower Google Button for mobile compatibility */}
                    <GoogleLogin
                        onSuccess={handleGoogleSuccess}
                        onError={() => setError("Google Login Failed")}
                        theme="filled_black"
                        shape="pill"
                        text={isLogin ? "signin_with" : "signup_with"}
                        width="280"
                    />
                </div>

                {/* Helper for testing environment without Google Client ID */}
                <div style={{ textAlign: 'center', marginTop: '8px' }}>
                    <button type="button" onClick={handleMockGoogleLogin} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', textDecoration: 'underline', fontSize: '10px', cursor: 'pointer', opacity: 0.5 }}>
                        (Dev Mock Login)
                    </button>
                </div>

            </div>
        </div>
    );
}
