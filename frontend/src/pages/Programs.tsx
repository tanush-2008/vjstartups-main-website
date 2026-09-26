import { Link } from "react-router-dom";
import type { CSSProperties } from "react";
import { useUser } from "@/pages/UserContext";
import "@/components/design-system/listing.css";
import { startupPrograms, StartupProgram } from "@/data/startupPrograms";
import { PageHero } from "@/components/design-system/PageHero";
import { ProgramStrip } from "@/components/design-system/HeroSignatures";

const Programs = () => {
  const { user } = useUser();
  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return 'Active';
      case 'completed':
        return 'Completed';
      case 'planned':
        return 'Planned';
      default:
        return 'Unknown';
    }
  };

  const groupedPrograms = startupPrograms.reduce((acc, program) => {
    if (!acc[program.category]) {
      acc[program.category] = [];
    }
    acc[program.category].push(program);
    return acc;
  }, {} as Record<string, StartupProgram[]>);

  const categoryTitles = {
    challenge: 'Challenges & Competitions',
    internship: 'Internships & Mentorship',
    learning: 'Learning & Development',
    networking: 'Networking & Community',
    training: 'Technical Training',
    event: 'Events & Workshops',
    initiative: 'Campus Initiatives'
  };

  return (
    <div className="page-shell lx" style={{ "--lx-accent": "var(--lime)" } as CSSProperties}>
      <PageHero
        eyebrow="Programs"
        title="VNRVJIET Startup Programs"
        description="Comprehensive ecosystem of programs, workshops, and initiatives designed to nurture student entrepreneurship."
        stats={[
          { value: String(startupPrograms.length), label: "Programs" },
          { value: "All students", label: "Welcome" },
          { value: "1 hour to 2 months", label: "Program duration" },
        ]}
        signature={
          <ProgramStrip
            items={startupPrograms.map((p) => ({ id: p.id, title: p.title, meta: p.duration, status: p.status }))}
          />
        }
      />

      <section className="lx-section">
        {Object.entries(groupedPrograms).map(([category, programs], sectionIndex) => (
          <div key={category} className="lx-block">
            <div className="lx-sec-head">
              <span>{String(sectionIndex + 1).padStart(2, "0")} / {programs.length} program{programs.length > 1 ? "s" : ""}</span>
              <h2>{categoryTitles[category as keyof typeof categoryTitles] || category}</h2>
            </div>
            <div className="lx-grid">
              {programs.map((program) => (
                <article key={program.id} className="lx-card">
                  <Link to={`/programs/${program.id}`} className="lx-card-link" aria-label={program.title} />
                  <div className="lx-card-body">
                    <div className="lx-card-status">
                      <span>{program.category}{program.edition ? ` / #${program.edition}` : ""}</span>
                      <b className={`is-${program.status}`}>{getStatusText(program.status)}</b>
                    </div>
                    <h3 className="lx-card-title">{program.title}</h3>
                    <p className="lx-card-tagline">{program.subtitle}</p>
                    <p className="lx-card-text">{program.shortDescription}</p>
                    <div className="lx-card-meta">
                      <span>{program.duration}</span>
                      <em>Details ↗</em>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        ))}

        <div className="lx-gate">
          <span>Your move</span>
          <h2>Ready to start <em>building?</em></h2>
          <p>Join the startup community and turn your ideas into something real.</p>
          <div className="lx-gate-actions">
            <a href="mailto:head.iie@vnrvjiet.in" className="lx-cta">Contact the innovation cell ↗</a>
            <Link to={user ? "/problems" : "/login"} className="lx-textbtn">Explore problems ↗</Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Programs;
