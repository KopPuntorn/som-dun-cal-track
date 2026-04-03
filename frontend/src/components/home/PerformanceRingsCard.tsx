type PerformanceMetric = {
  label: string;
  percent: number;
  value: string;
  tone: "nutrition" | "hydration" | "fitness" | "recovery";
};

type PerformanceRingsCardProps = {
  title: string;
  subtitle: string;
  metrics: PerformanceMetric[];
};

const ORBIT_CONFIG = [
  { radius: 64, tone: "nutrition" as const },
  { radius: 50, tone: "hydration" as const },
  { radius: 36, tone: "fitness" as const },
  { radius: 22, tone: "recovery" as const },
];

const toneToStroke: Record<PerformanceMetric["tone"], { solid: string; glow: string }> = {
  nutrition: { solid: "#f97316", glow: "rgba(249, 115, 22, 0.4)" },
  hydration: { solid: "#38bdf8", glow: "rgba(56, 189, 248, 0.4)" },
  fitness: { solid: "#22c55e", glow: "rgba(34, 197, 94, 0.4)" },
  recovery: { solid: "#a855f7", glow: "rgba(168, 85, 247, 0.4)" },
};

export default function PerformanceRingsCard({
  title,
  subtitle,
  metrics,
}: PerformanceRingsCardProps) {
  return (
    <section className="glass-panel performance-card">
      <div className="performance-card-header">
        <div>
          <p className="performance-card-eyebrow">{title}</p>
          <h2 className="performance-card-title">{subtitle}</h2>
        </div>
      </div>

      <div className="performance-card-body">
        <div className="performance-orbit-wrap" aria-hidden="true">
          <svg viewBox="0 0 160 160" className="performance-orbit-svg">
            <defs>
              <filter id="performance-blur" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
              </filter>
            </defs>

            {ORBIT_CONFIG.map(({ radius }) => (
              <circle
                key={`bg-${radius}`}
                cx="80"
                cy="80"
                r={radius}
                fill="none"
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="10"
              />
            ))}

            {ORBIT_CONFIG.map(({ radius, tone }) => {
              const metric = metrics.find((item) => item.tone === tone);
              const circumference = 2 * Math.PI * radius;
              const percent = metric?.percent ?? 0;
              const segmentLength = (Math.min(100, percent) / 100) * circumference;
              const colors = toneToStroke[tone];

              return (
                <g key={`group-${tone}`}>
                  {/* Glow Layer */}
                  <circle
                    cx="80"
                    cy="80"
                    r={radius}
                    fill="none"
                    stroke={colors.glow}
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeDasharray={`${segmentLength} ${circumference}`}
                    transform="rotate(-90 80 80)"
                    style={{
                      transition: "stroke-dasharray 1.2s cubic-bezier(0.16, 1, 0.3, 1)",
                      filter: "blur(4px)",
                      mixBlendMode: "screen",
                    }}
                  />
                  {/* Crisp Segment Layer */}
                  <circle
                    cx="80"
                    cy="80"
                    r={radius}
                    fill="none"
                    stroke={colors.solid}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${segmentLength} ${circumference}`}
                    transform="rotate(-90 80 80)"
                    style={{
                      transition: "stroke-dasharray 1.2s cubic-bezier(0.16, 1, 0.3, 1)",
                    }}
                  />
                </g>
              );
            })}
          </svg>

          <div className="performance-orbit-core">
            <div className="performance-orbit-core-inner">
              <span className="performance-orbit-core-label">{title}</span>
              <span className="performance-orbit-core-value">
                {Math.round(metrics.reduce((sum, item) => sum + item.percent, 0) / metrics.length)}%
              </span>
            </div>
          </div>
        </div>

        <div className="performance-metric-list">
          {metrics.map((metric) => (
            <article key={metric.tone} className={`performance-metric-card performance-metric-card--${metric.tone}`}>
              <div className="performance-metric-top">
                <span className="performance-metric-label">{metric.label}</span>
                <span className="performance-metric-percent">{metric.percent}%</span>
              </div>
              <p className="performance-metric-value">{metric.value}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
