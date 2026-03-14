"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { Card } from "@/components/ui";
import {
  Tag,
  GitBranch,
  Plus,
  Trash2,
  Copy,
  Check,
  Clock,
  User,
  AlertCircle,
  Search,
  X,
  ChevronDown,
  Code,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface TagInfo {
  name: string;
  sha: string;
  message: string;
  tagger: string;
  tagger_email: string;
  date: string;
  is_annotated: boolean;
}

interface BranchInfo {
  name: string;
  commit_sha: string;
  is_default: boolean;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function timeAgo(dateStr: string): string {
  if (!dateStr) return "";
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
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function getAvatarColor(name: string): string {
  const colors = [
    "bg-brand-500", "bg-purple-500", "bg-pink-500", "bg-blue-500",
    "bg-green-500", "bg-amber-500", "bg-teal-500", "bg-indigo-500",
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

export default function TagsPage() {
  const params = useParams<{ orgSlug: string; projectSlug: string }>();
  const router = useRouter();
  const { currentOrg } = useAuthStore();

  const [tags, setTags] = useState<TagInfo[]>([]);
  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [copiedSha, setCopiedSha] = useState<string | null>(null);

  // Create tag form
  const [showCreate, setShowCreate] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagRef, setNewTagRef] = useState("main");
  const [newTagMessage, setNewTagMessage] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [refDropdown, setRefDropdown] = useState(false);
  const [refSearch, setRefSearch] = useState("");

  // Delete
  const [deleting, setDeleting] = useState<string | null>(null);

  const orgId = currentOrg?.slug === params.orgSlug ? currentOrg?.id : undefined;
  const projectSlug = params.projectSlug;

  const apiBase =
    typeof window !== "undefined"
      ? process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      : "http://localhost:8000";

  const getHeaders = (): Record<string, string> => {
    const token = typeof window !== "undefined" ? localStorage.getItem("mc_token") : null;
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (token) h["Authorization"] = `Bearer ${token}`;
    return h;
  };

  // Fetch tags
  const fetchTags = () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    fetch(`${apiBase}/api/v1/organizations/${orgId}/projects/${projectSlug}/code/tags`, {
      headers: getHeaders(),
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        setTags(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        setError("Could not load tags.");
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchTags();
  }, [orgId, projectSlug]);

  // Fetch branches for create form
  useEffect(() => {
    if (!orgId) return;
    fetch(`${apiBase}/api/v1/organizations/${orgId}/projects/${projectSlug}/code/branches`, {
      headers: getHeaders(),
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setBranches(Array.isArray(data) ? data : []))
      .catch(() => setBranches([]));
  }, [orgId, projectSlug]);

  // Filtered tags
  const filteredTags = useMemo(
    () =>
      tags.filter((t) =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.message.toLowerCase().includes(search.toLowerCase())
      ),
    [tags, search]
  );

  // Filtered branches for ref selector
  const filteredBranches = useMemo(
    () => branches.filter((b) => b.name.toLowerCase().includes(refSearch.toLowerCase())).slice(0, 10),
    [branches, refSearch]
  );

  const handleCopySha = (sha: string) => {
    navigator.clipboard.writeText(sha);
    setCopiedSha(sha);
    setTimeout(() => setCopiedSha(null), 2000);
  };

  const handleCreate = async () => {
    if (!orgId || !newTagName.trim() || !newTagRef.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch(
        `${apiBase}/api/v1/organizations/${orgId}/projects/${projectSlug}/code/tags`,
        {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({
            name: newTagName.trim(),
            ref: newTagRef.trim(),
            message: newTagMessage.trim(),
          }),
        }
      );
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to create tag");
      }
      setNewTagName("");
      setNewTagMessage("");
      setShowCreate(false);
      fetchTags();
    } catch (e: unknown) {
      setCreateError(e instanceof Error ? e.message : "Failed to create tag");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (name: string) => {
    if (!orgId) return;
    if (!confirm(`Delete tag "${name}"? This cannot be undone.`)) return;
    setDeleting(name);
    try {
      const res = await fetch(
        `${apiBase}/api/v1/organizations/${orgId}/projects/${projectSlug}/code/tags`,
        {
          method: "DELETE",
          headers: getHeaders(),
          body: JSON.stringify({ name }),
        }
      );
      if (!res.ok) throw new Error("Failed to delete tag");
      fetchTags();
    } catch {
      // silently fail
    } finally {
      setDeleting(null);
    }
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
          <Tag className="h-6 w-6 text-brand-400" />
          <h1 className="text-xl font-bold text-white">Tags</h1>
          <span className="text-sm text-surface-500">
            {tags.length} tag{tags.length !== 1 ? "s" : ""}
          </span>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-400 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New tag
        </button>
      </div>

      {/* Create tag form */}
      {showCreate && (
        <Card className="!p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Create a new tag</h3>
            <button onClick={() => setShowCreate(false)} className="text-surface-500 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Tag name */}
            <div>
              <label className="block text-xs text-surface-400 mb-1">Tag name</label>
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="v1.0.0"
                className="w-full px-3 py-2 rounded-lg border border-surface-600 bg-surface-900 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-brand-500/60"
              />
            </div>

            {/* Target ref */}
            <div>
              <label className="block text-xs text-surface-400 mb-1">Target</label>
              <div className="relative">
                <button
                  onClick={() => setRefDropdown(!refDropdown)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-surface-600 bg-surface-900 text-sm text-white hover:border-brand-500/60 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <GitBranch className="h-3.5 w-3.5 text-brand-400" />
                    {newTagRef}
                  </span>
                  <ChevronDown className="h-3 w-3 text-surface-400" />
                </button>
                {refDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setRefDropdown(false)} />
                    <div className="absolute top-full left-0 mt-1 z-50 w-full rounded-lg border border-surface-600 bg-surface-800 shadow-xl overflow-hidden">
                      <div className="p-2 border-b border-surface-700">
                        <input
                          type="text"
                          value={refSearch}
                          onChange={(e) => setRefSearch(e.target.value)}
                          placeholder="Filter branches..."
                          className="w-full px-2.5 py-1.5 rounded-md border border-surface-600 bg-surface-900 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-brand-500/60"
                          autoFocus
                        />
                      </div>
                      <div className="max-h-48 overflow-y-auto py-1">
                        {filteredBranches.map((b) => (
                          <button
                            key={b.name}
                            onClick={() => {
                              setNewTagRef(b.name);
                              setRefDropdown(false);
                              setRefSearch("");
                            }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-700 flex items-center gap-2 ${
                              b.name === newTagRef ? "text-brand-400 bg-surface-700/50" : "text-surface-200"
                            }`}
                          >
                            <GitBranch className="h-3.5 w-3.5" />
                            <span className="truncate">{b.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Message (optional — makes it annotated) */}
          <div>
            <label className="block text-xs text-surface-400 mb-1">
              Message <span className="text-surface-600">(optional — creates annotated tag)</span>
            </label>
            <textarea
              value={newTagMessage}
              onChange={(e) => setNewTagMessage(e.target.value)}
              placeholder="Release notes..."
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-surface-600 bg-surface-900 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-brand-500/60 resize-none"
            />
          </div>

          {createError && (
            <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {createError}
            </div>
          )}

          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={() => setShowCreate(false)}
              className="px-3 py-1.5 text-sm text-surface-400 hover:text-white rounded-lg hover:bg-surface-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={creating || !newTagName.trim()}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {creating ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <Tag className="h-4 w-4" />
              )}
              Create tag
            </button>
          </div>
        </Card>
      )}

      {/* Search */}
      {tags.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find a tag..."
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-surface-600 bg-surface-800 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-brand-500/60"
          />
        </div>
      )}

      {/* Content */}
      {loading ? (
        <Card className="!p-8">
          <div className="flex items-center justify-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />
            <span className="text-surface-400 text-sm">Loading tags...</span>
          </div>
        </Card>
      ) : error ? (
        <Card className="!p-8">
          <div className="flex flex-col items-center justify-center gap-3 text-center">
            <AlertCircle className="h-10 w-10 text-surface-500" />
            <p className="text-surface-400">{error}</p>
          </div>
        </Card>
      ) : filteredTags.length === 0 ? (
        <Card className="!p-8">
          <div className="flex flex-col items-center justify-center gap-3 text-center">
            <Tag className="h-10 w-10 text-surface-600" />
            <p className="text-surface-400">
              {tags.length === 0 ? "No tags yet." : "No tags match your search."}
            </p>
            {tags.length === 0 && (
              <p className="text-xs text-surface-600">
                Create a tag to mark a release or milestone.
              </p>
            )}
          </div>
        </Card>
      ) : (
        <Card className="!p-0 overflow-hidden divide-y divide-surface-700/50">
          {filteredTags.map((tag) => (
            <div
              key={tag.name}
              className="flex items-start gap-3 px-4 py-3 hover:bg-surface-800/50 transition-colors"
            >
              {/* Tag icon */}
              <div className="mt-0.5">
                <Tag className={`h-5 w-5 ${tag.is_annotated ? "text-brand-400" : "text-surface-500"}`} />
              </div>

              {/* Name + message + meta */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white">
                    {tag.name}
                  </span>
                  {tag.is_annotated && (
                    <span className="text-[10px] bg-brand-500/20 text-brand-400 px-1.5 py-0.5 rounded font-medium">
                      annotated
                    </span>
                  )}
                </div>
                {tag.message && (
                  <p className="text-xs text-surface-400 mt-0.5 truncate">
                    {tag.message}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-1 text-xs text-surface-500">
                  {tag.tagger && (
                    <span className="flex items-center gap-1">
                      <div
                        className={`h-4 w-4 rounded-full ${getAvatarColor(tag.tagger)} flex items-center justify-center text-white text-[8px] font-bold`}
                      >
                        {tag.tagger.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-surface-300">{tag.tagger}</span>
                    </span>
                  )}
                  {tag.date && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {timeAgo(tag.date)}
                    </span>
                  )}
                </div>
              </div>

              {/* Right side: Browse code + SHA + delete */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => router.push(`/org/${params.orgSlug}/projects/${params.projectSlug}/code?ref=${encodeURIComponent(tag.name)}`)}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-surface-600 bg-surface-800 hover:bg-surface-700 hover:border-brand-500/60 transition-colors text-xs text-surface-300 hover:text-white"
                  title="Browse code at this tag"
                >
                  <Code className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Browse code</span>
                </button>

                <button
                  onClick={() => router.push(`/org/${params.orgSlug}/projects/${params.projectSlug}/commits/${tag.sha}`)}
                  className="flex items-center gap-1 px-2 py-1 rounded-md border border-surface-600 bg-surface-800 hover:bg-surface-700 transition-colors group"
                  title="View commit"
                >
                  <code className="text-xs text-brand-400 font-mono">
                    {tag.sha.slice(0, 7)}
                  </code>
                </button>
                <button
                  onClick={() => handleCopySha(tag.sha)}
                  className="p-1 rounded-md border border-surface-600 bg-surface-800 hover:bg-surface-700 transition-colors"
                  title="Copy full SHA"
                >
                  {copiedSha === tag.sha ? (
                    <Check className="h-3 w-3 text-green-400" />
                  ) : (
                    <Copy className="h-3 w-3 text-surface-500 hover:text-surface-300" />
                  )}
                </button>

                <button
                  onClick={() => handleDelete(tag.name)}
                  disabled={deleting === tag.name}
                  className="p-1.5 rounded-md text-surface-500 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                  title="Delete tag"
                >
                  {deleting === tag.name ? (
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-red-400 border-t-transparent" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
