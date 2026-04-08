"use client";

import Link from "next/link";
import { useLanguage } from "@/context/LanguageContext";

type LegalSection = {
    title: string;
    body: string[];
};

type LegalDocumentPageProps = {
    eyebrow: {
        th: string;
        en: string;
    };
    title: {
        th: string;
        en: string;
    };
    intro: {
        th: string;
        en: string;
    };
    highlight: {
        th: string;
        en: string;
    };
    lastUpdated: string;
    sections: {
        th: LegalSection[];
        en: LegalSection[];
    };
};

export default function LegalDocumentPage({
    eyebrow,
    title,
    intro,
    highlight,
    lastUpdated,
    sections,
}: LegalDocumentPageProps) {
    const { language } = useLanguage();
    const isThai = language === "th";
    const content = isThai
        ? {
            eyebrow: eyebrow.th,
            title: title.th,
            intro: intro.th,
            highlight: highlight.th,
            sections: sections.th,
            backLabel: "กลับไปหน้าเข้าสู่ระบบ",
            updatedLabel: "อัปเดตล่าสุด",
        }
        : {
            eyebrow: eyebrow.en,
            title: title.en,
            intro: intro.en,
            highlight: highlight.en,
            sections: sections.en,
            backLabel: "Back to Login",
            updatedLabel: "Last updated",
        };

    return (
        <div className="page-shell legal-page-shell">
            <div className="legal-page">
                <header className="glass-panel legal-hero">
                    <div className="legal-hero-copy">
                        <div className="legal-eyebrow">{content.eyebrow}</div>
                        <h1 className="legal-title">{content.title}</h1>
                        <p className="legal-intro">{content.intro}</p>
                    </div>

                    <div className="legal-hero-meta">
                        <div className="legal-updated">
                            <span>{content.updatedLabel}</span>
                            <strong>{lastUpdated}</strong>
                        </div>
                        <p className="legal-highlight">{content.highlight}</p>
                        <Link href="/login" className="primary-btn legal-back-btn">
                            {content.backLabel}
                        </Link>
                    </div>
                </header>

                <div className="legal-sections">
                    {content.sections.map((section) => (
                        <section key={section.title} className="glass-panel legal-section">
                            <h2 className="legal-section-title">{section.title}</h2>
                            <div className="legal-section-body">
                                {section.body.map((paragraph) => (
                                    <p key={paragraph}>{paragraph}</p>
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            </div>
        </div>
    );
}
