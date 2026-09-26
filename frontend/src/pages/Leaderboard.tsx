import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHero } from "@/components/design-system/PageHero";
import "@/components/design-system/listing.css";

interface LeaderboardEntry {
  rank: number;
  email: string;
  name: string;
  avatar?: string;
  stagesCompleted: number;
  lastActivityAt: string;
  badgeType: 'founder' | 'innovator' | 'pioneer';
  reputationScore?: number;
}

const getTimeAgo = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

  if (diffMinutes < 60) return `${Math.max(diffMinutes, 1)}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return `${Math.floor(diffDays / 7)}w ago`;
};

const getStageAchievementName = (stagesCompleted: number): string => {
  const stages = [
    { id: 'problem', name: 'Problem Pathfinder' },
    { id: 'ideation', name: 'Concept Architect' },
    { id: 'research', name: 'Feasibility Explorer' },
    { id: 'validation', name: 'Validation Champion' },
    { id: 'prototype', name: 'Prototype Builder' },
    { id: 'mvp', name: 'Launch Leader' },
    { id: 'scaling', name: 'Scale Strategist' }
  ];

  if (stagesCompleted <= 0) {
    return 'Journey Starter';
  }

  const stageIndex = Math.min(stagesCompleted, stages.length) - 1;
  return stages[stageIndex]?.name || 'Journey Achiever';
};

const achievementTier = (stagesCompleted: number) => {
  if (stagesCompleted >= 7) return "var(--pink)";
  if (stagesCompleted >= 5) return "var(--violet)";
  if (stagesCompleted >= 3) return "var(--lime)";
  if (stagesCompleted >= 1) return "var(--white)";
  return "hsl(var(--muted-foreground))";
};

const Leaderboard = () => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const planeApiBaseUrl = import.meta.env.VITE_PLANE_API_BASE_URL || 'http://localhost:8000';

    const fetchLeaderboard = async () => {
      try {
        const response = await fetch(`${planeApiBaseUrl}/api/vj-startups/leaderboards/members/`);
        if (!response.ok) {
          throw new Error('Failed to fetch leaderboard');
        }

        const data = await response.json();
        // Map Django OrganizationMemberProfile array to LeaderboardEntry interface
        const mappedEntries: LeaderboardEntry[] = (data || []).map((profile: any, index: number) => ({
          rank: index + 1,
          email: profile.user?.email || '',
          name: `${profile.user?.first_name || ''} ${profile.user?.last_name || ''}`.trim() || profile.user?.username || 'Member',
          avatar: profile.user?.avatar,
          stagesCompleted: Math.min(Math.round(profile.reputation_score / 10), 7), // cap stages at 7 for visuals
          lastActivityAt: profile.updated_at || new Date().toISOString(),
          badgeType: 'founder',
          reputationScore: profile.reputation_score
        }));
        setEntries(mappedEntries);
      } catch (error) {
        console.error('Error loading leaderboard:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 30000); // 30 second poll for frontend feel
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="page-shell lx">
      <PageHero
        eyebrow="Virtual startup journey"
        title="Leaderboard"
        description="All users ranked by completed stages."
        backLink={{ label: "Home", to: "/" }}
        stats={[
          { value: String(entries.length), label: "Ranked users" },
          { value: "Live", label: "Refreshes every 30s" },
        ]}
      />

      <section className="lx-section">
        {loading ? (
          <div className="lx-loading">Loading leaderboard</div>
        ) : entries.length === 0 ? (
          <div className="lx-empty">
            <strong>No one ranked yet.</strong>
            <Link to="/journey" className="lx-textbtn">Start the journey ↗</Link>
          </div>
        ) : (
          <ol className="lb">
            {entries.map((entry) => (
              <li key={entry.email} className={`lb-row${entry.rank <= 3 ? " is-top" : ""}`}>
                <span className="lb-rank">{String(entry.rank).padStart(2, "0")}</span>
                <img
                  className="lb-avatar"
                  src={entry.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(entry.name)}&size=96&background=161614&color=f7f5ef`}
                  alt=""
                />
                <div className="lb-who">
                  <b>{entry.name}</b>
                  <span>{entry.email}</span>
                </div>
                <span className="lb-badge" style={{ color: achievementTier(entry.stagesCompleted) }}>
                  {getStageAchievementName(entry.stagesCompleted)}
                </span>
                <div className="lb-score">
                  <b>{entry.reputationScore?.toFixed(2) || "0"}</b>
                  <span>{getTimeAgo(entry.lastActivityAt)}</span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
};

export default Leaderboard;
