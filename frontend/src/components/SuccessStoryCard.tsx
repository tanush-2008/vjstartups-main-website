import { Link } from "react-router-dom";
import { CardCover } from "@/components/design-system/CardCover";
import { SuccessStory, formatStoryDate } from "@/data/successStories";
import { usePdfAvailable } from "@/hooks/usePdfAvailable";

export default function SuccessStoryCard({ story, programId }: { story: SuccessStory; programId: string }) {
  const hasPage = story.contentType === "web" || story.contentType === "hybrid";
  const pdfLive = usePdfAvailable(story.pdfUrl);
  const cover = story.gallery?.find((media) => media.type === "image")?.url;
  const names = story.participants.map((p) => p.name.split(" ")[0]).join(", ");

  return (
    <article className="lx-card">
      {hasPage ? (
        <Link to={`/programs/${programId}/success-stories/${story.id}`} className="lx-card-link" aria-label={story.title} />
      ) : pdfLive ? (
        <a href={story.pdfUrl} target="_blank" rel="noopener noreferrer" className="lx-card-link" aria-label={story.title} />
      ) : null}
      <div className="lx-card-media">
        <CardCover title={story.title} image={cover} />
        <span className="lx-card-kicker">{story.season}{story.featured ? " / Featured" : ""}</span>
      </div>
      <div className="lx-card-body">
        <h3 className="lx-card-title">{story.title}</h3>
        <p className="lx-card-tagline">{story.subtitle}</p>
        {story.overview && <p className="lx-card-text">{story.overview}</p>}
        <div className="lx-card-meta">
          <span>{names} / {formatStoryDate(story.date)}</span>
          {hasPage ? <em>Read ↗</em> : pdfLive ? <em>Report ↗</em> : <span>Report pending</span>}
        </div>
      </div>
    </article>
  );
}
