import { Link } from "react-router-dom";
import type { CSSProperties } from "react";
import { useUser } from "@/pages/UserContext";
import "@/components/design-system/listing.css";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Users, Trophy, Clock, ArrowRight, CheckCircle, Circle, PlayCircle } from "lucide-react";
import { startupPrograms, StartupProgram } from "@/data/startupPrograms";
import ExploreProblemsModal from "@/components/ExploreProblemsModal";
import { PageHero } from "@/components/design-system/PageHero";

const Programs = () => {
  const { user } = useUser();
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <PlayCircle className="h-4 w-4 text-green-600" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-blue-600" />;
      case 'planned':
        return <Circle className="h-4 w-4 text-orange-600" />;
      default:
        return <Circle className="h-4 w-4 text-gray-400" />;
    }
  };

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

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'challenge':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'internship':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'learning':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'networking':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'training':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'event':
        return 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300';
      case 'initiative':
        return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300';
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
