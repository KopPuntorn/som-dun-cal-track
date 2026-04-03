"use client";

import { useState } from "react";
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

    const handleGoogleSuccess = async (credentialResponse: { credential?: string | null }) => {
        setLoading(true);
        setError(null);

        try {
            const res = await fetch(`${API_BASE}/auth/google`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
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

    return (
        <div className="page-shell page-shell--center login-screen">

            <div className="glass-panel login-panel">

                {/* Brand */}
                <div className="login-brand">
                    <div className="login-monogram">S</div>
                    <div>
                        <h1 className="login-title">SomDun</h1>
                        <p className="login-subtitle">{t('loginSubtitle')}</p>
                    </div>
                </div>

                {/* Tab Switcher */}
                <div className="login-tabs">
                    <button
                        type="button"
                        onClick={() => { setIsLogin(true); setError(null); }}
                        className={`login-tab ${isLogin ? 'active' : ''}`}
                    >
                        {t('login')}
                    </button>
                    <button
                        type="button"
                        onClick={() => { setIsLogin(false); setError(null); }}
                        className={`login-tab ${!isLogin ? 'active' : ''}`}
                    >
                        {t('signup')}
                    </button>
                </div>

                {/* Error */}
                {error && (
                    <div className="login-error">{error}</div>
                )}

                {/* Form */}
                <form onSubmit={handleEmailAuth} className="login-form">
                    {!isLogin && (
                        <div className="login-input-group">
                            <label>{t('fullName')}</label>
                            <div className="login-input-wrap">
                                <span className="login-input-icon">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                </span>
                                <input
                                    type="text"
                                    placeholder="John Doe"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    disabled={loading}
                                />
                            </div>
                        </div>
                    )}

                    <div className="login-input-group">
                        <label>{t('email')}</label>
                        <div className="login-input-wrap">
                            <span className="login-input-icon">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                            </span>
                            <input
                                type="email"
                                placeholder="you@example.com"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                disabled={loading}
                            />
                        </div>
                    </div>

                    <div className="login-input-group">
                        <label>{t('password')}</label>
                        <div className="login-input-wrap">
                            <span className="login-input-icon">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                            </span>
                            <input
                                type={showPassword ? "text" : "password"}
                                placeholder="••••••••"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                disabled={loading}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="login-eye-btn"
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
                        <div className="login-policy">
                            <input
                                type="checkbox"
                                id="policy"
                                checked={acceptedPolicy}
                                onChange={(e) => setAcceptedPolicy(e.target.checked)}
                            />
                            <label htmlFor="policy">
                                I agree to the <a href="#">Privacy Policy</a> and <a href="#">Terms of Service</a>.
                            </label>
                        </div>
                    )}

                    <button type="submit" className="primary-btn" disabled={loading}>
                        {loading ? 'Wait...' : (isLogin ? t('login').toUpperCase() : t('signup').toUpperCase())}
                    </button>
                </form>

                {/* Divider */}
                <div className="login-divider">
                    <span>{t('continueWith')}</span>
                </div>

                {/* Google Login */}
                <div className="login-google-wrap">
                    <GoogleLogin
                        onSuccess={handleGoogleSuccess}
                        onError={() => setError("Google Login Failed")}
                        theme="filled_black"
                        shape="pill"
                        text={isLogin ? "signin_with" : "signup_with"}
                        width="280"
                    />
                </div>

            </div>
        </div>
    );
}
