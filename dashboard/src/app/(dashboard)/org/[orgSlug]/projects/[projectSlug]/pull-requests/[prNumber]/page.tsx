"use client";

import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { Card } from "@/components/ui";
import { usePrUpdates, PrUpdate } from "@/lib/socket";
import dynamic from "next/dynamic";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
const RichTextEditor = dynamic(() => import("@/components/ui/RichTextEditor"), { ssr: false });
import {
  GitPullRequest,
  GitMerge,
  GitBranch,
  ArrowRight,
  Clock,
  AlertCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  X,
  FileText,
  FileCode,
  FilePlus,
  FileX,
  FilePen,
  MessageSquare,
  Plus,
  Minus,
  Check,
  ArrowLeft,
  Columns2,
  Rows3,
  Folder,
  FolderOpen,
  RefreshCw,
  Send,
  Pencil,
  GitCommitHorizontal,
  History,
  Save,
  ExternalLink,
  Shield,
  Eye,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

// Dynamic import to avoid SSR issues
const ReactDiffViewer = dynamic(() => import("react-diff-viewer-continued"), {
  ssr: false,
  loading: () => (
    <div className="p-4 text-surface-500 text-xs">Loading diff viewer...</div>
  ),
});

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface PullRequestDetail {
  id: number;
  number: number;
  title: string;
  description: string | null;
  source_branch: string;
  target_branch: string;
  author_id: number;
  status: "open" | "merged" | "closed" | "draft";
  is_draft: boolean;
  merged_by: number | null;
  merged_at: string | null;
  closed_at: string | null;
  merge_commit_sha: string | null;
  merge_strategy: string | null;
  additions: number | null;
  deletions: number | null;
  files_changed: number | null;
  review_count: number;
  approval_count: number;
  comments_count: number;
  created_at: string;
  updated_at: string;
}

interface CommitInfo {
  sha: string;
  message: string;
  author_name: string;
  author_email: string;
  committed_at: string;
  files_changed?: number;
  additions?: number;
  deletions?: number;
}

interface DiffLine {
  type: "add" | "remove" | "context" | "hunk";
  content: string;
  oldLineNum?: number;
  newLineNum?: number;
}

interface FileDiff {
  path: string;
  additions: number;
  deletions: number;
  oldValue: string;
  newValue: string;
  rawLines: DiffLine[];
}

interface PrCommentData {
  id: number;
  pull_request_id: number;
  user_id: number | null;
  user_name: string | null;
  is_ai: boolean;
  body: string;
  file_path: string | null;
  line_number: number | null;
  side: "left" | "right" | null;
  parent_id: number | null;
  commit_sha: string | null;
  is_resolved: boolean;
  resolved_by: number | null;
  resolved_by_name: string | null;
  comment_type: "comment" | "change_request";
  created_at: string;
  updated_at: string;
}

interface ActivityData {
  id: number;
  pull_request_id: number;
  user_id: number | null;
  user_name: string | null;
  action: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

interface ReviewData {
  id: number;
  pull_request_id: number;
  reviewer_id: number | null;
  reviewer_name: string | null;
  status: "approved" | "changes_requested" | "commented";
  body: string | null;
  is_ai: boolean;
  created_at: string;
}

/** Helper to display a comment author name */
function commentAuthor(c: PrCommentData): string {
  if (c.is_ai) return "AI Review";
  if (c.user_name) return c.user_name;
  if (c.user_id) return `User #${c.user_id}`;
  return "Anonymous";
}
function commentInitials(c: PrCommentData): string {
  if (c.is_ai) return "AI";
  if (c.user_name) return c.user_name.charAt(0).toUpperCase();
  if (c.user_id) return "U";
  return "?";
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

function parseDiffByFile(rawDiff: string): FileDiff[] {
  if (!rawDiff) return [];
  const fileDiffs: FileDiff[] = [];
  const fileChunks = rawDiff.split(/^diff --git /m).filter(Boolean);

  for (const chunk of fileChunks) {
    const lines = chunk.split("\n");
    const headerMatch = lines[0]?.match(/ b\/(.+)$/);
    if (!headerMatch) continue;
    const path = headerMatch[1];

    const oldLines: string[] = [];
    const newLines: string[] = [];
    const rawParsedLines: DiffLine[] = [];
    let inHunk = false;
    let additions = 0;
    let deletions = 0;
    let oldLineNum = 0;
    let newLineNum = 0;

    for (const line of lines) {
      if (
        line.startsWith("index ") ||
        line.startsWith("new file") ||
        line.startsWith("deleted file") ||
        line.startsWith("similarity") ||
        line.startsWith("rename from") ||
        line.startsWith("rename to") ||
        line.startsWith("---") ||
        line.startsWith("+++")
      )
        continue;

      if (line.startsWith("@@")) {
        inHunk = true;
        // Parse @@ -oldStart,oldLen +newStart,newLen @@
        const hunkMatch = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)/);
        if (hunkMatch) {
          oldLineNum = parseInt(hunkMatch[1], 10);
          newLineNum = parseInt(hunkMatch[2], 10);
        }
        rawParsedLines.push({ type: "hunk", content: line });
        continue;
      }
      if (!inHunk) continue;

      if (line.startsWith("+")) {
        const content = line.substring(1);
        newLines.push(content);
        additions++;
        rawParsedLines.push({ type: "add", content, newLineNum });
        newLineNum++;
      } else if (line.startsWith("-")) {
        const content = line.substring(1);
        oldLines.push(content);
        deletions++;
        rawParsedLines.push({ type: "remove", content, oldLineNum });
        oldLineNum++;
      } else {
        const content = line.startsWith(" ") ? line.substring(1) : line;
        oldLines.push(content);
        newLines.push(content);
        rawParsedLines.push({ type: "context", content, oldLineNum, newLineNum });
        oldLineNum++;
        newLineNum++;
      }
    }

    fileDiffs.push({
      path,
      additions,
      deletions,
      oldValue: oldLines.join("\n"),
      newValue: newLines.join("\n"),
      rawLines: rawParsedLines,
    });
  }
  return fileDiffs;
}

/* ------------------------------------------------------------------ */
/*  Diff viewer dark theme                                             */
/* ------------------------------------------------------------------ */

const diffStyles = {
  variables: {
    dark: {
      diffViewerBackground: "rgb(13, 17, 23)",
      diffViewerColor: "rgb(201, 209, 217)",
      addedBackground: "rgba(46, 160, 67, 0.15)",
      addedColor: "#7ee787",
      removedBackground: "rgba(248, 81, 73, 0.15)",
      removedColor: "#ffa198",
      wordAddedBackground: "rgba(46, 160, 67, 0.40)",
      wordRemovedBackground: "rgba(248, 81, 73, 0.40)",
      addedGutterBackground: "rgba(46, 160, 67, 0.20)",
      removedGutterBackground: "rgba(248, 81, 73, 0.20)",
      gutterBackground: "rgb(13, 17, 23)",
      gutterBackgroundDark: "rgb(13, 17, 23)",
      highlightBackground: "rgba(56, 139, 253, 0.15)",
      highlightGutterBackground: "rgba(56, 139, 253, 0.20)",
      codeFoldGutterBackground: "rgb(22, 27, 34)",
      codeFoldBackground: "rgb(22, 27, 34)",
      emptyLineBackground: "rgb(13, 17, 23)",
      gutterColor: "rgb(110, 118, 129)",
      addedGutterColor: "#7ee787",
      removedGutterColor: "#ffa198",
      codeFoldContentColor: "rgb(139, 148, 158)",
      diffViewerTitleBackground: "rgb(22, 27, 34)",
      diffViewerTitleColor: "rgb(201, 209, 217)",
      diffViewerTitleBorderColor: "rgb(48, 54, 61)",
    },
  },
  line: {
    padding: "2px 10px",
    fontSize: "12px",
    fontFamily:
      'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
  },
  gutter: {
    padding: "0 10px",
    fontSize: "12px",
    minWidth: "40px",
    cursor: "pointer",
  },
  contentText: {
    fontFamily:
      'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
    fontSize: "12px",
    lineHeight: "20px",
  },
};

/* ------------------------------------------------------------------ */
/*  Status styles                                                      */
/* ------------------------------------------------------------------ */

const statusStyles: Record<
  string,
  { label: string; icon: typeof GitPullRequest; color: string; bg: string }
> = {
  open: {
    label: "Open",
    icon: GitPullRequest,
    color: "text-green-400",
    bg: "bg-green-500/15 border-green-500/20",
  },
  draft: {
    label: "Draft",
    icon: GitPullRequest,
    color: "text-surface-400",
    bg: "bg-surface-500/15 border-surface-500/20",
  },
  merged: {
    label: "Merged",
    icon: GitMerge,
    color: "text-purple-400",
    bg: "bg-purple-500/15 border-purple-500/20",
  },
  closed: {
    label: "Closed",
    icon: X,
    color: "text-red-400",
    bg: "bg-red-500/15 border-red-500/20",
  },
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function PullRequestDetailPage() {
  const params = useParams<{
    orgSlug: string;
    projectSlug: string;
    prNumber: string;
  }>();
  const router = useRouter();
  const { currentOrg } = useAuthStore();

  const [pr, setPr] = useState<PullRequestDetail | null>(null);
  const [diff, setDiff] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [loadingDiff, setLoadingDiff] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"conversation" | "files" | "commits">("conversation");
  const [merging, setMerging] = useState(false);
  const [closing, setClosing] = useState(false);
  const [showMergeMenu, setShowMergeMenu] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Per-file diff state
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [splitView, setSplitView] = useState(false);
  const fileRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Comment state
  const [comments, setComments] = useState<PrCommentData[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  // Real-time banner state
  const [banner, setBanner] = useState<{ type: string; message: string } | null>(null);

  // Inline comment state
  const [inlineCommentTarget, setInlineCommentTarget] = useState<{ file: string; line: number } | null>(null);
  const [inlineCommentBody, setInlineCommentBody] = useState("");
  const [submittingInline, setSubmittingInline] = useState(false);

  // Reply state
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);

  // Editable title/description state
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editingDesc, setEditingDesc] = useState(false);
  const [editDesc, setEditDesc] = useState("");
  const [savingPr, setSavingPr] = useState(false);

  // Commits state
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [loadingCommits, setLoadingCommits] = useState(false);

  // Activities & Reviews state
  const [activities, setActivities] = useState<ActivityData[]>([]);
  const [reviews, setReviews] = useState<ReviewData[]>([]);
  const [showReviewMenu, setShowReviewMenu] = useState(false);
  const [reviewBody, setReviewBody] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [togglingDraft, setTogglingDraft] = useState(false);

  const orgId = currentOrg?.id;
  const projectSlug = params.projectSlug;
  const prNumber = params.prNumber;
  const orgSlug = params.orgSlug;
  const prWatchKey = orgSlug && projectSlug ? `${orgSlug}/${projectSlug}` : undefined;

  const apiBase = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/organizations/${orgId}/projects/${projectSlug}/pull-requests/${prNumber}`;

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${typeof window !== "undefined" ? localStorage.getItem("mc_token") : ""}`,
  };

  // Fetch PR details
  const fetchPr = useCallback(() => {
    if (!orgId) return;
    fetch(apiBase, { headers })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setPr(data);
        setLoading(false);
      })
      .catch(() => {
        setError("Could not load pull request.");
        setLoading(false);
      });
  }, [orgId, apiBase]);

  // Fetch diff
  const fetchDiff = useCallback(() => {
    if (!orgId) return;
    setLoadingDiff(true);
    fetch(`${apiBase}/diff`, { headers })
      .then((r) => (r.ok ? r.text() : ""))
      .then((text) => {
        setDiff(text);
        setLoadingDiff(false);
      })
      .catch(() => setLoadingDiff(false));
  }, [orgId, apiBase]);

  // Fetch activities
  const fetchActivities = useCallback(() => {
    if (!orgId) return;
    fetch(`${apiBase}/activities`, { headers })
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setActivities(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [orgId, apiBase]);

  // Fetch reviews
  const fetchReviews = useCallback(() => {
    if (!orgId) return;
    fetch(`${apiBase}/reviews`, { headers })
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setReviews(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [orgId, apiBase]);

  useEffect(() => {
    fetchPr();
    fetchDiff();
    fetchComments();
    fetchCommits();
    fetchActivities();
    fetchReviews();
  }, [fetchPr, fetchDiff]);

  // Fetch commits
  const fetchCommits = useCallback(() => {
    if (!orgId) return;
    setLoadingCommits(true);
    fetch(`${apiBase}/commits`, { headers })
      .then((r) => r.ok ? r.json() : [])
      .then((data) => {
        setCommits(Array.isArray(data) ? data : []);
        setLoadingCommits(false);
      })
      .catch(() => setLoadingCommits(false));
  }, [orgId, apiBase]);

  // Fetch comments
  const fetchComments = useCallback(() => {
    if (!orgId) return;
    setLoadingComments(true);
    fetch(`${apiBase}/comments`, { headers })
      .then((r) => r.ok ? r.json() : [])
      .then((data) => {
        setComments(Array.isArray(data) ? data : []);
        setLoadingComments(false);
      })
      .catch(() => setLoadingComments(false));
  }, [orgId, apiBase]);

  // Submit a general comment
  const submitComment = useCallback(async () => {
    if (!newComment.trim() || submittingComment) return;
    setSubmittingComment(true);
    try {
      const res = await fetch(`${apiBase}/comments`, {
        method: "POST",
        headers,
        body: JSON.stringify({ body: newComment }),
      });
      if (res.ok) {
        const comment = await res.json();
        setComments((prev) => [...prev, comment]);
        setNewComment("");
      }
    } catch {}
    setSubmittingComment(false);
  }, [newComment, apiBase, submittingComment]);

  // Submit an inline line comment
  const submitInlineComment = useCallback(async () => {
    if (!inlineCommentTarget || !inlineCommentBody.trim() || submittingInline) return;
    setSubmittingInline(true);
    try {
      const headSha = commits.length > 0 ? commits[0].sha : null;
      const res = await fetch(`${apiBase}/comments`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          body: inlineCommentBody,
          file_path: inlineCommentTarget.file,
          line_number: inlineCommentTarget.line,
          side: "right",
          commit_sha: headSha,
        }),
      });
      if (res.ok) {
        const comment = await res.json();
        setComments((prev) => [...prev, comment]);
        setInlineCommentBody("");
        setInlineCommentTarget(null);
      }
    } catch {}
    setSubmittingInline(false);
  }, [inlineCommentTarget, inlineCommentBody, apiBase, submittingInline, commits]);

  // Submit a reply to an existing comment
  const submitReply = useCallback(async (parentId: number) => {
    if (!replyBody.trim() || submittingReply) return;
    setSubmittingReply(true);
    try {
      // Find parent to inherit file_path/line_number
      const parent = comments.find((c) => c.id === parentId);
      const res = await fetch(`${apiBase}/comments`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          body: replyBody,
          parent_id: parentId,
          file_path: parent?.file_path || null,
          line_number: parent?.line_number || null,
          side: parent?.side || null,
        }),
      });
      if (res.ok) {
        const reply = await res.json();
        setComments((prev) => [...prev, reply]);
        setReplyBody("");
        setReplyingTo(null);
      }
    } catch {}
    setSubmittingReply(false);
  }, [replyBody, submittingReply, apiBase, comments]);

  // Save title/description
  const savePr = useCallback(async (fields: { title?: string; description?: string }) => {
    setSavingPr(true);
    try {
      const res = await fetch(apiBase, {
        method: "PUT",
        headers,
        body: JSON.stringify(fields),
      });
      if (res.ok) {
        const updated = await res.json();
        setPr(updated);
        setEditingTitle(false);
        setEditingDesc(false);
        fetchActivities(); // refetch to show the change in conversation
      }
    } catch {}
    setSavingPr(false);
  }, [apiBase, fetchActivities]);

  // Resolve a comment
  const resolveComment = useCallback(async (commentId: number) => {
    try {
      const res = await fetch(`${apiBase}/comments/${commentId}/resolve`, {
        method: "PUT",
        headers,
      });
      if (res.ok) {
        const updated = await res.json();
        setComments((prev) => prev.map((c) => (c.id === commentId ? updated : c)));
      }
    } catch {}
  }, [apiBase]);

  // Toggle draft mode
  const toggleDraft = useCallback(async () => {
    if (!pr || togglingDraft) return;
    setTogglingDraft(true);
    try {
      const res = await fetch(apiBase, {
        method: "PUT",
        headers,
        body: JSON.stringify({ is_draft: !pr.is_draft }),
      });
      if (res.ok) {
        const updated = await res.json();
        setPr(updated);
        fetchActivities();
      }
    } catch {}
    setTogglingDraft(false);
  }, [pr, apiBase, togglingDraft, fetchActivities]);

  // Submit a review
  const submitReview = useCallback(async (status: "approved" | "changes_requested" | "commented") => {
    if (submittingReview) return;
    setSubmittingReview(true);
    try {
      const res = await fetch(`${apiBase}/reviews`, {
        method: "POST",
        headers,
        body: JSON.stringify({ status, body: reviewBody.trim() || null }),
      });
      if (res.ok) {
        setReviewBody("");
        setShowReviewMenu(false);
        fetchReviews();
        fetchActivities();
        fetchPr(); // refresh counters
      }
    } catch {}
    setSubmittingReview(false);
  }, [apiBase, reviewBody, submittingReview, fetchReviews, fetchActivities, fetchPr]);

  // WebSocket: listen for PR events
  usePrUpdates(useCallback((event: PrUpdate) => {
    // Match this PR's project and branches
    if (!pr) return;
    const matchesBranch = event.branch === pr.source_branch || event.branch === pr.target_branch;
    const matchesPrNumber = event.prNumber === pr.number;

    if (event.action === "push" && matchesBranch) {
      setBanner({
        type: "push",
        message: `New commits pushed to ${event.branch} — click to refresh`,
      });
    } else if (event.action === "merged" && matchesPrNumber) {
      setBanner({ type: "merged", message: "This pull request has been merged" });
      fetchPr();
    } else if (event.action === "closed" && matchesPrNumber) {
      setBanner({ type: "closed", message: "This pull request has been closed" });
      fetchPr();
    } else if (event.action === "updated" && matchesPrNumber) {
      setBanner({
        type: "push",
        message: "This pull request has been updated — click to refresh",
      });
    } else if (event.action === "review_submitted" && matchesPrNumber) {
      setBanner({
        type: "push",
        message: "A new review has been submitted — click to refresh",
      });
    } else if (event.action === "comment" && matchesPrNumber && event.comment) {
      setComments((prev) => {
        const exists = prev.some((c) => c.id === (event.comment as any)?.id);
        if (exists) return prev;
        return [...prev, event.comment as unknown as PrCommentData];
      });
    }
  }, [pr]), prWatchKey);

  // Parse diff into per-file chunks
  const fileDiffs = useMemo(() => parseDiffByFile(diff), [diff]);
  const totalAdditions = fileDiffs.reduce((s, f) => s + f.additions, 0);
  const totalDeletions = fileDiffs.reduce((s, f) => s + f.deletions, 0);

  // Expand first file when diff loads
  useEffect(() => {
    if (fileDiffs.length > 0 && expandedFiles.size === 0) {
      setExpandedFiles(new Set([fileDiffs[0].path]));
      setActiveFile(fileDiffs[0].path);
    }
  }, [fileDiffs]);

  const navigateToFile = useCallback((path: string) => {
    setExpandedFiles((prev) => new Set(prev).add(path));
    setActiveFile(path);
    setTimeout(() => {
      fileRefs.current[path]?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
  }, []);

  const toggleFile = useCallback((path: string) => {
    setExpandedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
    setActiveFile(path);
  }, []);

  // Merge handler
  const handleMerge = async (strategy: string) => {
    setMerging(true);
    setActionError(null);
    setShowMergeMenu(false);
    try {
      const res = await fetch(`${apiBase}/merge`, {
        method: "POST",
        headers,
        body: JSON.stringify({ strategy }),
      });
      if (res.ok) {
        fetchPr();
        fetchDiff();
      } else {
        const data = await res.json().catch(() => null);
        setActionError(data?.error || "Merge failed.");
      }
    } catch {
      setActionError("Could not reach the server.");
    }
    setMerging(false);
  };

  // Close handler
  const handleClose = async () => {
    setClosing(true);
    setActionError(null);
    try {
      const res = await fetch(`${apiBase}/close`, {
        method: "POST",
        headers,
      });
      if (res.ok) fetchPr();
      else {
        const data = await res.json().catch(() => null);
        setActionError(data?.error || "Close failed.");
      }
    } catch {
      setActionError("Could not reach the server.");
    }
    setClosing(false);
  };

  if (!currentOrg || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />
      </div>
    );
  }

  if (error || !pr) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertCircle className="h-10 w-10 text-surface-500" />
        <p className="text-surface-400">{error || "Pull request not found."}</p>
      </div>
    );
  }

  const status = statusStyles[pr.status] || statusStyles.open;
  const StatusIcon = status.icon;
  const isActionable = pr.status === "open" || pr.status === "draft";

  return (
    <div className="space-y-5">
      {/* Back button */}
      <button
        onClick={() =>
          router.push(
            `/org/${params.orgSlug}/projects/${projectSlug}/pull-requests`
          )
        }
        className="flex items-center gap-1 text-sm text-surface-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        All pull requests
      </button>

      {/* PR Header */}
      <div>
        <div className="flex items-start gap-3">
          <StatusIcon className={`h-6 w-6 mt-0.5 ${status.color}`} />
          <div className="flex-1">
            {/* Editable title */}
            {editingTitle && isActionable ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && editTitle.trim()) savePr({ title: editTitle.trim() });
                    if (e.key === "Escape") setEditingTitle(false);
                  }}
                  className="flex-1 text-2xl font-bold bg-surface-800 border border-surface-600 rounded-lg px-3 py-1 text-white focus:outline-none focus:border-brand-400"
                />
                <button
                  onClick={() => editTitle.trim() && savePr({ title: editTitle.trim() })}
                  disabled={savingPr}
                  className="p-2 rounded-lg bg-brand-500 hover:bg-brand-400 text-white transition-colors disabled:opacity-50"
                >
                  {savingPr ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                </button>
                <button
                  onClick={() => setEditingTitle(false)}
                  className="p-2 rounded-lg text-surface-400 hover:text-white hover:bg-surface-700 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <h1
                className={`text-2xl font-bold text-white group ${isActionable ? "cursor-pointer" : ""}`}
                onClick={() => {
                  if (isActionable) {
                    setEditTitle(pr.title);
                    setEditingTitle(true);
                  }
                }}
              >
                {pr.title}
                <span className="text-surface-500 font-normal ml-2">#{pr.number}</span>
                {isActionable && (
                  <Pencil className="inline-block h-4 w-4 ml-2 text-surface-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </h1>
            )}
            <div className="flex items-center gap-3 mt-2 text-sm text-surface-400 flex-wrap">
              <span
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${status.bg} ${status.color}`}
              >
                <StatusIcon className="h-3 w-3" />
                {status.label}
              </span>
              {pr.is_draft && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 text-xs font-medium">
                  <Pencil className="h-3 w-3" />
                  Draft
                </span>
              )}
              <span className="flex items-center gap-1">
                <GitBranch className="h-3.5 w-3.5" />
                <span className="text-surface-200 font-medium">
                  {pr.source_branch}
                </span>
                <ArrowRight className="h-3 w-3" />
                <span>{pr.target_branch}</span>
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {pr.status === "merged" && pr.merged_at
                  ? `merged ${timeAgo(pr.merged_at)}`
                  : `opened ${timeAgo(pr.created_at)}`}
              </span>
            </div>
          </div>
        </div>

        {/* Editable description */}
        {editingDesc && isActionable ? (
          <Card className="!p-4 mt-4">
            <RichTextEditor
              content={editDesc}
              onChange={(html) => setEditDesc(html)}
              placeholder="Write a description..."
            />
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={() => savePr({ description: editDesc })}
                disabled={savingPr}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-400 text-white text-xs font-medium transition-colors disabled:opacity-50"
              >
                {savingPr ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                Save
              </button>
              <button
                onClick={() => setEditingDesc(false)}
                className="px-3 py-1.5 rounded-lg text-surface-400 hover:text-white text-xs transition-colors"
              >
                Cancel
              </button>
            </div>
          </Card>
        ) : pr.description ? (
          <Card
            className={`!p-4 mt-4 ${isActionable ? "cursor-pointer group" : ""}`}
            onClick={() => {
              if (isActionable) {
                setEditDesc(pr.description || "");
                setEditingDesc(true);
              }
            }}
          >
            <div className="prose prose-sm prose-invert max-w-none text-surface-300 [&_a]:text-brand-400 [&_code]:bg-surface-700 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_pre]:bg-surface-800 [&_pre]:p-3 [&_pre]:rounded-lg [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4" dangerouslySetInnerHTML={{ __html: pr.description }} />
            {isActionable && (
              <div className="flex items-center gap-1 mt-2 text-xs text-surface-600 opacity-0 group-hover:opacity-100 transition-opacity">
                <Pencil className="h-3 w-3" /> Click to edit
              </div>
            )}
          </Card>
        ) : isActionable ? (
          <button
            onClick={() => {
              setEditDesc("");
              setEditingDesc(true);
            }}
            className="mt-4 flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-surface-600 text-sm text-surface-500 hover:text-surface-300 hover:border-surface-400 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" /> Add a description
          </button>
        ) : null}
      </div>

      {/* Merge info */}
      {pr.status === "merged" && (
        <Card className="!p-4 flex items-center gap-3 border-purple-500/20 bg-purple-500/5">
          <GitMerge className="h-5 w-5 text-purple-400" />
          <div className="flex-1 text-sm">
            <span className="text-purple-400 font-medium">Merged</span>
            {pr.merge_strategy && (
              <span className="text-surface-400"> via {pr.merge_strategy}</span>
            )}
            {pr.merge_commit_sha && (
              <a
                href={`/org/${orgSlug}/projects/${projectSlug}/commits/${pr.merge_commit_sha}`}
                className="text-surface-500 ml-2 font-mono text-xs hover:text-brand-400 transition-colors"
              >
                {pr.merge_commit_sha.slice(0, 7)}
              </a>
            )}
          </div>
          {pr.additions !== null && (
            <div className="text-xs">
              <span className="text-green-400">+{pr.additions}</span>{" "}
              <span className="text-red-400">-{pr.deletions}</span>{" "}
              <span className="text-surface-500">
                in {pr.files_changed} files
              </span>
            </div>
          )}
        </Card>
      )}

      {/* Action buttons */}
      {isActionable && (
        <div className="flex items-center gap-3 flex-wrap">
          {actionError && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex-1">
              <AlertCircle className="h-4 w-4" />
              {actionError}
            </div>
          )}
          <div className="flex items-center gap-2 ml-auto">
            {/* Draft toggle */}
            <button
              onClick={toggleDraft}
              disabled={togglingDraft}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm transition-colors disabled:opacity-50 ${
                pr!.is_draft
                  ? "border-brand-400/30 text-brand-400 hover:bg-brand-500/10"
                  : "border-surface-600 text-surface-400 hover:bg-surface-800"
              }`}
            >
              {togglingDraft ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : pr!.is_draft ? (
                <Eye className="h-4 w-4" />
              ) : (
                <Pencil className="h-4 w-4" />
              )}
              {pr!.is_draft ? "Ready for review" : "Convert to draft"}
            </button>

            {/* Review dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowReviewMenu(!showReviewMenu)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-surface-600 text-white text-sm font-medium hover:bg-surface-800 transition-colors"
              >
                <Shield className="h-4 w-4" />
                Review
                <ChevronDown className="h-3 w-3" />
              </button>
              {showReviewMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowReviewMenu(false)}
                  />
                  <div className="absolute top-full right-0 mt-1 z-50 w-80 rounded-lg border border-surface-600 bg-surface-800 shadow-xl p-3">
                    <textarea
                      value={reviewBody}
                      onChange={(e) => setReviewBody(e.target.value)}
                      placeholder="Leave a review comment (optional)..."
                      rows={3}
                      className="w-full rounded-lg border border-surface-600 bg-surface-900 px-3 py-2 text-sm text-white placeholder:text-surface-500 focus:outline-none focus:border-brand-500/60 resize-none mb-2"
                    />
                    <div className="flex flex-col gap-1">
                      {([
                        ["approved", "Approve", "bg-green-600 hover:bg-green-500 text-white", CheckCircle2],
                        ["changes_requested", "Request changes", "bg-orange-600 hover:bg-orange-500 text-white", AlertTriangle],
                        ["commented", "Comment", "bg-surface-700 hover:bg-surface-600 text-white", MessageSquare],
                      ] as const).map(([status, label, cls, Icon]) => (
                        <button
                          key={status}
                          onClick={() => submitReview(status as "approved" | "changes_requested" | "commented")}
                          disabled={submittingReview}
                          className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors disabled:opacity-50 ${cls}`}
                        >
                          {submittingReview ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            <button
              onClick={handleClose}
              disabled={closing}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-500/30 text-red-400 text-sm hover:bg-red-500/10 transition-colors disabled:opacity-50"
            >
              {closing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <X className="h-4 w-4" />
              )}
              Close
            </button>
            <div className="relative">
              <button
                onClick={() => setShowMergeMenu(!showMergeMenu)}
                disabled={merging}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-500 transition-colors disabled:opacity-50"
              >
                {merging ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <GitMerge className="h-4 w-4" />
                )}
                Merge
                <ChevronDown className="h-3 w-3" />
              </button>
              {showMergeMenu && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowMergeMenu(false)}
                  />
                  <div className="absolute top-full right-0 mt-1 z-50 w-56 rounded-lg border border-surface-600 bg-surface-800 shadow-xl py-1">
                    {[
                      [
                        "merge",
                        "Create a merge commit",
                        "All commits will be added with a merge commit.",
                      ],
                      [
                        "squash",
                        "Squash and merge",
                        "Combine all commits into one on the target.",
                      ],
                      [
                        "rebase",
                        "Rebase and merge",
                        "Apply commits on top of the target branch.",
                      ],
                    ].map(([strategy, label, desc]) => (
                      <button
                        key={strategy}
                        onClick={() => handleMerge(strategy)}
                        className="w-full text-left px-3 py-2 hover:bg-surface-700 transition-colors"
                      >
                        <div className="text-sm text-white font-medium">
                          {label}
                        </div>
                        <div className="text-xs text-surface-500 mt-0.5">
                          {desc}
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-surface-700">
        {(
          [
            ["conversation", "Conversation", MessageSquare],
            [
              "files",
              `Files changed${fileDiffs.length ? ` (${fileDiffs.length})` : ""}`,
              FileText,
            ],
            [
              "commits",
              `Commits${commits.length ? ` (${commits.length})` : ""}`,
              GitCommitHorizontal,
            ],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setTab(key as typeof tab)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === key
                ? "border-brand-400 text-white"
                : "border-transparent text-surface-400 hover:text-surface-200"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
        {fileDiffs.length > 0 && tab === "files" && (
          <div className="ml-auto flex items-center gap-3 pr-2">
            <div className="text-xs text-surface-500">
              <span className="text-green-400">+{totalAdditions}</span>{" "}
              <span className="text-red-400">-{totalDeletions}</span>
            </div>

            {/* View mode toggle */}
            <div className="flex items-center gap-1 bg-surface-800 rounded-lg p-0.5">
              <button
                onClick={() => setSplitView(false)}
                className={`px-2 py-1 rounded text-xs flex items-center gap-1 transition-colors ${
                  !splitView
                    ? "bg-surface-700 text-white"
                    : "text-surface-400 hover:text-surface-200"
                }`}
                title="Unified view"
              >
                <Rows3 className="h-3 w-3" />
                Unified
              </button>
              <button
                onClick={() => setSplitView(true)}
                className={`px-2 py-1 rounded text-xs flex items-center gap-1 transition-colors ${
                  splitView
                    ? "bg-surface-700 text-white"
                    : "text-surface-400 hover:text-surface-200"
                }`}
                title="Split view"
              >
                <Columns2 className="h-3 w-3" />
                Split
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Live update pop-up toast */}
      {banner && (
        <div className="fixed top-6 right-6 z-50" style={{ animation: "slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1)" }}>
          <style>{`
            @keyframes slideInRight {
              from { opacity: 0; transform: translateX(100%) scale(0.95); }
              to { opacity: 1; transform: translateX(0) scale(1); }
            }
            @keyframes pulse-glow {
              0%, 100% { box-shadow: 0 0 20px rgba(59,130,246,0.15); }
              50% { box-shadow: 0 0 30px rgba(59,130,246,0.3); }
            }
          `}</style>
          <div
            className={`relative flex items-start gap-3 px-5 py-4 rounded-xl border text-sm shadow-2xl backdrop-blur-xl min-w-[340px] max-w-[420px] ${
              banner.type === "push"
                ? "bg-[#0d1b2a]/90 border-blue-500/30 text-blue-100"
                : banner.type === "merged"
                ? "bg-[#1a0d2e]/90 border-purple-500/30 text-purple-100"
                : "bg-[#2a0d0d]/90 border-red-500/30 text-red-100"
            }`}
            style={banner.type === "push" ? { animation: "pulse-glow 2s ease-in-out infinite" } : undefined}
          >
            {/* Accent bar */}
            <div className={`absolute left-0 top-3 bottom-3 w-[3px] rounded-full ${
              banner.type === "push" ? "bg-blue-400" : banner.type === "merged" ? "bg-purple-400" : "bg-red-400"
            }`} />

            {/* Icon */}
            <div className={`shrink-0 mt-0.5 p-2 rounded-lg ${
              banner.type === "push"
                ? "bg-blue-500/20"
                : banner.type === "merged"
                ? "bg-purple-500/20"
                : "bg-red-500/20"
            }`}>
              {banner.type === "push" ? (
                <RefreshCw className="h-4 w-4 text-blue-400 animate-spin" style={{ animationDuration: "3s" }} />
              ) : banner.type === "merged" ? (
                <GitMerge className="h-4 w-4 text-purple-400" />
              ) : (
                <X className="h-4 w-4 text-red-400" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[13px] leading-tight mb-1">
                {banner.type === "push" ? "New Changes Detected" : banner.type === "merged" ? "Pull Request Merged" : "Pull Request Closed"}
              </p>
              <p className="text-xs opacity-70 leading-snug">{banner.message}</p>
              {banner.type === "push" && (
                <button
                  onClick={() => {
                    fetchDiff();
                    fetchPr();
                    setBanner(null);
                  }}
                  className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-400 text-white transition-all duration-200 hover:shadow-lg hover:shadow-blue-500/25"
                >
                  <RefreshCw className="h-3 w-3" />
                  Refresh now
                </button>
              )}
            </div>

            {/* Close button */}
            <button
              onClick={() => setBanner(null)}
              className="shrink-0 p-1 rounded-md text-current opacity-40 hover:opacity-100 hover:bg-white/10 transition-all"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Tab content */}
      {tab === "conversation" && (
        <div className="space-y-1">
          {/* New comment form — at top since newest items appear first */}
          <Card className="!p-4">
            <div className="space-y-3">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Leave a comment..."
                rows={3}
                className="w-full rounded-lg border border-surface-600 bg-surface-900 px-3 py-2 text-sm text-white placeholder:text-surface-500 focus:outline-none focus:border-brand-500/60 resize-none transition-all"
              />
              <div className="flex justify-end">
                <button
                  onClick={submitComment}
                  disabled={!newComment.trim() || submittingComment}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submittingComment ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  Comment
                </button>
              </div>
            </div>
          </Card>

          {/* Unified timeline: comments + activities + reviews merged by date */}
          {(loadingComments) ? (
            <Card className="!p-6">
              <div className="flex items-center justify-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-brand-400" />
                <span className="text-surface-400 text-sm">Loading timeline...</span>
              </div>
            </Card>
          ) : (() => {
            type TimelineItem =
              | { kind: "comment"; data: PrCommentData; date: number }
              | { kind: "activity"; data: ActivityData; date: number }
              | { kind: "review"; data: ReviewData; date: number };

            const items: TimelineItem[] = [];

            // Add top-level general comments (not inline file comments, not replies)
            comments
              .filter((c) => !c.parent_id)
              .forEach((c) => {
                items.push({ kind: "comment", data: c, date: new Date(c.created_at).getTime() });
              });

            // Add activities
            activities.forEach((a) => {
              items.push({ kind: "activity", data: a, date: new Date(a.created_at).getTime() });
            });

            // Add reviews
            reviews.forEach((r) => {
              items.push({ kind: "review", data: r, date: new Date(r.created_at).getTime() });
            });

            // Sort by date descending (newest first)
            items.sort((a, b) => b.date - a.date);

            // Get the current HEAD sha from latest commit (for outdated detection)
            const headSha = commits.length > 0 ? commits[0].sha : null;

            if (items.length === 0) {
              return (
                <Card className="!p-6">
                  <div className="flex flex-col items-center justify-center text-center py-4">
                    <MessageSquare className="h-8 w-8 text-surface-600 mb-2" />
                    <p className="text-surface-400 text-sm">No activity yet. Start the conversation!</p>
                  </div>
                </Card>
              );
            }

            return (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-[19px] top-3 bottom-3 w-px bg-surface-700" />

                {items.map((item, i) => {
                  // ---- Activity item ----
                  if (item.kind === "activity") {
                    const a = item.data;
                    const actionLabels: Record<string, string> = {
                      title_changed: "changed the title",
                      description_changed: "updated the description",
                      marked_draft: "marked this as a draft",
                      marked_ready: "marked this as ready for review",
                      reopened: "reopened this pull request",
                      review_submitted: "submitted a review",
                      status_changed: "changed the status",
                    };
                    return (
                      <div key={`activity-${a.id}`} className="relative flex items-start gap-4 py-2.5">
                        <div className="relative z-10 flex items-center justify-center w-[38px] h-[38px] rounded-full border-2 border-surface-700 bg-surface-900">
                          <History className="h-4 w-4 text-surface-500" />
                        </div>
                        <div className="flex-1 min-w-0 pt-2">
                          <p className="text-xs text-surface-500">
                            <span className="text-surface-300 font-medium">{a.user_name || "Someone"}</span>
                            {" "}{actionLabels[a.action] || a.action}
                            {a.action === "title_changed" && a.old_value && a.new_value && (
                              <span>
                                {" "}from <span className="line-through text-surface-600">{a.old_value}</span>
                                {" "}to <span className="text-white font-medium">{a.new_value}</span>
                              </span>
                            )}
                            <span className="ml-2 text-surface-600">{timeAgo(a.created_at)}</span>
                          </p>
                        </div>
                      </div>
                    );
                  }

                  // ---- Review item ----
                  if (item.kind === "review") {
                    const r = item.data;
                    const reviewConfig = {
                      approved: { icon: CheckCircle2, color: "text-green-400", bg: "border-green-500/30 bg-green-500/5", label: "approved" },
                      changes_requested: { icon: AlertTriangle, color: "text-orange-400", bg: "border-orange-500/30 bg-orange-500/5", label: "requested changes" },
                      commented: { icon: MessageSquare, color: "text-blue-400", bg: "border-blue-500/30 bg-blue-500/5", label: "reviewed" },
                    };
                    const cfg = reviewConfig[r.status];
                    const ReviewIcon = cfg.icon;
                    return (
                      <div key={`review-${r.id}`} className="relative flex items-start gap-4 py-3">
                        <div className={`relative z-10 flex items-center justify-center w-[38px] h-[38px] rounded-full border-2 ${cfg.bg}`}>
                          <ReviewIcon className={`h-4 w-4 ${cfg.color}`} />
                        </div>
                        <div className="flex-1 min-w-0 pt-1">
                          <p className="text-sm">
                            <span className="text-white font-medium">{r.reviewer_name || "Someone"}</span>
                            <span className={`ml-1 ${cfg.color}`}>{cfg.label}</span>
                            <span className="ml-2 text-xs text-surface-600">{timeAgo(r.created_at)}</span>
                          </p>
                          {r.body && (
                            <p className="text-sm text-surface-400 mt-1">{r.body}</p>
                          )}
                        </div>
                      </div>
                    );
                  }

                  // ---- Comment item ----
                  {
                    const c = item.data as PrCommentData;
                    const isInline = !!c.file_path;
                    const isOutdated = isInline && c.commit_sha && headSha && c.commit_sha !== headSha;
                    const isChangeRequest = c.comment_type === "change_request";

                    // Build diff context for inline comments
                    const contextLines: { dl: DiffLine; isTarget: boolean }[] = [];
                    if (isInline && c.file_path) {
                      const fd = fileDiffs.find((f) => f.path === c.file_path);
                      if (fd) {
                        const idx = fd.rawLines.findIndex(
                          (dl) => (dl.newLineNum === c.line_number || dl.oldLineNum === c.line_number) && dl.type !== "hunk"
                        );
                        if (idx >= 0) {
                          const start = Math.max(0, idx - 3);
                          const end = Math.min(fd.rawLines.length - 1, idx + 3);
                          for (let ci = start; ci <= end; ci++) {
                            if (fd.rawLines[ci].type !== "hunk") {
                              contextLines.push({ dl: fd.rawLines[ci], isTarget: ci === idx });
                            }
                          }
                        }
                      }
                    }

                    return (
                      <div key={`comment-${c.id}`} className="relative flex items-start gap-4 py-3">
                        {/* Timeline dot */}
                        <div className="relative z-10 flex items-center justify-center w-[38px] h-[38px] rounded-full border-2 border-brand-400/50 bg-brand-500/10">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-brand-400 to-purple-500 flex items-center justify-center text-[10px] font-bold text-white">
                            {commentInitials(c)}
                          </div>
                        </div>
                        {/* Comment content */}
                        <Card className="flex-1 !p-0 overflow-hidden">
                          {/* Diff context snippet */}
                          {contextLines.length > 0 && (
                            <div className="bg-surface-900/50 border-b border-surface-700/30 overflow-x-auto">
                              {contextLines.map((cl, ci) => {
                                const bg = cl.isTarget
                                  ? cl.dl.type === "add" ? "bg-green-500/20" : cl.dl.type === "remove" ? "bg-red-500/20" : "bg-yellow-500/10"
                                  : cl.dl.type === "add" ? "bg-green-500/5" : cl.dl.type === "remove" ? "bg-red-500/5" : "";
                                const color = cl.dl.type === "add" ? "text-green-300" : cl.dl.type === "remove" ? "text-red-300" : "text-surface-400";
                                const prefix = cl.dl.type === "add" ? "+" : cl.dl.type === "remove" ? "-" : " ";
                                const lineNum = cl.dl.newLineNum ?? cl.dl.oldLineNum ?? "";
                                return (
                                  <div key={ci} className={`px-3 py-0.5 font-mono text-xs flex ${bg} ${cl.isTarget ? "border-l-2 border-brand-400" : "border-l-2 border-transparent"}`}>
                                    <span className="w-8 text-right text-surface-500 mr-3 select-none shrink-0">{lineNum}</span>
                                    <span className={`select-none mr-1 ${color}`}>{prefix}</span>
                                    <span className={`whitespace-pre ${color}`}>{cl.dl.content}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          <div className="p-4">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <span className="text-sm font-medium text-surface-200">
                                {commentAuthor(c)}
                              </span>
                              {isInline && (
                                <span className="text-xs bg-surface-700 text-surface-400 px-1.5 py-0.5 rounded font-mono">
                                  {c.file_path} L{c.line_number}
                                </span>
                              )}
                              {isOutdated && (
                                <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded font-medium border border-yellow-500/30">
                                  Outdated
                                </span>
                              )}
                              {isChangeRequest && (
                                <span className="text-[10px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded font-medium border border-orange-500/30">
                                  Change request
                                </span>
                              )}
                              {c.is_resolved && (
                                <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded font-medium border border-green-500/30 flex items-center gap-1">
                                  <Check className="h-3 w-3" /> Resolved{c.resolved_by_name ? ` by ${c.resolved_by_name}` : ""}
                                </span>
                              )}
                              <span className="text-xs text-surface-500 ml-auto">{timeAgo(c.created_at)}</span>
                            </div>
                            <div className={`text-sm text-surface-200 whitespace-pre-wrap leading-relaxed ${isOutdated ? "opacity-60" : ""}`}>
                              {c.body}
                            </div>
                            {/* Resolve button for change requests */}
                            {isChangeRequest && !c.is_resolved && (
                              <button
                                onClick={() => resolveComment(c.id)}
                                className="mt-2 flex items-center gap-1.5 text-xs text-surface-400 hover:text-green-400 px-2 py-1 rounded border border-surface-700 hover:border-green-500/30 hover:bg-green-500/5 transition-all"
                              >
                                <Check className="h-3 w-3" />
                                Resolve
                              </button>
                            )}
                            {/* Thread replies */}
                            {comments.filter((r) => r.parent_id === c.id).map((reply) => (
                              <div key={reply.id} className="mt-3 pl-3 border-l-2 border-surface-700">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center text-[9px] font-bold text-white">
                                    {commentInitials(reply)}
                                  </div>
                                  <span className="text-xs text-surface-400">{commentAuthor(reply)}</span>
                                  <span className="text-xs text-surface-500 ml-auto">{timeAgo(reply.created_at)}</span>
                                </div>
                                <div className="text-sm text-surface-300 whitespace-pre-wrap">{reply.body}</div>
                              </div>
                            ))}
                            {/* Reply button & form */}
                            <div className="mt-2">
                              {replyingTo === c.id ? (
                                <div className="space-y-2">
                                  <textarea
                                    value={replyBody}
                                    onChange={(e) => setReplyBody(e.target.value)}
                                    placeholder="Write a reply..."
                                    rows={2}
                                    autoFocus
                                    className="w-full rounded-lg border border-surface-600 bg-surface-900 px-3 py-2 text-sm text-white placeholder:text-surface-500 focus:outline-none focus:border-brand-500/60 resize-none transition-all"
                                  />
                                  <div className="flex justify-end gap-2">
                                    <button
                                      onClick={() => { setReplyingTo(null); setReplyBody(""); }}
                                      className="px-3 py-1.5 text-xs text-surface-400 hover:text-surface-200 transition-colors"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      onClick={() => submitReply(c.id)}
                                      disabled={!replyBody.trim() || submittingReply}
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-brand-500 text-white text-xs font-medium hover:bg-brand-400 transition-colors disabled:opacity-50"
                                    >
                                      {submittingReply ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                                      Reply
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  onClick={() => { setReplyingTo(c.id); setReplyBody(""); }}
                                  className="text-xs text-surface-500 hover:text-brand-400 transition-colors"
                                >
                                  ↩ Reply
                                </button>
                              )}
                            </div>
                          </div>
                        </Card>
                      </div>
                    );
                  }
                })}
              </div>
            );
          })()}
        </div>
      )}

      {tab === "files" && (
        <>
          {loadingDiff && (
            <Card className="!p-8">
              <div className="flex items-center justify-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-brand-400" />
                <span className="text-surface-400 text-sm">
                  Loading diff...
                </span>
              </div>
            </Card>
          )}

          {!loadingDiff && fileDiffs.length === 0 && (
            <Card className="!p-8">
              <div className="flex flex-col items-center justify-center text-center">
                <FileText className="h-10 w-10 text-surface-600 mb-3" />
                <p className="text-surface-400">
                  No file changes to display.
                </p>
              </div>
            </Card>
          )}

          {!loadingDiff && fileDiffs.length > 0 && (
            <div className="flex gap-5 items-start">
              {/* LEFT — Per-file diffs */}
              <div className="flex-1 min-w-0 space-y-4">
                {fileDiffs.map((fd) => (
                  <div
                    key={fd.path}
                    ref={(el) => {
                      fileRefs.current[fd.path] = el;
                    }}
                    className="scroll-mt-4"
                  >
                    <Card className="!p-0 overflow-hidden">
                      {/* File header */}
                      <button
                        onClick={() => toggleFile(fd.path)}
                        className={`w-full px-4 py-2.5 flex items-center gap-2 text-left transition-colors hover:bg-surface-800/50 ${
                          activeFile === fd.path ? "bg-surface-800/30" : ""
                        }`}
                      >
                        {expandedFiles.has(fd.path) ? (
                          <ChevronDown className="h-3.5 w-3.5 text-surface-400 shrink-0" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-surface-400 shrink-0" />
                        )}
                        <FileStatusIcon
                          additions={fd.additions}
                          deletions={fd.deletions}
                        />
                        <span className="text-sm text-surface-200 font-mono truncate flex-1">
                          {fd.path}
                        </span>
                        <div className="flex items-center gap-2 text-xs shrink-0">
                          {fd.additions > 0 && (
                            <span className="text-green-400">
                              +{fd.additions}
                            </span>
                          )}
                          {fd.deletions > 0 && (
                            <span className="text-red-400">
                              -{fd.deletions}
                            </span>
                          )}
                          <DiffBar
                            additions={fd.additions}
                            deletions={fd.deletions}
                          />
                        </div>
                      </button>

                      {/* Diff content with inline comments */}
                      {expandedFiles.has(fd.path) && (
                        <div className="border-t border-surface-700 overflow-auto max-h-[700px]">
                          <InlineDiffViewer
                            filePath={fd.path}
                            rawLines={fd.rawLines}
                            comments={comments}
                            headSha={commits.length > 0 ? commits[0].sha : null}
                            onResolveComment={resolveComment}
                            inlineCommentTarget={inlineCommentTarget}
                            inlineCommentBody={inlineCommentBody}
                            submittingInline={submittingInline}
                            replyingTo={replyingTo}
                            replyBody={replyBody}
                            submittingReply={submittingReply}
                            onLineClick={(file, line) => {
                              setInlineCommentTarget((prev) =>
                                prev?.file === file && prev?.line === line
                                  ? null
                                  : { file, line }
                              );
                              setInlineCommentBody("");
                            }}
                            onCommentBodyChange={setInlineCommentBody}
                            onSubmitComment={submitInlineComment}
                            onCancelComment={() => { setInlineCommentTarget(null); setInlineCommentBody(""); }}
                            onReply={(id) => { setReplyingTo(id); setReplyBody(""); }}
                            onReplyBodyChange={setReplyBody}
                            onSubmitReply={submitReply}
                            onCancelReply={() => { setReplyingTo(null); setReplyBody(""); }}
                          />
                        </div>
                      )}
                    </Card>
                  </div>
                ))}
              </div>

              {/* RIGHT — File sidebar (sticky) */}
              <div className="w-72 shrink-0 sticky top-4">
                <Card className="!p-0 overflow-hidden">
                  <div className="px-3 py-2.5 border-b border-surface-700 flex items-center gap-2">
                    <FileCode className="h-3.5 w-3.5 text-blue-400" />
                    <span className="text-xs font-semibold text-surface-300 uppercase tracking-wider">
                      Files
                    </span>
                    <span className="text-[10px] text-surface-500 ml-auto">
                      {fileDiffs.length}
                    </span>
                  </div>
                  <div className="max-h-[70vh] overflow-y-auto py-1">
                    <FileTreeSidebar
                      files={fileDiffs}
                      activeFile={activeFile}
                      onNavigate={navigateToFile}
                    />
                  </div>
                </Card>
              </div>
            </div>
          )}
        </>
      )}

      {tab === "commits" && (
        <div className="space-y-1">
          {loadingCommits ? (
            <Card className="!p-6">
              <div className="flex items-center justify-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-brand-400" />
                <span className="text-surface-400 text-sm">Loading commits...</span>
              </div>
            </Card>
          ) : commits.length === 0 ? (
            <Card className="!p-6">
              <div className="flex flex-col items-center justify-center text-center py-4">
                <GitCommitHorizontal className="h-8 w-8 text-surface-600 mb-2" />
                <p className="text-surface-400 text-sm">No commits found.</p>
              </div>
            </Card>
          ) : (
            <Card className="!p-0 overflow-hidden divide-y divide-surface-700/50">
              {commits.map((commit) => (
                <a
                  key={commit.sha}
                  href={`/org/${orgSlug}/projects/${projectSlug}/commits/${commit.sha}`}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-surface-800/50 transition-colors cursor-pointer"
                >
                  {/* Icon */}
                  <div className="mt-0.5 flex items-center justify-center w-8 h-8 rounded-full border-2 border-surface-600 bg-surface-800 shrink-0">
                    <GitCommitHorizontal className="h-3.5 w-3.5 text-surface-400" />
                  </div>
                  {/* Commit info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">
                      {commit.message}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-xs text-surface-500">
                      <span className="font-medium text-surface-400">{commit.author_name}</span>
                      <span>•</span>
                      <span>{timeAgo(commit.committed_at)}</span>
                      {(commit.additions != null || commit.deletions != null) && (
                        <>
                          <span>•</span>
                          <span className="text-green-400">+{commit.additions ?? 0}</span>
                          <span className="text-red-400">-{commit.deletions ?? 0}</span>
                        </>
                      )}
                    </div>
                  </div>
                  {/* SHA badge */}
                  <div className="shrink-0 flex items-center gap-1 text-xs font-mono text-surface-400 px-2 py-0.5 rounded bg-surface-800 border border-surface-700 mt-0.5">
                    {commit.sha.slice(0, 7)}
                    <ExternalLink className="h-3 w-3" />
                  </div>
                </a>
              ))}
            </Card>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                      */
/* ------------------------------------------------------------------ */

function FileStatusIcon({
  additions,
  deletions,
  size = 16,
}: {
  additions: number;
  deletions: number;
  size?: number;
}) {
  const s = { width: size, height: size };
  if (additions > 0 && deletions === 0)
    return <FilePlus style={s} className="text-green-400 shrink-0" />;
  if (deletions > 0 && additions === 0)
    return <FileX style={s} className="text-red-400 shrink-0" />;
  return <FilePen style={s} className="text-blue-400 shrink-0" />;
}

function DiffBar({
  additions,
  deletions,
}: {
  additions: number;
  deletions: number;
}) {
  const total = additions + deletions;
  if (total === 0) return null;
  const blocks = 5;
  const addBlocks = Math.round((additions / total) * blocks);
  const delBlocks = blocks - addBlocks;

  return (
    <div className="flex gap-px ml-1">
      {Array.from({ length: addBlocks }).map((_, i) => (
        <div key={`a${i}`} className="w-1.5 h-1.5 rounded-sm bg-green-400" />
      ))}
      {Array.from({ length: delBlocks }).map((_, i) => (
        <div key={`d${i}`} className="w-1.5 h-1.5 rounded-sm bg-red-400" />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  File tree sidebar (grouped by folders)                             */
/* ------------------------------------------------------------------ */

interface FolderNode {
  name: string;
  files: { path: string; basename: string; additions: number; deletions: number }[];
  children: Map<string, FolderNode>;
}

function buildFileTree(
  files: { path: string; additions: number; deletions: number }[]
): FolderNode {
  const root: FolderNode = { name: "", files: [], children: new Map() };

  for (const f of files) {
    const parts = f.path.split("/");
    const basename = parts.pop() || f.path;
    let current = root;

    for (const dir of parts) {
      if (!current.children.has(dir)) {
        current.children.set(dir, { name: dir, files: [], children: new Map() });
      }
      current = current.children.get(dir)!;
    }

    current.files.push({ path: f.path, basename, additions: f.additions, deletions: f.deletions });
  }

  return root;
}

function FileTreeSidebar({
  files,
  activeFile,
  onNavigate,
}: {
  files: { path: string; additions: number; deletions: number }[];
  activeFile: string | null;
  onNavigate: (path: string) => void;
}) {
  const tree = useMemo(() => buildFileTree(files), [files]);

  return (
    <div>
      {/* Root-level files */}
      {tree.files.map((f) => (
        <FileTreeItem
          key={f.path}
          file={f}
          activeFile={activeFile}
          onNavigate={onNavigate}
          depth={0}
        />
      ))}
      {/* Folder groups */}
      {Array.from(tree.children.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, node]) => (
          <FolderTreeNode
            key={node.name}
            node={node}
            activeFile={activeFile}
            onNavigate={onNavigate}
            depth={0}
            prefix=""
          />
        ))}
    </div>
  );
}

function FolderTreeNode({
  node,
  activeFile,
  onNavigate,
  depth,
  prefix,
}: {
  node: FolderNode;
  activeFile: string | null;
  onNavigate: (path: string) => void;
  depth: number;
  prefix: string;
}) {
  const [open, setOpen] = useState(true);
  const folderPath = prefix ? `${prefix}/${node.name}` : node.name;
  const totalFiles =
    node.files.length +
    Array.from(node.children.values()).reduce(
      (s, c) => s + c.files.length,
      0
    );

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left px-2 py-1.5 flex items-center gap-1.5 text-xs text-surface-400 hover:text-surface-200 hover:bg-surface-800/50 transition-colors"
        style={{ paddingLeft: `${8 + depth * 12}px` }}
      >
        {open ? (
          <ChevronDown className="h-3 w-3 shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0" />
        )}
        {open ? (
          <FolderOpen className="h-3.5 w-3.5 text-blue-400 shrink-0" />
        ) : (
          <Folder className="h-3.5 w-3.5 text-blue-400 shrink-0" />
        )}
        <span className="font-medium truncate">{node.name}</span>
        <span className="text-[10px] text-surface-600 ml-auto shrink-0">
          {totalFiles}
        </span>
      </button>

      {open && (
        <div>
          {node.files.map((f) => (
            <FileTreeItem
              key={f.path}
              file={f}
              activeFile={activeFile}
              onNavigate={onNavigate}
              depth={depth + 1}
            />
          ))}
          {Array.from(node.children.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([, child]) => (
              <FolderTreeNode
                key={child.name}
                node={child}
                activeFile={activeFile}
                onNavigate={onNavigate}
                depth={depth + 1}
                prefix={folderPath}
              />
            ))}
        </div>
      )}
    </div>
  );
}

function FileTreeItem({
  file,
  activeFile,
  onNavigate,
  depth,
}: {
  file: { path: string; basename: string; additions: number; deletions: number };
  activeFile: string | null;
  onNavigate: (path: string) => void;
  depth: number;
}) {
  const isActive = activeFile === file.path;
  return (
    <button
      onClick={() => onNavigate(file.path)}
      className={`w-full text-left py-1.5 pr-2 flex items-center gap-1.5 transition-colors text-xs ${
        isActive
          ? "bg-brand-500/10 border-l-2 border-brand-400"
          : "hover:bg-surface-800/50 border-l-2 border-transparent"
      }`}
      style={{ paddingLeft: `${8 + (depth + 1) * 12}px` }}
      title={file.path}
    >
      <FileStatusIcon additions={file.additions} deletions={file.deletions} size={13} />
      <span
        className={`font-mono truncate flex-1 ${
          isActive ? "text-brand-300" : "text-surface-300"
        }`}
      >
        {file.basename}
      </span>
      <div className="flex items-center gap-1 text-[10px] shrink-0">
        {file.additions > 0 && (
          <span className="text-green-400">+{file.additions}</span>
        )}
        {file.deletions > 0 && (
          <span className="text-red-400">-{file.deletions}</span>
        )}
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Comment Card                                                       */
/* ------------------------------------------------------------------ */

function CommentCard({
  comment,
  replies = [],
}: {
  comment: PrCommentData;
  replies?: PrCommentData[];
}) {
  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  return (
    <Card className="!p-0 overflow-hidden">
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-brand-400 to-purple-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
            {commentInitials(comment)}
          </div>
          <span className="text-sm font-medium text-surface-300">
            {commentAuthor(comment)}
          </span>
          <span className="text-[10px] text-surface-500">{timeAgo(comment.created_at)}</span>
          {comment.file_path && (
            <span className="text-[10px] text-blue-400 ml-auto font-mono">
              {comment.file_path}:{comment.line_number}
            </span>
          )}
        </div>
        <div className="text-sm text-surface-200 whitespace-pre-wrap leading-relaxed pl-8">
          {comment.body}
        </div>
      </div>

      {/* Replies */}
      {replies.length > 0 && (
        <div className="border-t border-surface-700/50 bg-surface-900/30">
          {replies.map((reply) => (
            <div key={reply.id} className="px-4 py-2.5 border-b border-surface-700/20 last:border-b-0">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center text-[9px] font-bold text-white shrink-0">
                  {commentInitials(reply)}
                </div>
              </div>
              <div className="text-xs text-surface-300 whitespace-pre-wrap leading-relaxed pl-7">
                {reply.body}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Inline Diff Viewer — GitHub-style with comment injection           */
/* ------------------------------------------------------------------ */

function InlineDiffViewer({
  filePath,
  rawLines,
  comments,
  headSha,
  onResolveComment,
  inlineCommentTarget,
  inlineCommentBody,
  submittingInline,
  replyingTo,
  replyBody,
  submittingReply,
  onLineClick,
  onCommentBodyChange,
  onSubmitComment,
  onCancelComment,
  onReply,
  onReplyBodyChange,
  onSubmitReply,
  onCancelReply,
}: {
  filePath: string;
  rawLines: DiffLine[];
  comments: PrCommentData[];
  headSha: string | null;
  onResolveComment: (id: number) => void;
  inlineCommentTarget: { file: string; line: number } | null;
  inlineCommentBody: string;
  submittingInline: boolean;
  replyingTo: number | null;
  replyBody: string;
  submittingReply: boolean;
  onLineClick: (file: string, line: number) => void;
  onCommentBodyChange: (body: string) => void;
  onSubmitComment: () => void;
  onCancelComment: () => void;
  onReply: (id: number) => void;
  onReplyBodyChange: (body: string) => void;
  onSubmitReply: (parentId: number) => void;
  onCancelReply: () => void;
}) {
  // Group comments by line number for this file
  const commentsByLine = useMemo(() => {
    const map = new Map<number, PrCommentData[]>();
    comments
      .filter((c) => c.file_path === filePath && !c.parent_id)
      .forEach((c) => {
        const ln = c.line_number || 0;
        if (!map.has(ln)) map.set(ln, []);
        map.get(ln)!.push(c);
      });
    return map;
  }, [comments, filePath]);

  const isTargetingThisFile = inlineCommentTarget?.file === filePath;

  return (
    <table className="w-full border-collapse font-mono text-xs leading-5">
      <tbody>
        {rawLines.map((dl, idx) => {
          // Determine the line number to use for comments
          const lineNum = dl.type === "add" || dl.type === "context" ? dl.newLineNum : dl.oldLineNum;
          // Only show comments/forms on add or context lines to avoid duplicates
          const canHaveComments = dl.type === "add" || dl.type === "context";
          const isCommentTarget = canHaveComments && isTargetingThisFile && inlineCommentTarget?.line === lineNum;
          const lineComments = canHaveComments && lineNum !== undefined ? commentsByLine.get(lineNum) : undefined;
          const hasComments = lineComments && lineComments.length > 0;

          if (dl.type === "hunk") {
            return (
              <tr key={`hunk-${idx}`} className="bg-blue-500/5">
                <td colSpan={3} className="px-3 py-1 text-blue-400/70 text-[11px] select-none border-b border-surface-700/30">
                  {dl.content}
                </td>
              </tr>
            );
          }

          const bgClass =
            dl.type === "add"
              ? "bg-green-500/8 hover:bg-green-500/15"
              : dl.type === "remove"
              ? "bg-red-500/8 hover:bg-red-500/15"
              : "hover:bg-surface-700/20";

          const gutterBg =
            dl.type === "add"
              ? "bg-green-500/15"
              : dl.type === "remove"
              ? "bg-red-500/15"
              : "bg-transparent";

          const textColor =
            dl.type === "add"
              ? "text-green-300"
              : dl.type === "remove"
              ? "text-red-300"
              : "text-surface-300";

          const prefix = dl.type === "add" ? "+" : dl.type === "remove" ? "-" : " ";

          return (
            <React.Fragment key={`line-${idx}`}>
              {/* Code line row */}
              <tr
                className={`group cursor-pointer transition-colors ${bgClass} ${isCommentTarget ? "ring-1 ring-inset ring-brand-500/40" : ""}`}
                onClick={() => lineNum !== undefined && onLineClick(filePath, lineNum)}
              >
                {/* Comment button + old line number */}
                <td className={`w-[32px] text-right select-none border-r border-surface-700/20 relative ${gutterBg}`}>
                  <div className="relative pr-2 py-px">
                    <span className="text-surface-500 text-[11px]">{dl.oldLineNum ?? ""}</span>
                    <button
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 rounded bg-brand-500 text-white flex items-center justify-center text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (lineNum !== undefined) onLineClick(filePath, lineNum);
                      }}
                    >
                      +
                    </button>
                  </div>
                </td>
                {/* New line number */}
                <td className={`w-[32px] text-right pr-2 select-none border-r border-surface-700/20 ${gutterBg}`}>
                  <span className="text-surface-500 text-[11px]">{dl.newLineNum ?? ""}</span>
                </td>
                {/* Code content */}
                <td className={`px-3 whitespace-pre-wrap break-all ${textColor}`}>
                  <span className="select-none text-surface-500/50 mr-1">{prefix}</span>
                  {dl.content}
                </td>
              </tr>

              {/* Inline comment form — injected RIGHT after the clicked line */}
              {isCommentTarget && (
                <tr>
                  <td colSpan={3} className="bg-brand-500/5 border-y border-brand-500/20">
                    <div className="px-4 py-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] bg-brand-500/20 text-brand-400 px-2 py-0.5 rounded font-mono">
                          Line {lineNum}
                        </span>
                        <span className="text-xs text-surface-400 font-sans">Add a comment</span>
                      </div>
                      <textarea
                        value={inlineCommentBody}
                        onChange={(e) => onCommentBodyChange(e.target.value)}
                        placeholder="Write a comment on this line..."
                        rows={2}
                        autoFocus
                        className="w-full rounded-lg border border-surface-600 bg-surface-900 px-3 py-2 text-sm text-white placeholder:text-surface-500 focus:outline-none focus:border-brand-500/60 resize-none transition-all font-sans"
                      />
                      <div className="flex justify-end gap-2 mt-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); onCancelComment(); }}
                          className="px-3 py-1.5 text-xs text-surface-400 hover:text-surface-200 transition-colors font-sans"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onSubmitComment(); }}
                          disabled={!inlineCommentBody.trim() || submittingInline}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-brand-500 text-white text-xs font-medium font-sans hover:bg-brand-400 transition-colors disabled:opacity-50"
                        >
                          {submittingInline ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                          Comment
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              )}

              {/* Existing comments on this line */}
              {hasComments && lineComments!.map((c) => {
                const isOutdated = c.commit_sha && headSha && c.commit_sha !== headSha;
                const isChangeRequest = c.comment_type === "change_request";
                return (
                <React.Fragment key={`comment-${c.id}`}>
                  <tr>
                    <td colSpan={3} className={`border-y border-surface-700/30 ${isOutdated ? "bg-yellow-500/5" : "bg-surface-800/40"}`}>
                      <div className="px-4 py-2.5">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-brand-400 to-purple-500 flex items-center justify-center text-[10px] font-bold text-white font-sans">
                            {commentInitials(c)}
                          </div>
                          <span className="text-sm font-medium text-surface-300 font-sans">
                            {commentAuthor(c)}
                          </span>
                          {isOutdated && (
                            <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded font-medium border border-yellow-500/30 font-sans">
                              Outdated
                            </span>
                          )}
                          {isChangeRequest && (
                            <span className="text-[10px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded font-medium border border-orange-500/30 font-sans">
                              Change request
                            </span>
                          )}
                          {c.is_resolved && (
                            <span className="text-[10px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded font-medium border border-green-500/30 flex items-center gap-1 font-sans">
                              <Check className="h-3 w-3" /> Resolved
                            </span>
                          )}
                          <span className="text-xs text-surface-500 font-sans ml-auto">{timeAgo(c.created_at)}</span>
                        </div>
                        <div className={`text-sm text-surface-200 whitespace-pre-wrap leading-relaxed font-sans pl-8 ${isOutdated ? "opacity-60" : ""}`}>
                          {c.body}
                        </div>
                        {/* Resolve button for change requests */}
                        {isChangeRequest && !c.is_resolved && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onResolveComment(c.id); }}
                            className="mt-2 ml-8 flex items-center gap-1.5 text-xs text-surface-400 hover:text-green-400 px-2 py-1 rounded border border-surface-700 hover:border-green-500/30 hover:bg-green-500/5 transition-all font-sans"
                          >
                            <Check className="h-3 w-3" />
                            Resolve
                          </button>
                        )}
                        {/* Replies */}
                        {comments.filter((r) => r.parent_id === c.id).map((reply) => (
                          <div key={reply.id} className="mt-1.5 ml-7 pl-3 border-l-2 border-surface-600">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center text-[9px] font-bold text-white font-sans">
                                {commentInitials(reply)}
                              </div>
                              <span className="text-xs text-surface-500 font-sans">{commentAuthor(reply)}</span>
                            </div>
                            <div className="text-sm text-surface-300 whitespace-pre-wrap font-sans">{reply.body}</div>
                          </div>
                        ))}
                        {/* Reply button & form */}
                        <div className="mt-2 pl-8">
                          {replyingTo === c.id ? (
                            <div className="space-y-2">
                              <textarea
                                value={replyBody}
                                onChange={(e) => onReplyBodyChange(e.target.value)}
                                placeholder="Write a reply..."
                                rows={2}
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                                className="w-full rounded-lg border border-surface-600 bg-surface-900 px-3 py-2 text-sm text-white placeholder:text-surface-500 focus:outline-none focus:border-brand-500/60 resize-none transition-all font-sans"
                              />
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={(e) => { e.stopPropagation(); onCancelReply(); }}
                                  className="px-3 py-1.5 text-xs text-surface-400 hover:text-surface-200 transition-colors font-sans"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); onSubmitReply(c.id); }}
                                  disabled={!replyBody.trim() || submittingReply}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-brand-500 text-white text-xs font-medium font-sans hover:bg-brand-400 transition-colors disabled:opacity-50"
                                >
                                  {submittingReply ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                                  Reply
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={(e) => { e.stopPropagation(); onReply(c.id); }}
                              className="text-xs text-surface-500 hover:text-brand-400 transition-colors font-sans"
                            >
                              ↩ Reply
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                </React.Fragment>
                );
              })}
            </React.Fragment>
          );
        })}
      </tbody>
    </table>
  );
}
