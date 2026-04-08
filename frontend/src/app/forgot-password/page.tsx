"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useLanguage } from "@/context/LanguageContext";

export default function ForgotPasswordPage() {
    const { language } = useLanguage();
    const isThai = language === "th";
    const [email, setEmail] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

    const copy = {
        eyebrow: isThai ? "กู้การเข้าถึงบัญชี" : "Account access recovery",
        title: isThai ? "ลืมรหัสผ่านใช่ไหม" : "Forgot your password?",
        intro: isThai
            ? "SomDun ยังไม่มีระบบส่งลิงก์รีเซ็ตรหัสผ่านอัตโนมัติใน build นี้ แต่เราช่วยพาคุณกลับไปยังทางเลือกที่เหมาะที่สุดได้"
            : "SomDun does not yet ship an automatic reset-link flow in this build, but we can still guide you to the best recovery path.",
        helper: isThai ? "อีเมลบัญชี" : "Account email",
        placeholder: "you@example.com",
        continue: isThai ? "ดูทางเลือกการกู้บัญชี" : "Review recovery options",
        invalidEmail: isThai ? "กรุณากรอกอีเมลให้ถูกต้องก่อนดำเนินการต่อ" : "Enter a valid email address before continuing.",
        resultEyebrow: isThai ? "ทางเลือกที่ใช้ได้ตอนนี้" : "Recovery options available now",
        resultTitle: isThai ? "เรายังไม่สามารถส่งลิงก์รีเซ็ตให้ได้โดยอัตโนมัติ" : "We cannot send a reset link automatically yet",
        resultCopy: isThai
            ? "สำหรับบัญชีที่ใช้อีเมล {email} คุณยังสามารถกลับไปหน้าเข้าสู่ระบบเพื่อทดลองใหม่ หรือใช้ Google sign-in หากบัญชีนี้เคยผูกกับ Google มาก่อน"
            : "For the account using {email}, you can return to login and try again, or use Google sign-in if this account was originally connected to Google.",
        optionGoogleTitle: isThai ? "เคยใช้ Google มาก่อน" : "If you used Google before",
        optionGoogleCopy: isThai
            ? "กลับไปหน้า login แล้วกดเข้าสู่ระบบด้วย Google เพื่อเข้าบัญชีเดิมโดยไม่ต้องใช้รหัสผ่าน"
            : "Go back to login and use Google sign-in to recover the same account without a password.",
        optionEmailTitle: isThai ? "ใช้อีเมลอย่างเดียว" : "If this account is email-only",
        optionEmailCopy: isThai
            ? "เก็บอีเมลนี้ไว้และกลับมาตรวจสอบ flow นี้อีกครั้งเมื่อระบบรีเซ็ตรหัสผ่านพร้อมใช้งาน"
            : "Keep this email handy and return to this flow once password-reset support is available in the product.",
        optionSecurityTitle: isThai ? "ต้องการอ่านเงื่อนไขก่อน" : "Need more account details",
        optionSecurityCopy: isThai
            ? "ดูนโยบายความเป็นส่วนตัวและข้อกำหนดการใช้งานก่อนตัดสินใจว่าจะใช้บัญชีแบบใดต่อ"
            : "Review the privacy and terms pages before deciding how you want to continue using this account.",
        loginCta: isThai ? "กลับไปหน้า Login" : "Back to Login",
        privacyCta: isThai ? "อ่าน Privacy Policy" : "Read Privacy Policy",
        termsCta: isThai ? "อ่าน Terms of Service" : "Read Terms of Service",
        noteTitle: isThai ? "สถานะปัจจุบัน" : "Current status",
        noteCopy: isThai
            ? "จากการตรวจฝั่ง backend ตอนนี้ยังมีเฉพาะ login, register และ Google login route เท่านั้น ยังไม่มี forgot/reset password endpoint"
            : "The backend currently exposes login, register, and Google sign-in routes only. A forgot/reset password endpoint is not available yet.",
    };

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const normalized = email.trim();
        const isValidEmail = /\S+@\S+\.\S+/.test(normalized);

        if (!isValidEmail) {
            setError(copy.invalidEmail);
            setSubmittedEmail(null);
            return;
        }

        setError(null);
        setSubmittedEmail(normalized);
    };

    return (
        <div className="page-shell forgot-page-shell">
            <div className="forgot-page">
                <section className="glass-panel forgot-hero">
                    <div className="forgot-copy">
                        <div className="forgot-eyebrow">{copy.eyebrow}</div>
                        <h1 className="forgot-title">{copy.title}</h1>
                        <p className="forgot-intro">{copy.intro}</p>
                    </div>

                    <form className="forgot-form" onSubmit={handleSubmit}>
                        <label className="forgot-label" htmlFor="forgot-email">{copy.helper}</label>
                        <div className="forgot-input-wrap">
                            <input
                                id="forgot-email"
                                type="email"
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                placeholder={copy.placeholder}
                            />
                        </div>

                        {error && <div className="forgot-error">{error}</div>}

                        <button type="submit" className="primary-btn forgot-submit-btn">
                            {copy.continue}
                        </button>
                    </form>
                </section>

                <section className="glass-panel forgot-status-card">
                    <div className="forgot-status-label">{copy.noteTitle}</div>
                    <p className="forgot-status-copy">{copy.noteCopy}</p>
                </section>

                <section className="forgot-grid">
                    <article className="glass-panel forgot-option forgot-option--teal">
                        <h2>{copy.optionGoogleTitle}</h2>
                        <p>{copy.optionGoogleCopy}</p>
                    </article>

                    <article className="glass-panel forgot-option forgot-option--amber">
                        <h2>{copy.optionEmailTitle}</h2>
                        <p>{copy.optionEmailCopy}</p>
                    </article>

                    <article className="glass-panel forgot-option forgot-option--violet">
                        <h2>{copy.optionSecurityTitle}</h2>
                        <p>{copy.optionSecurityCopy}</p>
                    </article>
                </section>

                {submittedEmail && (
                    <section className="glass-panel forgot-result">
                        <div className="forgot-result-eyebrow">{copy.resultEyebrow}</div>
                        <h2 className="forgot-result-title">{copy.resultTitle}</h2>
                        <p className="forgot-result-copy">
                            {copy.resultCopy.replace("{email}", submittedEmail)}
                        </p>

                        <div className="forgot-actions">
                            <Link href="/login" className="primary-btn forgot-action-primary">
                                {copy.loginCta}
                            </Link>
                            <Link href="/privacy" className="forgot-action-link">
                                {copy.privacyCta}
                            </Link>
                            <Link href="/terms" className="forgot-action-link">
                                {copy.termsCta}
                            </Link>
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
}
