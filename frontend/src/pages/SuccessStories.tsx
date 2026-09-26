import type { CSSProperties } from "react";
import { useParams, Link } from "react-router-dom";
import { startupPrograms } from "@/data/startupPrograms";
import { getSuccessStoriesByProgram } from "@/data/successStories";
import SuccessStoryCard from "@/components/SuccessStoryCard";
import { PageHero } from "@/components/design-system/PageHero";
import "@/components/design-system/listing.css";

const SuccessStories = () => {
  const { programId } = useParams();
  const program = startupPrograms.find((p) => p.id === programId);

  if (!programId || !program) {
    return (
      <div className="page-shell lx">
        <div className="lx-section">
          <div className="lx-empty">
            <strong>Program not found</strong>
            <Link to="/programs" className="lx-cta">All programs ↗</Link>
          </div>
        </div>
      </div>
    );
  }

  const successStories = getSuccessStoriesByProgram(programId);
  const people = successStories.reduce((acc, s) => acc + s.participants.length, 0);

  return (
    <div className="page-shell lx" style={{ "--lx-accent": "var(--lime)" } as CSSProperties}>
      <PageHero
        eyebrow="Success stories"
        title="Success Stories"
        description={`${program.title}. What participants built, and what came of it.`}
        backLink={{ label: program.title, to: `/programs/${programId}` }}
        stats={[
          { value: String(successStories.length), label: successStories.length === 1 ? "Story" : "Stories" },
          { value: String(people), label: people === 1 ? "Participant" : "Participants" },
        ]}
      />

      <section className="lx-section">
        {successStories.length === 0 ? (
          <div className="lx-empty">
            <strong>No stories written up for this program yet</strong>
          </div>
        ) : (
          <div className="ss-features">
            {successStories.map((story) => (
              <SuccessStoryCard key={story.id} story={story} programId={programId} feature />
            ))}
          </div>
        )}

        <div className="lx-gate">
          <span>Your turn</span>
          <h2>Write the next <em>one.</em></h2>
          <p>Join {program.title} and become part of VNRVJIET's innovation ecosystem.</p>
          <div className="lx-gate-actions">
            <Link to={`/programs/${programId}`} className="lx-cta">About {program.title} ↗</Link>
            <Link to="/programs" className="lx-textbtn">All programs ↗</Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default SuccessStories;
