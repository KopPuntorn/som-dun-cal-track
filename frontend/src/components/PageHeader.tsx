import React from "react";
import Link from "next/link";

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  onBack?: () => void;
  actions?: React.ReactNode;
};

export default function PageHeader({
  title,
  subtitle,
  backHref,
  backLabel,
  onBack,
  actions,
}: PageHeaderProps) {
  const backButton = backHref ? (
    <Link href={backHref} className="icon-btn" title={backLabel} aria-label={backLabel}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </Link>
  ) : onBack ? (
    <button onClick={onBack} className="icon-btn" title={backLabel} aria-label={backLabel}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
  ) : null;

  return (
    <header className="glass-panel page-header">
      <div className="page-header-left">
        {backButton}
        <div className="page-header-text">
          <h1 className="page-header-title">{title}</h1>
          {subtitle && <p className="page-header-subtitle">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  );
}
