"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";
import { Card } from "@/components/ui";
import {
  GitPullRequest,
  GitMerge,
  Search,
  Plus,
  Clock,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  ArrowRight,
  GitBranch,
  User,
  FileText,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PullRequestSummary {
  id: number;
  number: number;
  title: string;
  description: string | null;
  source_branch: string;
  target_branch: string;
  author_id: number;
  author_name: string | null;
  status: "open" | "merged" | "closed" | "draft";
  is_draft: boolean;
  merged_at: string | null;
  closed_at: string | null;
  merge_strategy: string | null;
  additions: number | null;
  deletions: number | null;
  files_changed: number | null;
  created_at: string;
  updated_at: string;
}

type StatusFilter = "open" | "merged" | "closed" | "all";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function timeAgo(dateStr: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000
  );
  if (seconds < 60) return "just now";
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

const statusConfig: Record<
  string,
  { icon: typeof GitPullRequest; color: string; bg: string }
> = {
  open: { icon: GitPullRequest, color: "text-green-400", bg: "bg-green-500/15 border-green-500/20" },
  draft: { icon: GitPullRequest, color: "text-surface-400", bg: "bg-surface-500/15 border-surface-500/20" },
  merged: { icon: GitMerge, color: "text-purple-400", bg: "bg-purple-500/15 border-purple-500/20" },
  closed: { icon: X, color: "text-red-400", bg: "bg-red-500/15 border-red-500/20" },
};

const PER_PAGE = 20;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function PullRequestsPage() {
  const params = useParams<{ orgSlug: string; projectSlug: string }>();
  const router = useRouter();
  const { currentOrg } = useAuthStore();

  const [prs, setPrs] = useState<PullRequestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>("open");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const orgId = currentOrg?.id;
  const projectSlug = params.projectSlug;

  // ---------- Fetch ----------
  useEffect(() => {
    // Wait until currentOrg matches the URL slug
    if (!orgId || currentOrg?.slug !== params.orgSlug) return;
    setLoading(true);
    setError(null);
    const qs = filter !== "all" ? `?status=${filter}` : "";
    api
      .get<PullRequestSummary[]>(
        `/api/v1/organizations/${orgId}/projects/${projectSlug}/pull-requests${qs}`
      )
      .then((data) => {
        setPrs(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        setError("Could not load pull requests.");
        setLoading(false);
      });
  }, [orgId, currentOrg?.slug, params.orgSlug, projectSlug, filter]);

  // ---------- Filter & Paginate ----------
  const filtered = useMemo(() => {
    if (!search.trim()) return prs;
    const q = search.toLowerCase();
    return prs.filter(
      (pr) =>
        pr.title.toLowerCase().includes(q) ||
        pr.source_branch.toLowerCase().includes(q) ||
        pr.target_branch.toLowerCase().includes(q) ||
        `#${pr.number}`.includes(q) ||
        (pr.author_name && pr.author_name.toLowerCase().includes(q))
    );
  }, [prs, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  useEffect(() => setPage(1), [search, filter]);

  // ---------- Render ----------
  if (!currentOrg) {
    return (
      <div className="flex items-center justify-center h-64 text-surface-400">
        Loading organization...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
            <GitPullRequest className="h-6 w-6 text-brand-400" />
            Pull Requests
          </h1>
        </div>
        <button
          onClick={() =>
            router.push(
              `/org/${params.orgSlug}/projects/${projectSlug}/pull-requests/new`
            )
          }
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-400 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New pull request
        </button>
      </div>

      {/* Filters + Search bar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Status filter pills */}
        <div className="flex items-center gap-1.5">
          {(
            [
              ["open", "Open", GitPullRequest, "text-green-400", "bg-green-500/10 border-green-500/30 text-green-400"],
              ["merged", "Merged", GitMerge, "text-purple-400", "bg-purple-500/10 border-purple-500/30 text-purple-400"],
              ["closed", "Closed", X, "text-red-400", "bg-red-500/10 border-red-500/30 text-red-400"],
              ["all", "All", FileText, "text-surface-400", "bg-surface-500/10 border-surface-500/30 text-surface-300"],
            ] as const
          ).map(([key, label, Icon, iconColor, activeClasses]) => (
            <button
              key={key}
              onClick={() => setFilter(key as StatusFilter)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${
                filter === key
                  ? activeClasses
                  : "border-surface-700 text-surface-500 hover:text-surface-300 hover:border-surface-500"
              }`}
            >
              <Icon className={`h-3.5 w-3.5 ${filter === key ? iconColor : ""}`} />
              {label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500" />
          <input
            type="text"
            placeholder="Filter by title, branch, author, or #number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-surface-600 bg-surface-800 text-sm text-white placeholder:text-surface-500 focus:outline-none focus:border-brand-500/60 focus:ring-1 focus:ring-brand-500/30 transition-all"
          />
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <Card className="!p-8">
          <div className="flex items-center justify-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />
            <span className="text-surface-400 text-sm">
              Loading pull requests...
            </span>
          </div>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Card className="!p-8">
          <div className="flex flex-col items-center justify-center gap-3 text-center">
            <AlertCircle className="h-10 w-10 text-surface-500" />
            <p className="text-surface-400">{error}</p>
          </div>
        </Card>
      )}

      {/* PR List */}
      {!loading && !error && paginated.length > 0 && (
        <Card className="!p-0 overflow-hidden">
          <div className="divide-y divide-surface-700/50">
            {paginated.map((pr) => {
              const cfg = statusConfig[pr.status] || statusConfig.open;
              const StatusIcon = cfg.icon;
              return (
                <button
                  key={pr.id}
                  onClick={() =>
                    router.push(
                      `/org/${params.orgSlug}/projects/${projectSlug}/pull-requests/${pr.number}`
                    )
                  }
                  className="flex items-start w-full px-4 py-3.5 text-sm hover:bg-surface-800/60 transition-colors group text-left"
                >
                  <StatusIcon
                    className={`h-5 w-5 mt-0.5 shrink-0 mr-3 ${cfg.color}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-white group-hover:text-brand-400 transition-colors">
                        {pr.title}
                      </span>
                      <span className="text-xs text-surface-500">
                        #{pr.number}
                      </span>
                      {pr.is_draft && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-700 text-surface-400 border border-surface-600">
                          Draft
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-surface-500">
                      {pr.author_name && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          <span className="text-surface-400">{pr.author_name}</span>
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <GitBranch className="h-3 w-3" />
                        <span className="text-surface-400">
                          {pr.source_branch}
                        </span>
                        <ArrowRight className="h-3 w-3" />
                        <span>{pr.target_branch}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {pr.status === "merged" && pr.merged_at
                          ? `merged ${timeAgo(pr.merged_at)}`
                          : `opened ${timeAgo(pr.created_at)}`}
                      </span>
                      {pr.additions !== null && (
                        <span>
                          <span className="text-green-400">
                            +{pr.additions}
                          </span>{" "}
                          <span className="text-red-400">
                            -{pr.deletions}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-surface-600 group-hover:text-brand-400 shrink-0 mt-0.5 ml-2 transition-colors" />
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {/* Empty state */}
      {!loading && !error && prs.length === 0 && (
        <Card className="!p-0 overflow-hidden">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <GitPullRequest className="h-12 w-12 text-surface-600 mb-3" />
            <p className="text-surface-400 font-medium">
              No pull requests yet
            </p>
            <p className="text-xs text-surface-600 mt-1 mb-4">
              Create a pull request to propose changes and collaborate.
            </p>
            <button
              onClick={() =>
                router.push(
                  `/org/${params.orgSlug}/projects/${projectSlug}/pull-requests/new`
                )
              }
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-400 transition-colors"
            >
              <Plus className="h-4 w-4" />
              New pull request
            </button>
          </div>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-surface-500">
            Showing {(page - 1) * PER_PAGE + 1}–
            {Math.min(page * PER_PAGE, filtered.length)} of {filtered.length}
          </p>
          <div className="flex items-center gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="p-1.5 rounded-md text-surface-400 hover:text-white hover:bg-surface-700 transition-colors disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`h-8 w-8 rounded-md text-xs font-medium transition-colors ${
                  p === page
                    ? "bg-brand-500 text-white"
                    : "text-surface-400 hover:bg-surface-700"
                }`}
              >
                {p}
              </button>
            ))}
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="p-1.5 rounded-md text-surface-400 hover:text-white hover:bg-surface-700 transition-colors disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
