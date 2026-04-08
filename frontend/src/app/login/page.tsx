"use client";

import Link from "next/link";
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
    const { t, language } = useLanguage();

    const isThai = language === "th";
    const copy = {
        eyebrow: isThai ? "ระบบโภชนาการสาย performance" : "High-performance nutrition system",
        headline: isThai ? "สร้างวินัยให้เหมือนนักกีฬาอาชีพ" : "Build consistency like an athlete.",
        description: isThai
            ? "บันทึกอาหาร อ่านภาพรวมของวัน และใช้ SomDun เปลี่ยนคำแนะนำที่ดีให้กลายเป็นจังหวะการดูแลตัวเองที่ทำต่อได้จริง"
            : "Log meals, read your daily signals, and let SomDun turn smart guidance into momentum you can keep.",
        loginModeTitle: isThai ? "ยินดีต้อนรับกลับ" : "Welcome back",
        signupModeTitle: isThai ? "สร้างบัญชี SomDun" : "Create your SomDun account",
        loginModeCopy: isThai
            ? "เข้าสู่ระบบเพื่อกลับไปยัง dashboard ของคุณและต่อยอดความสม่ำเสมอของวันนี้"
            : "Sign in to your personalized dashboard and continue today's momentum.",
        signupModeCopy: isThai
            ? "เริ่มต้นบัญชีของคุณเพื่อบันทึกอาหาร การพักฟื้น และ performance ในที่เดียว"
            : "Set up your account to start tracking meals, recovery, and performance in one place.",
        policyPrefix: isThai ? "ฉันยอมรับ" : "I agree to the",
        privacyPolicy: isThai ? "นโยบายความเป็นส่วนตัว" : "Privacy Policy",
        termsOfService: isThai ? "ข้อกำหนดการใช้งาน" : "Terms of Service",
        and: isThai ? "และ" : "and",
        fillAllFields: isThai ? "กรุณากรอกข้อมูลที่จำเป็นให้ครบ" : "Please fill in every required field.",
        acceptPolicy: isThai ? "กรุณายอมรับนโยบายความเป็นส่วนตัวก่อนดำเนินการต่อ" : "Please accept the Privacy Policy to continue.",
        authFailed: isThai ? "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" : "Authentication failed. Please try again.",
        networkTryAgain: isThai ? "เครือข่ายมีปัญหา กรุณาลองใหม่อีกครั้ง" : "Network error. Please try again.",
        networkServerIssue: isThai ? "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง" : "Could not reach the server. Please try again.",
        googleLoginFailed: isThai ? "เข้าสู่ระบบด้วย Google ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" : "Google login failed. Please try again.",
        secureSignInNote: isThai
            ? "เข้าสู่ระบบอย่างปลอดภัยด้วย Google หรืออีเมล ข้อมูลสุขภาพของคุณจะผูกกับบัญชีนี้เท่านั้น"
            : "Secure sign-in with Google or email. Your health data stays tied to your account.",
        forgotPassword: isThai ? "ลืมรหัสผ่าน?" : "Forgot password?",
        trustPrivate: isThai ? "ข้อมูลเป็นส่วนตัว" : "Private data",
        trustFast: isThai ? "เข้าใช้งานได้ไว" : "Fast access",
        trustNoSpam: isThai ? "ไม่มีสแปม" : "No spam",
        legalPrefix: isThai ? "อ่านรายละเอียดเพิ่มเติมได้ใน" : "Read the full details in our",
    };

    const loginFeatures = [
        {
            tone: "nutrition",
            title: isThai ? "บันทึกมื้ออาหารได้ลื่นกว่าเดิม" : "Log meals without friction",
            copy: isThai
                ? "เพิ่มอาหารได้เร็วด้วยการสแกน ค้นหา หรือใช้ AI ช่วยกรอกใน flow เดียว"
                : "Capture food fast with scan, search, or AI-assisted entry built for daily use.",
            icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 3v3" />
                    <path d="M16 3v3" />
                    <path d="M3 10h18" />
                    <rect x="3" y="5" width="18" height="16" rx="3" />
                    <path d="M8 14h8" />
                </svg>
            )
        },
        {
            tone: "coach",
            title: isThai ? "ถาม AI จากบริบทจริงของคุณ" : "Ask for guidance in context",
            copy: isThai
                ? "โค้ช AI อ่าน log ของคุณแล้วช่วยแนะนำสิ่งที่ควรทำต่อในวันนี้ได้ทันที"
                : "Your AI coach can read your logs and help with smarter choices for the rest of today.",
            icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3a3 3 0 0 0-3 3v1H7a2 2 0 0 0-2 2v3a7 7 0 0 0 14 0V9a2 2 0 0 0-2-2h-2V6a3 3 0 0 0-3-3Z" />
                    <path d="M8 19h8" />
                </svg>
            )
        },
        {
            tone: "progress",
            title: isThai ? "เห็นความคืบหน้าเป็นระบบเดียว" : "See progress as a system",
            copy: isThai
                ? "แคลอรี่ น้ำ กิจกรรม และการพักฟื้นถูกเชื่อมกันอยู่ใน dashboard เดียว"
                : "Calories, hydration, activity, and recovery work together in one premium dashboard.",
            icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 19h16" />
                    <path d="M7 15.5 10.5 12l2.5 2.5L17.5 10" />
                    <path d="M17.5 10H14" />
                </svg>
            )
        },
    ];

    const trustItems = [
        {
            tone: "teal",
            label: copy.trustPrivate,
            icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2 4 5v6c0 5 3.4 9.4 8 10 4.6-.6 8-5 8-10V5l-8-3Z" />
                </svg>
            )
        },
        {
            tone: "amber",
            label: copy.trustFast,
            icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />
                </svg>
            )
        },
        {
            tone: "violet",
            label: copy.trustNoSpam,
            icon: (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3v18" />
                    <path d="M3 12h18" />
                </svg>
            )
        },
    ];

    const handleEmailAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !password || (!isLogin && !name)) {
            setError(copy.fillAllFields);
            return;
        }

        if (!isLogin && !acceptedPolicy) {
            setError(copy.acceptPolicy);
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
                setError(data.error || copy.authFailed);
            }
        } catch {
            setError(copy.networkTryAgain);
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
                setError(data.error || copy.googleLoginFailed);
            }
        } catch {
            setError(copy.networkServerIssue);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="page-shell page-shell--center login-screen">
            <div className="login-shell">
                <section className="login-story">
                    <div className="login-story-badge">{copy.eyebrow}</div>

                    <div className="login-story-copywrap">
                        <h1 className="login-story-title">{copy.headline}</h1>
                        <p className="login-story-description">{copy.description}</p>
                    </div>

                    <div className="login-story-rail">
                        <div className="login-story-pulse login-story-pulse--amber" />
                        <div className="login-story-pulse login-story-pulse--teal" />
                        <div className="login-story-pulse login-story-pulse--violet" />
                    </div>

                    <div className="login-feature-grid">
                        {loginFeatures.map((feature) => (
                            <article key={feature.title} className={`login-feature-card login-feature-card--${feature.tone}`}>
                                <div className="login-feature-icon">{feature.icon}</div>
                                <div className="login-feature-copy">
                                    <h2 className="login-feature-title">{feature.title}</h2>
                                    <p className="login-feature-description">{feature.copy}</p>
                                </div>
                            </article>
                        ))}
                    </div>

                    <p className="login-story-footnote">{copy.secureSignInNote}</p>
                </section>

                <section className="glass-panel login-panel">

                {/* Brand */}
                <div className="login-brand">
                    <div className="login-brand-mark">
                        <div className="login-monogram">
                            <span className="login-monogram-letter">S</span>
                        </div>
                    </div>
                    <div className="login-brand-copy">
                        <h2 className="login-title">SomDun</h2>
                        <p className="login-subtitle">{t("loginSubtitle")}</p>
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

                <div className="login-mode-copy">
                    <h3 className="login-mode-title">{isLogin ? copy.loginModeTitle : copy.signupModeTitle}</h3>
                    <p className="login-mode-subtitle">{isLogin ? copy.loginModeCopy : copy.signupModeCopy}</p>
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
                        {isLogin && (
                            <div className="login-inline-actions">
                                <Link href="/forgot-password" className="login-text-link">
                                    {copy.forgotPassword}
                                </Link>
                            </div>
                        )}
                    </div>

                    {!isLogin && (
                        <div className="login-policy">
                            <input
                                type="checkbox"
                                id="policy"
                                checked={acceptedPolicy}
                                onChange={(e) => setAcceptedPolicy(e.target.checked)}
                            />
                            <div className="login-policy-copy">
                                <label htmlFor="policy">{copy.policyPrefix}</label>{" "}
                                <Link
                                    href="/privacy"
                                    className="login-policy-link"
                                >
                                    {copy.privacyPolicy}
                                </Link>{" "}
                                {copy.and}{" "}
                                <Link
                                    href="/terms"
                                    className="login-policy-link"
                                >
                                    {copy.termsOfService}
                                </Link>.
                            </div>
                        </div>
                    )}

                    <button type="submit" className="primary-btn login-submit-btn" disabled={loading}>
                        {loading ? t("loading") : (isLogin ? t("login") : t("signup"))}
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
                        onError={() => setError(copy.googleLoginFailed)}
                        theme="filled_black"
                        shape="pill"
                        text={isLogin ? "signin_with" : "signup_with"}
                        width="100%"
                    />
                </div>

                <div className="login-trust-row">
                    {trustItems.map((item) => (
                        <div key={item.label} className={`login-trust-pill login-trust-pill--${item.tone}`}>
                            <span className="login-trust-icon">{item.icon}</span>
                            <span>{item.label}</span>
                        </div>
                    ))}
                </div>

                <p className="login-security-note">{copy.secureSignInNote}</p>
                <div className="login-legal-row">
                    <span>{copy.legalPrefix}</span>
                    <Link href="/privacy" className="login-legal-link">
                        {copy.privacyPolicy}
                    </Link>
                    <span>{copy.and}</span>
                    <Link href="/terms" className="login-legal-link">
                        {copy.termsOfService}
                    </Link>
                </div>
                </section>
            </div>
        </div>
    );
}
