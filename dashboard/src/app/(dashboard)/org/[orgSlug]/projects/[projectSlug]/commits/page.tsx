"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { Card } from "@/components/ui";
import {
  GitCommit,
  GitBranch,
  ChevronDown,
  Clock,
  User,
  Plus,
  Minus,
  FileText,
  Copy,
  Check,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CommitInfo {
  sha: string;
  message: string;
  author_name: string;
  author_email: string;
  committed_at: string;
  files_changed: number;
  additions: number;
  deletions: number;
}

interface BranchInfo {
  name: string;
  commit_sha: string;
  is_default: boolean;
  updated_at: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function timeAgo(dateStr: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / 1000
  );
  if (seconds < 60) return "just now";
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m} minute${m !== 1 ? "s" : ""} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h !== 1 ? "s" : ""} ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} day${d !== 1 ? "s" : ""} ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo} month${mo !== 1 ? "s" : ""} ago`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function groupByDate(
  commits: CommitInfo[]
): { date: string; commits: CommitInfo[] }[] {
  const groups: Record<string, CommitInfo[]> = {};
  for (const c of commits) {
    const day = new Date(c.committed_at).toISOString().split("T")[0];
    if (!groups[day]) groups[day] = [];
    groups[day].push(c);
  }
  return Object.entries(groups)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, commits]) => ({ date, commits }));
}

function getAvatarColor(name: string): string {
  const colors = [
    "bg-brand-500",
    "bg-purple-500",
    "bg-pink-500",
    "bg-blue-500",
    "bg-green-500",
    "bg-amber-500",
    "bg-teal-500",
    "bg-indigo-500",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  }
  return colors[Math.abs(hash) % colors.length];
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const PER_PAGE = 30;

export default function CommitsPage() {
  const params = useParams<{ orgSlug: string; projectSlug: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { currentOrg } = useAuthStore();

  const currentBranch = searchParams.get("branch") || "main";
  const currentPage = parseInt(searchParams.get("page") || "1", 10);

  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [branchOpen, setBranchOpen] = useState(false);
  const [branchSearch, setBranchSearch] = useState("");
  const [copiedSha, setCopiedSha] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const orgId = currentOrg?.slug === params.orgSlug ? currentOrg?.id : undefined;
  const projectSlug = params.projectSlug;

  const apiBase =
    typeof window !== "undefined"
      ? process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      : "http://localhost:8000";

  const filteredBranches = branches
    .filter((b) => b.name.toLowerCase().includes(branchSearch.toLowerCase()))
    .slice(0, 10);
  const totalMatches = branches.filter((b) =>
    b.name.toLowerCase().includes(branchSearch.toLowerCase())
  ).length;

  const navigate = useCallback(
    (branch: string, page: number) => {
      const sp = new URLSearchParams();
      if (branch !== "main") sp.set("branch", branch);
      if (page > 1) sp.set("page", String(page));
      const qs = sp.toString();
      router.push(
        `/org/${params.orgSlug}/projects/${projectSlug}/commits${qs ? `?${qs}` : ""}`
      );
    },
    [router, params.orgSlug, projectSlug]
  );

  // Fetch branches
  useEffect(() => {
    if (!orgId) return;
    const token = localStorage.getItem("mc_token");
    fetch(
      `${apiBase}/api/v1/organizations/${orgId}/projects/${projectSlug}/code/branches`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} }
    )
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setBranches(Array.isArray(data) ? data : []))
      .catch(() => setBranches([]));
  }, [orgId, projectSlug, apiBase]);

  // Fetch commits
  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    const token = localStorage.getItem("mc_token");

    const offset = (currentPage - 1) * PER_PAGE;
    fetch(
      `${apiBase}/api/v1/organizations/${orgId}/projects/${projectSlug}/code/commits?branch=${encodeURIComponent(currentBranch)}&limit=${PER_PAGE + 1}&offset=${offset}`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} }
    )
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch commits");
        return r.json();
      })
      .then((data: CommitInfo[]) => {
        if (data.length > PER_PAGE) {
          setHasMore(true);
          setCommits(data.slice(0, PER_PAGE));
        } else {
          setHasMore(false);
          setCommits(data);
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Could not load commits.");
        setLoading(false);
      });
  }, [orgId, projectSlug, currentBranch, currentPage, apiBase]);

  // Grouped commits by date
  const grouped = useMemo(() => groupByDate(commits), [commits]);

  const handleCopySha = (sha: string) => {
    navigator.clipboard.writeText(sha);
    setCopiedSha(sha);
    setTimeout(() => setCopiedSha(null), 2000);
  };

  if (!currentOrg) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <GitCommit className="h-6 w-6 text-brand-400" />
          <h1 className="text-xl font-bold text-white">Commits</h1>
        </div>

        {/* Branch selector */}
        <div className="relative">
          <button
            onClick={() => setBranchOpen(!branchOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-surface-600 bg-surface-800 text-sm text-white hover:border-brand-500/60 transition-colors"
          >
            <GitBranch className="h-4 w-4 text-brand-400" />
            <span className="font-medium">{currentBranch}</span>
            <ChevronDown className="h-3 w-3 text-surface-400" />
          </button>

          {branchOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setBranchOpen(false)}
              />
              <div className="absolute top-full right-0 mt-1 z-50 w-64 rounded-lg border border-surface-600 bg-surface-800 shadow-xl overflow-hidden">
                <div className="p-2 border-b border-surface-700">
                  <input
                    type="text"
                    value={branchSearch}
                    onChange={(e) => setBranchSearch(e.target.value)}
                    placeholder="Filter branches..."
                    className="w-full px-2.5 py-1.5 rounded-md border border-surface-600 bg-surface-900 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-brand-500/60"
                    autoFocus
                  />
                </div>
                <div className="max-h-64 overflow-y-auto py-1">
                  {filteredBranches.length === 0 && (
                    <div className="px-3 py-2 text-sm text-surface-500">
                      No branches match
                    </div>
                  )}
                  {filteredBranches.map((b) => (
                    <button
                      key={b.name}
                      onClick={() => {
                        navigate(b.name, 1);
                        setBranchOpen(false);
                        setBranchSearch("");
                      }}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-700 transition-colors flex items-center gap-2 ${
                        b.name === currentBranch
                          ? "text-brand-400 bg-surface-700/50"
                          : "text-surface-200"
                      }`}
                    >
                      <GitBranch className="h-3.5 w-3.5" />
                      <span className="truncate">{b.name}</span>
                      {b.is_default && (
                        <span className="ml-auto text-xs bg-brand-500/20 text-brand-400 px-1.5 rounded shrink-0">
                          default
                        </span>
                      )}
                    </button>
                  ))}
                  {totalMatches > 10 && (
                    <div className="px-3 py-1.5 text-xs text-surface-500 border-t border-surface-700">
                      {totalMatches - 10} more branch{totalMatches - 10 !== 1 ? "es" : ""}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <Card className="!p-8">
          <div className="flex items-center justify-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />
            <span className="text-surface-400 text-sm">Loading commits...</span>
          </div>
        </Card>
      ) : error ? (
        <Card className="!p-8">
          <div className="flex flex-col items-center justify-center gap-3 text-center">
            <AlertCircle className="h-10 w-10 text-surface-500" />
            <p className="text-surface-400">{error}</p>
          </div>
        </Card>
      ) : commits.length === 0 ? (
        <Card className="!p-8">
          <div className="flex flex-col items-center justify-center gap-3 text-center">
            <GitCommit className="h-10 w-10 text-surface-600" />
            <p className="text-surface-400">No commits on this branch.</p>
          </div>
        </Card>
      ) : (
        <>
          {/* Commit groups by date */}
          {grouped.map((group) => (
            <div key={group.date}>
              {/* Date header */}
              <div className="flex items-center gap-2 mb-2">
                <div className="h-px flex-1 bg-surface-700" />
                <span className="text-xs font-medium text-surface-400 px-2">
                  Commits on {formatDate(group.date)}
                </span>
                <div className="h-px flex-1 bg-surface-700" />
              </div>

              <Card className="!p-0 overflow-hidden divide-y divide-surface-700/50">
                {group.commits.map((commit) => (
                  <div
                    key={commit.sha}
                    onClick={() =>
                      router.push(
                        `/org/${params.orgSlug}/projects/${projectSlug}/commits/${commit.sha}`
                      )
                    }
                    className="flex items-start gap-3 px-4 py-3 hover:bg-surface-800/50 transition-colors cursor-pointer"
                  >
                    {/* Avatar */}
                    <div
                      className={`h-8 w-8 rounded-full ${getAvatarColor(commit.author_name)} flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5`}
                    >
                      {commit.author_name
                        .split(" ")
                        .map((w) => w[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>

                    {/* Message + author */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium leading-snug">
                        {commit.message.split("\n")[0]}
                      </p>
                      {commit.message.includes("\n") && (
                        <p className="text-xs text-surface-500 mt-0.5 truncate">
                          {commit.message.split("\n").slice(1).join(" ").trim()}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-xs text-surface-500">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          <span className="text-surface-300">
                            {commit.author_name}
                          </span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {timeAgo(commit.committed_at)}
                        </span>
                      </div>
                    </div>

                    {/* Right side: SHA + stats */}
                    <div className="flex items-center gap-3 shrink-0">
                      {/* Diff stats */}
                      {(commit.additions > 0 || commit.deletions > 0) && (
                        <div className="hidden sm:flex items-center gap-2 text-xs">
                          <span className="text-green-400 flex items-center gap-0.5">
                            <Plus className="h-3 w-3" />
                            {commit.additions.toLocaleString()}
                          </span>
                          <span className="text-red-400 flex items-center gap-0.5">
                            <Minus className="h-3 w-3" />
                            {commit.deletions.toLocaleString()}
                          </span>
                          {commit.files_changed > 0 && (
                            <span className="text-surface-500 flex items-center gap-0.5">
                              <FileText className="h-3 w-3" />
                              {commit.files_changed.toLocaleString()}
                            </span>
                          )}
                        </div>
                      )}

                      {/* SHA with copy */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleCopySha(commit.sha)}
                          className="flex items-center gap-1 px-2 py-1 rounded-md border border-surface-600 bg-surface-800 hover:bg-surface-700 transition-colors group"
                          title="Copy full SHA"
                        >
                          <code className="text-xs text-brand-400 font-mono">
                            {commit.sha.slice(0, 7)}
                          </code>
                          {copiedSha === commit.sha ? (
                            <Check className="h-3 w-3 text-green-400" />
                          ) : (
                            <Copy className="h-3 w-3 text-surface-500 group-hover:text-surface-300" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </Card>
            </div>
          ))}

          {/* Pagination */}
          {(currentPage > 1 || hasMore) && (
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => navigate(currentBranch, currentPage - 1)}
                disabled={currentPage <= 1}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-surface-600 text-sm text-surface-300 hover:bg-surface-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
                Newer
              </button>
              <span className="text-xs text-surface-500">
                Page {currentPage}
              </span>
              <button
                onClick={() => navigate(currentBranch, currentPage + 1)}
                disabled={!hasMore}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-surface-600 text-sm text-surface-300 hover:bg-surface-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Older
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
