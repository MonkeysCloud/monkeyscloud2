"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";
import { Card } from "@/components/ui";
import {
  GitBranch,
  Search,
  Clock,
  Shield,
  ChevronRight,
  ChevronLeft,
  AlertCircle,
  Code2,
  ArrowUp,
  ArrowDown,
  Plus,
  SortAsc,
  User,
  GitPullRequest,
  X,
  Loader2,
  Check,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface BranchDetail {
  name: string;
  commit_sha: string;
  is_default: boolean;
  updated_at: string;
  ahead: number;
  behind: number;
  author_name: string;
  author_email: string;
}

type SortKey = "updated" | "name" | "author" | "ahead" | "behind";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const ITEMS_PER_PAGE = 20;

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function BranchesPage() {
  const params = useParams<{ orgSlug: string; projectSlug: string }>();
  const router = useRouter();
  const { currentOrg } = useAuthStore();

  const [branches, setBranches] = useState<BranchDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("updated");
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(1);
  const [showSortMenu, setShowSortMenu] = useState(false);

  // Create branch modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [sourceBranch, setSourceBranch] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const orgId = currentOrg?.slug === params.orgSlug ? currentOrg?.id : undefined;
  const projectSlug = params.projectSlug;

  // ---------- Fetch branches ----------
  const fetchBranches = useCallback(() => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    api
      .get<BranchDetail[]>(
        `/api/v1/organizations/${orgId}/projects/${projectSlug}/code/branches/detailed`
      )
      .then((data) => {
        setBranches(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        setError("Could not load branches. Make sure the Git server is running.");
        setLoading(false);
      });
  }, [orgId, projectSlug]);

  useEffect(() => { fetchBranches(); }, [fetchBranches]);

  // ---------- Filter & Sort ----------
  const processed = useMemo(() => {
    let list = [...branches];

    // Filter
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          b.author_name.toLowerCase().includes(q)
      );
    }

    // Sort
    list.sort((a, b) => {
      // Default branch always first
      if (a.is_default && !b.is_default) return -1;
      if (!a.is_default && b.is_default) return 1;

      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "author":
          cmp = a.author_name.localeCompare(b.author_name);
          break;
        case "ahead":
          cmp = a.ahead - b.ahead;
          break;
        case "behind":
          cmp = a.behind - b.behind;
          break;
        case "updated":
        default:
          cmp =
            new Date(b.updated_at).getTime() -
            new Date(a.updated_at).getTime();
          break;
      }
      return sortAsc ? -cmp : cmp;
    });

    return list;
  }, [branches, search, sortKey, sortAsc]);

  // ---------- Pagination ----------
  const totalPages = Math.max(1, Math.ceil(processed.length / ITEMS_PER_PAGE));
  const paginated = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    return processed.slice(start, start + ITEMS_PER_PAGE);
  }, [processed, page]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [search, sortKey, sortAsc]);

  const defaultBranch = branches.find((b) => b.is_default);

  // ---------- Navigation ----------
  const goToCode = useCallback(
    (branchName: string) => {
      const sp = new URLSearchParams();
      if (branchName !== "main") sp.set("ref", branchName);
      const qs = sp.toString();
      router.push(
        `/org/${params.orgSlug}/projects/${projectSlug}/code${qs ? `?${qs}` : ""}`
      );
    },
    [router, params.orgSlug, projectSlug]
  );

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
    setShowSortMenu(false);
  };

  // ---------- Create Branch ----------
  const openCreateModal = () => {
    setNewBranchName("");
    setSourceBranch(defaultBranch?.name || "main");
    setCreateError(null);
    setShowCreateModal(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleCreateBranch = async () => {
    if (!orgId || !newBranchName.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/organizations/${orgId}/projects/${projectSlug}/code/branches`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("mc_token")}`,
          },
          body: JSON.stringify({ name: newBranchName.trim(), source: sourceBranch }),
        }
      );
      if (res.ok) {
        setShowCreateModal(false);
        fetchBranches();
      } else {
        const data = await res.json().catch(() => null);
        setCreateError(data?.error || `Failed to create branch (HTTP ${res.status})`);
      }
    } catch {
      setCreateError("Could not reach the server.");
    }
    setCreating(false);
  };

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
            <GitBranch className="h-6 w-6 text-brand-400" />
            Branches
          </h1>
          <p className="text-sm text-surface-400 mt-1">
            {branches.length} branch{branches.length !== 1 ? "es" : ""}
            {defaultBranch && (
              <> · Default: <span className="text-brand-400">{defaultBranch.name}</span></>
            )}
          </p>
        </div>

        {/* Create Branch Button */}
        <button
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-400 transition-colors"
          onClick={openCreateModal}
        >
          <Plus className="h-4 w-4" />
          New branch
        </button>
      </div>

      {/* Search + Sort Bar */}
      {branches.length > 0 && (
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500" />
            <input
              type="text"
              placeholder="Filter by name or author..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-surface-600 bg-surface-800 text-sm text-white placeholder:text-surface-500 focus:outline-none focus:border-brand-500/60 focus:ring-1 focus:ring-brand-500/30 transition-all"
            />
          </div>

          {/* Sort Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-surface-600 bg-surface-800 text-sm text-surface-300 hover:border-brand-500/60 transition-colors"
            >
              <SortAsc className="h-4 w-4" />
              <span className="hidden sm:inline">
                {sortKey === "updated" ? "Date" : sortKey === "name" ? "Name" : sortKey === "author" ? "Author" : sortKey === "ahead" ? "Ahead" : "Behind"}
              </span>
              <ChevronRight className={`h-3 w-3 transition-transform ${showSortMenu ? "rotate-90" : ""}`} />
            </button>

            {showSortMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowSortMenu(false)} />
                <div className="absolute top-full right-0 mt-1 z-50 w-44 rounded-lg border border-surface-600 bg-surface-800 shadow-xl py-1">
                  <div className="px-3 py-1.5 text-xs font-semibold text-surface-500 uppercase tracking-wider">Sort by</div>
                  {([
                    ["updated", "Last updated", Clock],
                    ["name", "Name", SortAsc],
                    ["author", "Author", User],
                    ["ahead", "Ahead", ArrowUp],
                    ["behind", "Behind", ArrowDown],
                  ] as const).map(([key, label, Icon]) => (
                    <button
                      key={key}
                      onClick={() => handleSort(key as SortKey)}
                      className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-700 transition-colors flex items-center gap-2 ${
                        sortKey === key ? "text-brand-400" : "text-surface-300"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                      {sortKey === key && <span className="ml-auto text-xs">{sortAsc ? "↑" : "↓"}</span>}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <Card className="!p-8">
          <div className="flex items-center justify-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />
            <span className="text-surface-400 text-sm">Loading branches...</span>
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

      {/* Branches List */}
      {!loading && !error && paginated.length > 0 && (
        <Card className="!p-0 overflow-hidden">
          <div className="divide-y divide-surface-700/50">
            {paginated.map((branch) => (
              <BranchRow
                key={branch.name}
                branch={branch}
                defaultBranchName={defaultBranch?.name || "main"}
                onBrowse={() => goToCode(branch.name)}
              />
            ))}
          </div>
        </Card>
      )}

      {/* No branches */}
      {!loading && !error && branches.length === 0 && (
        <Card className="!p-0 overflow-hidden">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <GitBranch className="h-12 w-12 text-surface-600 mb-3" />
            <p className="text-surface-400 font-medium">No branches yet</p>
            <p className="text-xs text-surface-600 mt-1">
              Push code to this repository to create branches.
            </p>
          </div>
        </Card>
      )}

      {/* Search no results */}
      {!loading && !error && search && processed.length === 0 && branches.length > 0 && (
        <Card className="!p-6">
          <div className="flex flex-col items-center justify-center text-center">
            <Search className="h-8 w-8 text-surface-600 mb-2" />
            <p className="text-surface-400 text-sm">
              No branches matching &quot;{search}&quot;
            </p>
          </div>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-surface-500">
            Showing {(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, processed.length)} of {processed.length}
          </p>
          <div className="flex items-center gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
              className="p-1.5 rounded-md text-surface-400 hover:text-white hover:bg-surface-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
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
                    : "text-surface-400 hover:bg-surface-700 hover:text-white"
                }`}
              >
                {p}
              </button>
            ))}
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
              className="p-1.5 rounded-md text-surface-400 hover:text-white hover:bg-surface-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========== Create Branch Modal ========== */}
      {showCreateModal && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowCreateModal(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="bg-surface-800 border border-surface-600 rounded-xl shadow-2xl w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-surface-700">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <GitBranch className="h-5 w-5 text-brand-400" />
                  Create new branch
                </h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1 rounded-md text-surface-400 hover:text-white hover:bg-surface-700 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Body */}
              <div className="px-5 py-4 space-y-4">
                {/* Source branch — searchable dropdown */}
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-1.5">
                    Source branch
                  </label>
                  <BranchSearchDropdown
                    branches={branches}
                    selected={sourceBranch}
                    onSelect={setSourceBranch}
                  />
                  <p className="text-xs text-surface-500 mt-1">
                    The new branch will be based on this branch
                  </p>
                </div>

                {/* New branch name */}
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-1.5">
                    New branch name
                  </label>
                  <input
                    ref={inputRef}
                    type="text"
                    value={newBranchName}
                    onChange={(e) => setNewBranchName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newBranchName.trim()) {
                        handleCreateBranch();
                      }
                    }}
                    placeholder="e.g. feature/new-login"
                    className="w-full px-3 py-2 rounded-lg border border-surface-600 bg-surface-900 text-sm text-white placeholder:text-surface-500 focus:outline-none focus:border-brand-500/60 focus:ring-1 focus:ring-brand-500/30 transition-all"
                  />
                </div>

                {/* Error */}
                {createError && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {createError}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-surface-700">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg border border-surface-600 text-sm text-surface-300 hover:bg-surface-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateBranch}
                  disabled={!newBranchName.trim() || creating}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create branch
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  BranchRow                                                          */
/* ------------------------------------------------------------------ */

function BranchRow({
  branch,
  defaultBranchName,
  onBrowse,
}: {
  branch: BranchDetail;
  defaultBranchName: string;
  onBrowse: () => void;
}) {
  const params = useParams<{ orgSlug: string; projectSlug: string }>();
  const maxBar = Math.max(branch.ahead, branch.behind, 1);
  const aheadPct = Math.min((branch.ahead / Math.max(maxBar, 10)) * 100, 100);
  const behindPct = Math.min((branch.behind / Math.max(maxBar, 10)) * 100, 100);

  return (
    <div className="flex items-center w-full px-4 py-3.5 text-sm hover:bg-surface-800/60 transition-colors group">
      {/* Branch info */}
      <div className="flex flex-col items-start flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <GitBranch
            className={`h-4 w-4 shrink-0 ${
              branch.is_default ? "text-brand-400" : "text-surface-500"
            }`}
          />
          <button
            onClick={onBrowse}
            className={`font-medium truncate hover:underline ${
              branch.is_default
                ? "text-brand-400"
                : "text-surface-200 group-hover:text-white"
            } transition-colors`}
          >
            {branch.name}
          </button>
          {branch.is_default && (
            <span className="flex items-center gap-1 text-xs bg-brand-500/15 text-brand-400 px-2 py-0.5 rounded-full border border-brand-500/20 shrink-0">
              <Shield className="h-3 w-3" />
              default
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1 text-xs text-surface-500">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {timeAgo(branch.updated_at)}
          </span>
          {branch.author_name && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {branch.author_name}
            </span>
          )}
          <span
              className="font-mono text-surface-600 hover:text-brand-400 cursor-pointer transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                window.location.href = `/org/${params.orgSlug}/projects/${params.projectSlug}/commits/${branch.commit_sha}`;
              }}
            >
            {branch.commit_sha.slice(0, 7)}
          </span>
        </div>
      </div>

      {/* Ahead / Behind bars — only for non-default branches */}
      {!branch.is_default && (
        <div className="hidden sm:flex items-center gap-3 w-56 mx-4">
          {/* Behind bar (red, right to left) */}
          <div className="flex flex-col items-end w-1/2 gap-0.5">
            <div className="flex items-center gap-1 w-full justify-end">
              <div className="h-1.5 rounded-full bg-surface-700 w-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-red-400/70 float-right transition-all"
                  style={{ width: `${behindPct}%` }}
                />
              </div>
            </div>
            <span className="text-[10px] text-surface-500">
              {branch.behind} behind
            </span>
          </div>
          {/* Ahead bar (green, left to right) */}
          <div className="flex flex-col items-start w-1/2 gap-0.5">
            <div className="flex items-center gap-1 w-full">
              <div className="h-1.5 rounded-full bg-surface-700 w-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-green-400/70 transition-all"
                  style={{ width: `${aheadPct}%` }}
                />
              </div>
            </div>
            <span className="text-[10px] text-surface-500">
              {branch.ahead} ahead
            </span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0 ml-4">
        {!branch.is_default && (branch.ahead > 0 || branch.behind > 0) && (
          <span className="hidden md:flex items-center gap-1 text-xs text-surface-500 px-2 py-1 rounded border border-surface-700 bg-surface-800/50">
            <GitPullRequest className="h-3 w-3" />
            PR
          </span>
        )}
        <button
          onClick={onBrowse}
          className="flex items-center gap-1 text-xs text-surface-500 hover:text-brand-400 transition-colors px-2 py-1 rounded border border-surface-700 hover:border-brand-500/40 bg-surface-800/50"
        >
          <Code2 className="h-3.5 w-3.5" />
          Code
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  BranchSearchDropdown                                               */
/* ------------------------------------------------------------------ */

const MAX_SHOWN = 10;

function BranchSearchDropdown({
  branches,
  selected,
  onSelect,
}: {
  branches: BranchDetail[];
  selected: string;
  onSelect: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    const list = q
      ? branches.filter((b) => b.name.toLowerCase().includes(q))
      : branches;
    return list.slice(0, MAX_SHOWN);
  }, [branches, query]);

  const remaining = useMemo(() => {
    const q = query.toLowerCase().trim();
    const total = q
      ? branches.filter((b) => b.name.toLowerCase().includes(q)).length
      : branches.length;
    return Math.max(0, total - MAX_SHOWN);
  }, [branches, query]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Focus search when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open]);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-surface-600 bg-surface-900 text-sm text-white hover:border-brand-500/60 transition-all"
      >
        <span className="flex items-center gap-2 truncate">
          <GitBranch className="h-3.5 w-3.5 text-brand-400 shrink-0" />
          {selected}
        </span>
        <ChevronRight className={`h-3.5 w-3.5 text-surface-400 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 w-full rounded-lg border border-surface-600 bg-surface-800 shadow-xl overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-surface-700">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-500" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter branches..."
                className="w-full pl-8 pr-3 py-1.5 rounded-md border border-surface-600 bg-surface-900 text-xs text-white placeholder:text-surface-500 focus:outline-none focus:border-brand-500/60 transition-all"
              />
            </div>
          </div>

          {/* Branch list */}
          <div className="max-h-48 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-xs text-surface-500 text-center">
                No branches match &quot;{query}&quot;
              </div>
            )}
            {filtered.map((b) => (
              <button
                key={b.name}
                onClick={() => {
                  onSelect(b.name);
                  setOpen(false);
                }}
                className={`w-full text-left px-3 py-1.5 text-sm hover:bg-surface-700 transition-colors flex items-center gap-2 ${
                  b.name === selected
                    ? "text-brand-400 bg-surface-700/50"
                    : "text-surface-200"
                }`}
              >
                <GitBranch className="h-3 w-3 shrink-0" />
                <span className="truncate">{b.name}</span>
                {b.is_default && (
                  <span className="ml-auto text-[10px] bg-brand-500/20 text-brand-400 px-1.5 rounded shrink-0">
                    default
                  </span>
                )}
                {b.name === selected && (
                  <Check className="h-3 w-3 ml-auto text-brand-400 shrink-0" />
                )}
              </button>
            ))}
            {remaining > 0 && (
              <div className="px-3 py-1.5 text-[10px] text-surface-500 text-center border-t border-surface-700/50 mt-1">
                {remaining} more — type to filter
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
