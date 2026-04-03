import Link from "next/link";
import StreakBadge from "@/components/StreakBadge";

type HomeHeaderProps = {
  currentDate: string;
  level: number;
  streakDays: number;
  currentLevelXP: number;
  xpProgress: number;
  languageLabel: string;
  languageToggleTitle: string;
  quickAddTitle: string;
  aiAssistantTitle: string;
  analyticsTitle: string;
  playerCardTitle: string;
  profileSettingsTitle: string;
  onToggleLanguage: () => void;
  onQuickAdd: () => void;
};

export default function HomeHeader({
  currentDate,
  level,
  streakDays,
  currentLevelXP,
  xpProgress,
  languageLabel,
  languageToggleTitle,
  quickAddTitle,
  aiAssistantTitle,
  analyticsTitle,
  playerCardTitle,
  profileSettingsTitle,
  onToggleLanguage,
  onQuickAdd,
}: HomeHeaderProps) {
  return (
    <header className="glass-panel main-header home-header">
      <div className="home-header-brand">
        <div className="home-header-copy">
          <div className="home-header-meta">
            <span className="home-header-date">{currentDate}</span>
            {streakDays > 0 && <StreakBadge days={streakDays} size="sm" label="Streak" />}
          </div>

          <div className="home-header-title-row">
            <h1 className="home-header-title">SomDun</h1>
            <span className="level-badge home-header-level">LVL {level}</span>
          </div>

          <div className="home-header-xp">
            <div className="xp-bar-container home-header-xpbar">
              <div className="xp-bar-fill" style={{ width: `${xpProgress}%` }}></div>
            </div>
            <span className="home-header-xptext">{currentLevelXP} / 1000 XP</span>
          </div>
        </div>
      </div>

      <div className="header-actions home-header-actions">
        <div id="chat-toggle-btn" className="home-header-action-anchor mobile-hidden">
          <Link
            id="chat-toggle-btn-mobile"
            href="/ai-chat"
            className="icon-btn active home-header-ai"
            title={aiAssistantTitle}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              <path d="M9 10l2 2 4-4"></path>
            </svg>
          </Link>
        </div>

        <div className="home-header-action-anchor mobile-hidden">
          <button
            type="button"
            onClick={onQuickAdd}
            className="icon-btn home-header-quick"
            title={quickAddTitle}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
        </div>

        <button
          type="button"
          onClick={onToggleLanguage}
          className="icon-btn home-header-lang mobile-hidden"
          title={languageToggleTitle}
        >
          {languageLabel}
        </button>

        <Link id="player-card-section" href="/player-card" className="icon-btn mobile-hidden" title={playerCardTitle}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
            <line x1="8" y1="21" x2="16" y2="21"></line>
            <line x1="12" y1="17" x2="12" y2="21"></line>
          </svg>
        </Link>

        <Link id="analytics-section" href="/dashboard" className="icon-btn mobile-hidden" title={analyticsTitle}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10"></line>
            <line x1="12" y1="20" x2="12" y2="4"></line>
            <line x1="6" y1="20" x2="6" y2="14"></line>
          </svg>
        </Link>

        <div id="profile-btn" className="home-header-action-anchor mobile-hidden">
          <Link id="profile-btn-mobile" href="/profile" className="icon-btn" title={profileSettingsTitle}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
          </Link>
        </div>
      </div>
    </header>
  );
}
