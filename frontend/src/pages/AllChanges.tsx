import { useEffect, useState } from "react";
import { PageHero } from "@/components/design-system/PageHero";
import { Link } from "react-router-dom";
import { ArrowLeft, Timer, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { generateIdeaSlug } from "@/utils/slugUtils";

interface ChangeItem {
  _id: string;
  userName: string;
  userAvatar?: string;
  stageName: string;
  stageType: "problem" | "idea" | "startup";
  createdAt: string;
  ideaId?: string;
  ideaTitle?: string;
}

const getTimeAgo = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

  if (diffInMinutes < 60) {
    return `${Math.max(diffInMinutes, 1)}m ago`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours}h ago`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays}d ago`;
  }

  return `${Math.floor(diffInDays / 7)}w ago`;
};

const AllChanges = () => {
  const [changes, setChanges] = useState<ChangeItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAllChanges = async () => {
      try {
        const pageSize = 100;
        let skip = 0;
        let hasMore = true;
        const allChanges: ChangeItem[] = [];

        while (hasMore) {
          const response = await fetch(
            `${import.meta.env.VITE_API_BASE_URL}/notification-api/stage-notifications?limit=${pageSize}&skip=${skip}`
          );

          if (!response.ok) {
            throw new Error("Failed to fetch changes");
          }

          const data = await response.json();
          const pageData = data.notifications || [];

          allChanges.push(...pageData);
          hasMore = Boolean(data.hasMore);
          skip += pageData.length;

          if (pageData.length === 0) {
            hasMore = false;
          }
        }

        setChanges(allChanges);
      } catch (error) {
        console.error("Error fetching all changes:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAllChanges();
  }, []);

  return (
    <div className="page-shell">
      <PageHero
        eyebrow="Idea activity"
        title="Progress of Ideas"
        description="The complete history of idea stage unlocks across the platform."
        backLink={{ label: "Home", to: "/" }}
      />
      <div className="form-shell">
        <Card className="p-6 md:p-8">

          {loading ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">Loading all changes...</div>
          ) : changes.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">No stage changes available yet.</div>
          ) : (
            <div className="space-y-3">
              {changes.map((change) => {
                const ideaSlug = change.ideaId
                  ? generateIdeaSlug(change.ideaTitle || "idea", change.ideaId)
                  : null;

                const row = (
                  <div className={`flex items-center gap-3 p-4 rounded-lg ${
                    ideaSlug
                      ? "bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                      : "bg-gray-50 dark:bg-gray-800"
                  }`}>
                    <img
                      src={change.userAvatar || `https://ui-avatars.com/api/?name=${change.userName}&size=40`}
                      alt={change.userName}
                      className="w-10 h-10 rounded-full"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {change.userName}
                      </div>
                      <div className="text-xs text-gray-700 dark:text-gray-300 truncate">
                        Idea: {change.ideaTitle || "Journey Progress"}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        Completed "{change.stageName}" • {getTimeAgo(change.createdAt)}
                      </div>
                    </div>
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                      change.stageType === "problem"
                        ? "bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300"
                        : change.stageType === "idea"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                        : "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300"
                    }`}>
                      {change.stageType}
                    </div>
                    {ideaSlug && <ArrowRight className="w-4 h-4 text-gray-400" />}
                  </div>
                );

                if (!ideaSlug) {
                  return <div key={change.id || change._id}>{row}</div>;
                }

                return (
                  <Link
                    key={change.id || change._id}
                    to={`/ideas/${ideaSlug}`}
                    onClick={() => window.scrollTo({ top: 0, left: 0, behavior: "auto" })}
                    className="block"
                  >
                    {row}
                  </Link>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default AllChanges;
