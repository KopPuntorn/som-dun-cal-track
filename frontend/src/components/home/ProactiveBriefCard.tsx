import Link from "next/link";

type DailyBriefSignal = {
  label: string;
  value: string;
  tone: string;
};

type DailyBriefAction = {
  label: string;
  prompt: string;
  variant?: string;
};

type DailyBrief = {
  eyebrow: string;
  title: string;
  summary: string;
  focusLabel: string;
  focusValue: string;
  momentumLabel: string;
  momentumValue: string;
  signals: DailyBriefSignal[];
  actions: DailyBriefAction[];
};

type ProactiveBriefCardProps = {
  brief: DailyBrief;
};

export default function ProactiveBriefCard({ brief }: ProactiveBriefCardProps) {
  return (
    <section className="proactive-brief-card">
      <div className="proactive-brief-shell">
        <div className="proactive-brief-copy">
          <p className="proactive-brief-eyebrow">{brief.eyebrow}</p>
          <h2 className="proactive-brief-title">{brief.title}</h2>
          <p className="proactive-brief-summary">{brief.summary}</p>
        </div>

        <div className="proactive-brief-meta" aria-label={`${brief.focusLabel}: ${brief.focusValue}`}>
          <div className="proactive-brief-meta-card proactive-brief-meta-card--focus">
            <span className="proactive-brief-meta-label">{brief.focusLabel}</span>
            <strong className="proactive-brief-meta-value">{brief.focusValue}</strong>
          </div>
          <div className="proactive-brief-meta-card proactive-brief-meta-card--momentum">
            <span className="proactive-brief-meta-label">{brief.momentumLabel}</span>
            <strong className="proactive-brief-meta-value">{brief.momentumValue}</strong>
          </div>
        </div>

        <div className="proactive-brief-signal-grid">
          {brief.signals.map((signal) => (
            <article
              key={`${signal.label}-${signal.tone}`}
              className={`proactive-brief-signal proactive-brief-signal--${signal.tone}`}
            >
              <span className="proactive-brief-signal-label">{signal.label}</span>
              <strong className="proactive-brief-signal-value">{signal.value}</strong>
            </article>
          ))}
        </div>

        <div className="proactive-brief-actions">
          {brief.actions.map((action) => (
            <Link
              key={`${action.label}-${action.prompt}`}
              href={`/ai-chat?prompt=${encodeURIComponent(action.prompt)}`}
              className={`proactive-brief-action proactive-brief-action--${action.variant || "secondary"}`}
            >
              {action.label}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
