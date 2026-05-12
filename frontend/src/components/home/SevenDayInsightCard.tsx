import Link from "next/link";

type SevenDayInsightStat = {
  label: string;
  value: string;
  tone: string;
};

type SevenDayInsight = {
  eyebrow: string;
  title: string;
  summary: string;
  stats: SevenDayInsightStat[];
  ctaLabel: string;
  prompt: string;
};

type SevenDayInsightCardProps = {
  insight: SevenDayInsight;
};

export default function SevenDayInsightCard({ insight }: SevenDayInsightCardProps) {
  return (
    <section className="seven-day-insight-card">
      <div className="seven-day-insight-copy">
        <p className="seven-day-insight-eyebrow">{insight.eyebrow}</p>
        <h3 className="seven-day-insight-title">{insight.title}</h3>
        <p className="seven-day-insight-summary">{insight.summary}</p>
      </div>

      <div className="seven-day-insight-stats">
        {insight.stats.map((stat) => (
          <article
            key={`${stat.label}-${stat.tone}`}
            className={`seven-day-insight-stat seven-day-insight-stat--${stat.tone}`}
          >
            <span className="seven-day-insight-stat-label">{stat.label}</span>
            <strong className="seven-day-insight-stat-value">{stat.value}</strong>
          </article>
        ))}
      </div>

      <Link
        href={`/ai-chat?prompt=${encodeURIComponent(insight.prompt)}`}
        className="seven-day-insight-cta"
      >
        {insight.ctaLabel}
      </Link>
    </section>
  );
}
