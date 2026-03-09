"use client";

import { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";

const API_BASE = process.env.NEXT_PUBLIC_API_URL;

export default function LoginPage() {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const { login } = useAuth();
    const { t } = useLanguage();

    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password || (!isLogin && !name)) {
            setError("Please fill all fields");
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

            <div className="glass-panel login-panel" style={{ width: "100%", maxWidth: "420px", zIndex: 1, display: "flex", flexDirection: "column", gap: "24px" }}>

                <div style={{ textAlign: "center", marginBottom: "8px" }}>
                    <h1 style={{ fontSize: "32px", marginBottom: "8px", background: "var(--accent-cal-gradient)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                        SomDun
                    </h1>
                    <p style={{ color: "var(--text-secondary)", fontSize: "15px" }}>
                        Sign in to your personalized dashboard
                    </p>
                </div>

                {/* Custom Tab Switcher */}
                <div style={{ display: "flex", background: "rgba(0,0,0,0.3)", borderRadius: "12px", padding: "4px" }}>
                    <button
                        type="button"
                        onClick={() => { setIsLogin(true); setError(null); }}
                        style={{ flex: 1, padding: "10px", borderRadius: "10px", background: isLogin ? "rgba(255,255,255,0.1)" : "transparent", color: isLogin ? "#fff" : "var(--text-secondary)", border: "none", cursor: "pointer", transition: "all 0.3s", fontWeight: isLogin ? 600 : 400 }}
                    >
                        {t('login')}
                    </button>
                    <button
                        type="button"
                        onClick={() => { setIsLogin(false); setError(null); }}
                        style={{ flex: 1, padding: "10px", borderRadius: "10px", background: !isLogin ? "rgba(255,255,255,0.1)" : "transparent", color: !isLogin ? "#fff" : "var(--text-secondary)", border: "none", cursor: "pointer", transition: "all 0.3s", fontWeight: !isLogin ? 600 : 400 }}
                    >
                        {t('signup')}
                    </button>
                </div>

                {error && (
                    <div style={{ background: "rgba(255, 45, 85, 0.1)", borderLeft: "3px solid var(--danger)", padding: "12px 16px", borderRadius: "0 8px 8px 0", fontSize: "14px", color: "var(--text-primary)" }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleEmailAuth} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {!isLogin && (
                        <div className="input-group">
                            <label>{t('fullName')}</label>
                            <input type="text" placeholder="John Doe" value={name} onChange={e => setName(e.target.value)} disabled={loading} style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.05)", height: "48px" }} />
                        </div>
                    )}

                    <div className="input-group">
                        <label>{t('email')}</label>
                        <input type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} disabled={loading} style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.05)", height: "48px" }} />
                    </div>

                    <div className="input-group">
                        <label>{t('password')}</label>
                        <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} disabled={loading} style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.05)", height: "48px" }} />
                    </div>

                    <button type="submit" className="primary-btn" disabled={loading} style={{ height: "48px", marginTop: "8px", fontSize: "16px", fontWeight: 600, letterSpacing: "0.5px" }}>
                        {loading ? t('loading') : (isLogin ? t('login') : t('signup'))}
                    </button>
                </form>

                <div style={{ position: "relative", textAlign: "center", margin: "16px 0" }}>
                    <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: "1px", background: "rgba(255,255,255,0.1)", zIndex: 0 }}></div>
                    <span style={{ position: "relative", zIndex: 1, background: "var(--panel-bg)", padding: "0 16px", fontSize: "12px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "1px" }}>
                        {t('continueWith')}
                    </span>
                </div>

                <div style={{ display: "flex", justifyContent: "center", minHeight: "40px" }}>
                    {/* Real Google Login Button - restored for compatibility with ID Token validation */}
                    <GoogleLogin
                        onSuccess={handleGoogleSuccess}
                        onError={() => setError("Google Login Failed")}
                        useOneTap
                        theme="filled_black"
                        shape="pill"
                        text={isLogin ? "signin_with" : "signup_with"}
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
