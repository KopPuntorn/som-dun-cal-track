type PerformanceMetric = {
  label: string;
  percent: number;
  value: string;
  tone: "nutrition" | "hydration" | "fitness" | "recovery";
};

type PerformanceRingsCardProps = {
  title: string;
  subtitle: string;
  summaryLabel: string;
  summaryHint: string;
  metrics: PerformanceMetric[];
};

export default function PerformanceRingsCard({
  title,
  subtitle,
  summaryLabel,
  summaryHint,
  metrics,
}: PerformanceRingsCardProps) {
  const overallPercent = Math.round(metrics.reduce((sum, item) => sum + item.percent, 0) / metrics.length);

  return (
    <section className="glass-panel performance-card">
      <div className="performance-card-header">
        <div>
          <p className="performance-card-eyebrow">{title}</p>
          <h2 className="performance-card-title">{subtitle}</h2>
        </div>
      </div>

      <div className="performance-card-body">
        <div className="performance-summary" aria-label={`${summaryLabel} ${overallPercent}%`}>
          <div className="performance-summary-top">
            <div className="performance-summary-copy">
              <span className="performance-summary-label">{summaryLabel}</span>
              <span className="performance-summary-value">{overallPercent}%</span>
            </div>
          </div>
          <div className="performance-summary-track" aria-hidden="true">
            <span className="performance-summary-fill" style={{ width: `${overallPercent}%` }} />
          </div>
          <p className="performance-summary-hint">{summaryHint}</p>
        </div>

        <div className="performance-detail-grid">
          {metrics.map((metric) => (
            <article key={metric.tone} className={`performance-detail-chip performance-detail-chip--${metric.tone}`}>
              <div className="performance-detail-top">
                <span className="performance-detail-label">{metric.label}</span>
                <span className="performance-detail-percent">{metric.percent}%</span>
              </div>
              <p className="performance-detail-value">{metric.value}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
