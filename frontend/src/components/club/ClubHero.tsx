import { clubInfo } from "@/data/clubInfo";
import { PageHero } from "@/components/design-system/PageHero";

interface ClubHeroProps {
  onExploreWings: () => void;
  onGetInvolved: () => void;
}

export function ClubHero({ onExploreWings, onGetInvolved }: ClubHeroProps) {
  const stats = [
    { value: `${clubInfo.totalMembers}+`, label: "Active members" },
    { value: `${clubInfo.totalStartups}+`, label: "Potential startups" },
    { value: clubInfo.totalFunding, label: "Funding raise target" },
    { value: clubInfo.outReach, label: "Members outreach" },
  ];

  return (
    <PageHero eyebrow="Club" title={clubInfo.name} description={clubInfo.tagline} stats={stats}>
      <div className="lx-gate-actions">
        <button type="button" className="lx-cta" onClick={onGetInvolved}>
          Get involved ↗
        </button>
        <button type="button" className="lx-textbtn" onClick={onExploreWings}>
          Explore the eight wings ↗
        </button>
      </div>
    </PageHero>
  );
}
