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
        <div className="app-container" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", position: "relative" }}>
            {/* Decorative background glows */}
            <div style={{ position: "absolute", top: "10%", left: "10%", width: "40vw", height: "40vw", background: "var(--accent-cal)", opacity: 0.15, filter: "blur(150px)", borderRadius: "50%" }}></div>
            <div style={{ position: "absolute", bottom: "10%", right: "10%", width: "40vw", height: "40vw", background: "#0ea5e9", opacity: 0.15, filter: "blur(150px)", borderRadius: "50%" }}></div>

            <div className="glass-panel login-panel" style={{ width: "100%", maxWidth: "420px", zIndex: 1, display: "flex", flexDirection: "column", gap: "28px", padding: '40px' }}>

                <div style={{ textAlign: "center", marginBottom: "8px", display: "flex", flexDirection: "column", alignItems: "center", gap: "20px" }}>
                    <div style={{ position: 'relative', width: '88px', height: '88px', borderRadius: '24px', overflow: 'hidden', background: '#fff', boxShadow: '0 12px 30px rgba(255,255,255,0.1)' }}>
                        <Image
                            src="/logo.png"
                            alt="SomDun Logo"
                            fill
                            style={{ objectFit: 'contain', padding: '10px' }}
                        />
                    </div>
                    <div>
                        <h1 style={{ fontSize: "36px", fontWeight: 800, marginBottom: "4px", background: 'var(--accent-cal-gradient)', WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: '-1px' }}>
                            SomDun
                        </h1>
                        <p style={{ color: "var(--text-secondary)", fontSize: "15px", fontWeight: 500 }}>
                            Elevate your performance.
                        </p>
                    </div>
                </div>

                {/* Custom Tab Switcher */}
                <div style={{ display: "flex", background: "rgba(0,0,0,0.4)", borderRadius: '16px', padding: "6px", border: '1px solid var(--panel-border)' }}>
                    <button
                        type="button"
                        onClick={() => { setIsLogin(true); setError(null); }}
                        className={`glass-btn ${isLogin ? 'active' : ''}`}
                        style={{ flex: 1, border: 'none', borderRadius: '12px' }}
                    >
                        {t('login')}
                    </button>
                    <button
                        type="button"
                        onClick={() => { setIsLogin(false); setError(null); }}
                        className={`glass-btn ${!isLogin ? 'active' : ''}`}
                        style={{ flex: 1, border: 'none', borderRadius: '12px' }}
                    >
                        {t('signup')}
                    </button>
                </div>

                {error && (
                    <div style={{ background: "rgba(255, 45, 85, 0.1)", borderLeft: "4px solid var(--danger)", padding: "14px 20px", borderRadius: "4px 12px 12px 4px", fontSize: "14px", color: "var(--text-primary)", fontWeight: 500 }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleEmailAuth} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                    {!isLogin && (
                        <div className="input-group">
                            <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', display: 'block' }}>{t('fullName')}</label>
                            <input type="text" placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} disabled={loading} style={{ background: "rgba(0,0,0,0.25)", border: "1px solid var(--panel-border)", height: "52px", borderRadius: '14px', padding: '0 20px' }} />
                        </div>
                    )}

                    <div className="input-group">
                        <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', display: 'block' }}>{t('email')}</label>
                        <input type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} disabled={loading} style={{ background: "rgba(0,0,0,0.25)", border: "1px solid var(--panel-border)", height: "52px", borderRadius: '14px', padding: '0 20px' }} />
                    </div>

                    <div className="input-group">
                        <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px', display: 'block' }}>{t('password')}</label>
                        <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} disabled={loading} style={{ background: "rgba(0,0,0,0.25)", border: "1px solid var(--panel-border)", height: "52px", borderRadius: '14px', padding: '0 20px' }} />
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

                    <button type="submit" className="primary-btn active" disabled={loading} style={{ height: "56px", marginTop: "12px", fontSize: "16px", fontWeight: 700, letterSpacing: "1px", borderRadius: '16px' }}>
                        {loading ? (
                            <div className="loading-dots">Authenticating...</div>
                        ) : (isLogin ? t('login').toUpperCase() : t('signup').toUpperCase())}
                    </button>
                </form>

                <div style={{ position: "relative", textAlign: "center", margin: "12px 0" }}>
                    <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: "1px", background: "rgba(255,255,255,0.08)", zIndex: 0 }}></div>
                    <span style={{ position: "relative", zIndex: 1, background: "#080808", padding: "0 20px", fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "2px" }}>
                        {t('continueWith')}
                    </span>
                </div>

                <div style={{ display: "flex", justifyContent: "center", minHeight: "44px", width: "100%" }}>
                    {/* Real Google Login Button - restored for compatibility with ID Token validation */}
                    <GoogleLogin
                        onSuccess={handleGoogleSuccess}
                        onError={() => setError("Google Login Failed")}
                        theme="filled_black"
                        shape="pill"
                        text={isLogin ? "signin_with" : "signup_with"}
                        width="340"
                    />
                </div>

                {/* Helper for testing environment without Google Client ID */}
                <div style={{ textAlign: 'center', marginTop: '16px' }}>
                    <button type="button" onClick={handleMockGoogleLogin} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', textDecoration: 'underline', fontSize: '11px', cursor: 'pointer', opacity: 0.6 }}>
                        (Developer Mock Google Login)
                    </button>
                </div>

            </div>
        </div>
    );
}
