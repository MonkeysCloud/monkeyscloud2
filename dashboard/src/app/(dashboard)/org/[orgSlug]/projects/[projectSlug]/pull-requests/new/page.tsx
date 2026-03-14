"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";
import { Card } from "@/components/ui";
import dynamic from "next/dynamic";

const RichTextEditor = dynamic(() => import("@/components/ui/RichTextEditor"), {
  ssr: false,
  loading: () => (
    <div className="h-32 rounded-lg border border-surface-600 bg-surface-900 animate-pulse" />
  ),
});
import {
  GitPullRequest,
  GitBranch,
  GitCommit,
  ArrowRight,
  Search,
  Loader2,
  AlertCircle,
  Check,
  ChevronRight,
  ChevronDown,
  FileCode,
  FilePlus,
  FileX,
  FilePen,
  Plus,
  Minus,
  Columns2,
  Rows3,
  Folder,
  FolderOpen,
} from "lucide-react";

// Dynamic import to avoid SSR issues with react-diff-viewer
const ReactDiffViewer = dynamic(() => import("react-diff-viewer-continued"), {
  ssr: false,
  loading: () => (
    <div className="p-4 text-surface-500 text-xs">Loading diff viewer...</div>
  ),
});

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface BranchInfo {
  name: string;
  commit_sha: string;
  is_default: boolean;
  updated_at: string;
}

interface CompareFile {
  path: string;
  additions: number;
  deletions: number;
  status: "added" | "modified" | "deleted" | "renamed";
}

interface CommitInfo {
  sha: string;
  message: string;
  author_name: string;
  author_email: string;
  date: string;
}

interface CompareData {
  commits: CommitInfo[];
  commit_count: number;
  files: CompareFile[];
  file_count: number;
  additions: number;
  deletions: number;
  diff: string;
  suggested_title: string;
  suggested_description: string;
}

/** Per-file parsed diff with reconstructed old/new content */
interface FileDiff {
  path: string;
  status: "added" | "modified" | "deleted" | "renamed";
  additions: number;
  deletions: number;
  oldValue: string;
  newValue: string;
}

/* ------------------------------------------------------------------ */
/*  Parse unified diff into per-file old/new content                   */
/* ------------------------------------------------------------------ */

function parseDiffByFile(rawDiff: string, files: CompareFile[]): FileDiff[] {
  if (!rawDiff) return [];

  const fileDiffs: FileDiff[] = [];
  // Split into per-file chunks
  const fileChunks = rawDiff.split(/^diff --git /m).filter(Boolean);

  for (const chunk of fileChunks) {
    const lines = chunk.split("\n");
    // Extract filename from first line: a/path b/path
    const headerMatch = lines[0]?.match(/ b\/(.+)$/);
    // Skip chunks that don't have a valid file path (e.g. content before first diff)
    if (!headerMatch) continue;
    const path = headerMatch[1];
    const fileInfo = files.find((f) => f.path === path);

    const oldLines: string[] = [];
    const newLines: string[] = [];
    let inHunk = false;

    for (const line of lines) {
      // Skip metadata lines
      if (
        line.startsWith("a/") ||
        line.startsWith("index ") ||
        line.startsWith("new file") ||
        line.startsWith("deleted file") ||
        line.startsWith("similarity") ||
        line.startsWith("rename from") ||
        line.startsWith("rename to") ||
        line.startsWith("---") ||
        line.startsWith("+++")
      ) {
        continue;
      }

      if (line.startsWith("@@")) {
        inHunk = true;
        continue;
      }

      if (!inHunk) continue;

      if (line.startsWith("+")) {
        newLines.push(line.substring(1));
      } else if (line.startsWith("-")) {
        oldLines.push(line.substring(1));
      } else {
        // Context line (starts with space or is empty)
        const content = line.startsWith(" ") ? line.substring(1) : line;
        oldLines.push(content);
        newLines.push(content);
      }
    }

    fileDiffs.push({
      path,
      status: fileInfo?.status ?? "modified",
      additions: fileInfo?.additions ?? 0,
      deletions: fileInfo?.deletions ?? 0,
      oldValue: oldLines.join("\n"),
      newValue: newLines.join("\n"),
    });
  }

  return fileDiffs;
}

/* ------------------------------------------------------------------ */
/*  Diff viewer theme (dark)                                           */
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
  },
  contentText: {
    fontFamily:
      'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
    fontSize: "12px",
    lineHeight: "20px",
  },
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function NewPullRequestPage() {
  const params = useParams<{ orgSlug: string; projectSlug: string }>();
  const router = useRouter();
  const { currentOrg } = useAuthStore();

  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [sourceBranch, setSourceBranch] = useState("");
  const [targetBranch, setTargetBranch] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Compare data
  const [compareData, setCompareData] = useState<CompareData | null>(null);
  const [loadingCompare, setLoadingCompare] = useState(false);
  const [titleTouched, setTitleTouched] = useState(false);
  const [descTouched, setDescTouched] = useState(false);

  // Per-file diff state
  const [fileDiffs, setFileDiffs] = useState<FileDiff[]>([]);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [splitView, setSplitView] = useState(false);
  const fileRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const orgId = currentOrg?.slug === params.orgSlug ? currentOrg?.id : undefined;
  const projectSlug = params.projectSlug;

  // Fetch branches
  useEffect(() => {
    if (!orgId) return;
    api
      .get<BranchInfo[]>(
        `/api/v1/organizations/${orgId}/projects/${projectSlug}/code/branches`
      )
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setBranches(list);
        const def = list.find((b) => b.is_default);
        if (def) setTargetBranch(def.name);
      })
      .catch(() => {});
  }, [orgId, projectSlug]);

  // Fetch compare data
  useEffect(() => {
    if (
      !orgId ||
      !sourceBranch ||
      !targetBranch ||
      sourceBranch === targetBranch
    ) {
      setCompareData(null);
      setFileDiffs([]);
      setExpandedFiles(new Set());
      setActiveFile(null);
      return;
    }

    setLoadingCompare(true);
    api
      .get<CompareData>(
        `/api/v1/organizations/${orgId}/projects/${projectSlug}/code/compare?base=${encodeURIComponent(targetBranch)}&head=${encodeURIComponent(sourceBranch)}`
      )
      .then((data) => {
        setCompareData(data);

        const diffs = parseDiffByFile(data.diff || "", data.files || []);
        setFileDiffs(diffs);

        // Expand first file
        if (diffs.length > 0) {
          setExpandedFiles(new Set([diffs[0].path]));
          setActiveFile(diffs[0].path);
        }

        if (!titleTouched && data.suggested_title) setTitle(data.suggested_title);
        if (!descTouched && data.suggested_description)
          setDescription(data.suggested_description);
      })
      .catch(() => {
        setCompareData(null);
        setFileDiffs([]);
      })
      .finally(() => setLoadingCompare(false));
  }, [orgId, projectSlug, sourceBranch, targetBranch]);

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

  const handleCreate = async () => {
    if (!orgId || !title.trim() || !sourceBranch || !targetBranch) return;
    setCreating(true);
    setError(null);
    try {
      const res = await api.post<{ number: number }>(
        `/api/v1/organizations/${orgId}/projects/${projectSlug}/pull-requests`,
        {
          title: title.trim(),
          description: description.trim() || null,
          source_branch: sourceBranch,
          target_branch: targetBranch,
        }
      );
      router.push(
        `/org/${params.orgSlug}/projects/${projectSlug}/pull-requests/${res.number}`
      );
    } catch (err: any) {
      setError(err?.message || "Could not create pull request.");
    }
    setCreating(false);
  };

  if (!currentOrg) {
    return (
      <div className="flex items-center justify-center h-64 text-surface-400">
        Loading...
      </div>
    );
  }

  const canCreate =
    title.trim() &&
    sourceBranch &&
    targetBranch &&
    sourceBranch !== targetBranch;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
          <GitPullRequest className="h-6 w-6 text-brand-400" />
          New Pull Request
        </h1>
        <p className="text-sm text-surface-400 mt-1">
          Compare changes between branches and create a pull request.
        </p>
      </div>

      {/* Branch selectors */}
      <Card className="!p-5 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Source — the branch with changes (FROM) */}
          <div className="flex-1 min-w-[180px] max-w-xs">
            <label className="block text-xs font-semibold text-surface-400 uppercase tracking-wider mb-1.5">
              From
            </label>
            <BranchPicker
              branches={branches}
              selected={sourceBranch}
              onSelect={(b) => {
                setSourceBranch(b);
                setTitleTouched(false);
                setDescTouched(false);
              }}
              placeholder="Select branch..."
            />
          </div>

          <ArrowRight className="h-5 w-5 text-surface-500 mt-5 shrink-0" />

          {/* Target — where changes merge INTO */}
          <div className="flex-1 min-w-[180px] max-w-xs">
            <label className="block text-xs font-semibold text-surface-400 uppercase tracking-wider mb-1.5">
              Into
            </label>
            <BranchPicker
              branches={branches}
              selected={targetBranch}
              onSelect={setTargetBranch}
            />
          </div>
        </div>

        {sourceBranch && targetBranch && sourceBranch === targetBranch && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm">
            <AlertCircle className="h-4 w-4" />
            Source and target branches must be different.
          </div>
        )}

        {loadingCompare && (
          <div className="flex items-center gap-2 text-sm text-surface-400 border-t border-surface-700 pt-3">
            <Loader2 className="h-4 w-4 animate-spin" />
            Comparing branches...
          </div>
        )}

        {compareData && !loadingCompare && (
          <div className="flex items-center gap-4 text-xs border-t border-surface-700 pt-3 flex-wrap">
            <span className="flex items-center gap-1.5 text-surface-300">
              <GitCommit className="h-3.5 w-3.5 text-brand-400" />
              <strong>{compareData.commit_count}</strong> commit
              {compareData.commit_count !== 1 ? "s" : ""}
            </span>
            <span className="flex items-center gap-1.5 text-surface-300">
              <FileCode className="h-3.5 w-3.5 text-blue-400" />
              <strong>{compareData.file_count}</strong> file
              {compareData.file_count !== 1 ? "s" : ""} changed
            </span>
            <span className="flex items-center gap-1 text-green-400">
              <Plus className="h-3 w-3" />
              {compareData.additions}
            </span>
            <span className="flex items-center gap-1 text-red-400">
              <Minus className="h-3 w-3" />
              {compareData.deletions}
            </span>

            {/* View mode toggle */}
            <div className="ml-auto flex items-center gap-1 bg-surface-800 rounded-lg p-0.5">
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
      </Card>

      {/* Main content: two-column layout */}
      {sourceBranch &&
        targetBranch &&
        sourceBranch !== targetBranch &&
        !loadingCompare && (
          <div className="flex gap-5 items-start">
            {/* LEFT — Form + Commits + Per-file Diffs */}
            <div className="flex-1 min-w-0 space-y-5">
              {/* PR title & description */}
              <Card className="!p-5 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-1.5">
                    Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      setTitleTouched(true);
                    }}
                    placeholder="Pull request title"
                    className="w-full px-3 py-2 rounded-lg border border-surface-600 bg-surface-900 text-sm text-white placeholder:text-surface-500 focus:outline-none focus:border-brand-500/60 focus:ring-1 focus:ring-brand-500/30 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-surface-300 mb-1.5">
                    Description
                    <span className="text-surface-500 font-normal ml-1">
                      (optional)
                    </span>
                  </label>
                  <RichTextEditor
                    content={description}
                    onChange={(html: string) => {
                      setDescription(html);
                      setDescTouched(true);
                    }}
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {error}
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    onClick={() => router.back()}
                    className="px-4 py-2 rounded-lg border border-surface-600 text-sm text-surface-300 hover:bg-surface-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreate}
                    disabled={!canCreate || creating}
                    className="flex items-center gap-2 px-5 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {creating && <Loader2 className="h-4 w-4 animate-spin" />}
                    Create pull request
                  </button>
                </div>
              </Card>

              {/* Commits */}
              {compareData && compareData.commits.length > 0 && (
                <Card className="!p-0 overflow-hidden">
                  <div className="px-4 py-3 border-b border-surface-700 flex items-center gap-2">
                    <GitCommit className="h-4 w-4 text-brand-400" />
                    <span className="text-sm font-medium text-white">
                      Commits
                    </span>
                    <span className="text-xs text-surface-500">
                      ({compareData.commit_count})
                    </span>
                  </div>
                  <div className="divide-y divide-surface-700/50">
                    {compareData.commits.map((c) => (
                      <div
                        key={c.sha}
                        className="px-4 py-2.5 flex items-start gap-3 hover:bg-surface-800/50 transition-colors"
                      >
                        <code className="text-xs text-brand-400 font-mono mt-0.5 shrink-0">
                          {c.sha?.slice(0, 7)}
                        </code>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-surface-200 truncate">
                            {c.message?.split("\n")[0]}
                          </p>
                          <p className="text-xs text-surface-500 mt-0.5">
                            {c.author_name}{" "}
                            {c.date &&
                              `· ${new Date(c.date).toLocaleDateString()}`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Per-file diffs using react-diff-viewer */}
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
                      <FileStatusIcon status={fd.status} />
                      <span className="text-sm text-surface-200 font-mono truncate flex-1">
                        {fd.path}
                      </span>
                      <div className="flex items-center gap-2 text-xs shrink-0">
                        {fd.additions > 0 && (
                          <span className="text-green-400">+{fd.additions}</span>
                        )}
                        {fd.deletions > 0 && (
                          <span className="text-red-400">-{fd.deletions}</span>
                        )}
                        <DiffBar
                          additions={fd.additions}
                          deletions={fd.deletions}
                        />
                      </div>
                    </button>

                    {/* Diff content */}
                    {expandedFiles.has(fd.path) && (
                      <div className="border-t border-surface-700 overflow-auto max-h-[700px]">
                        <ReactDiffViewer
                          oldValue={fd.oldValue}
                          newValue={fd.newValue}
                          splitView={splitView}
                          useDarkTheme={true}
                          styles={diffStyles}
                          hideLineNumbers={false}
                          showDiffOnly={true}
                          extraLinesSurroundingDiff={3}
                        />
                      </div>
                    )}
                  </Card>
                </div>
              ))}

              {/* Empty state */}
              {compareData &&
                compareData.commit_count === 0 &&
                compareData.file_count === 0 && (
                  <Card className="!p-8 text-center">
                    <Check className="h-8 w-8 text-green-400 mx-auto mb-2" />
                    <p className="text-surface-300 text-sm">
                      <strong>{targetBranch}</strong> is up to date with{" "}
                      <strong>{sourceBranch}</strong>
                    </p>
                    <p className="text-surface-500 text-xs mt-1">
                      There are no changes to compare.
                    </p>
                  </Card>
                )}
            </div>

            {/* RIGHT — File tree sidebar (sticky) */}
            {compareData && compareData.files.length > 0 && (
              <div className="w-72 shrink-0 sticky top-4">
                <Card className="!p-0 overflow-hidden">
                  <div className="px-3 py-2.5 border-b border-surface-700 flex items-center gap-2">
                    <FileCode className="h-3.5 w-3.5 text-blue-400" />
                    <span className="text-xs font-semibold text-surface-300 uppercase tracking-wider">
                      Files
                    </span>
                    <span className="text-[10px] text-surface-500 ml-auto">
                      {compareData.file_count}
                    </span>
                  </div>
                  <div className="max-h-[70vh] overflow-y-auto py-1">
                    <FileTreeSidebar
                      files={compareData.files}
                      activeFile={activeFile}
                      onNavigate={navigateToFile}
                    />
                  </div>
                </Card>
              </div>
            )}
          </div>
        )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  File status icon                                                    */
/* ------------------------------------------------------------------ */

function FileStatusIcon({
  status,
  size = 16,
}: {
  status: "added" | "modified" | "deleted" | "renamed";
  size?: number;
}) {
  const s = { width: size, height: size };
  switch (status) {
    case "added":
      return <FilePlus style={s} className="text-green-400 shrink-0" />;
    case "deleted":
      return <FileX style={s} className="text-red-400 shrink-0" />;
    case "renamed":
      return <FilePen style={s} className="text-yellow-400 shrink-0" />;
    default:
      return <FilePen style={s} className="text-blue-400 shrink-0" />;
  }
}

/* ------------------------------------------------------------------ */
/*  Diff bar                                                            */
/* ------------------------------------------------------------------ */

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
/*  BranchPicker                                                       */
/* ------------------------------------------------------------------ */

function BranchPicker({
  branches,
  selected,
  onSelect,
  placeholder = "Select branch...",
}: {
  branches: BranchInfo[];
  selected: string;
  onSelect: (name: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    const list = q
      ? branches.filter((b) => b.name.toLowerCase().includes(q))
      : branches;
    return list.slice(0, 15);
  }, [branches, query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-surface-600 bg-surface-900 text-sm text-white hover:border-brand-500/60 transition-all"
      >
        <span className="flex items-center gap-2 truncate">
          <GitBranch className="h-3.5 w-3.5 text-brand-400 shrink-0" />
          {selected || (
            <span className="text-surface-500">{placeholder}</span>
          )}
        </span>
        <ChevronRight
          className={`h-3.5 w-3.5 text-surface-400 transition-transform ${open ? "rotate-90" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 w-full rounded-lg border border-surface-600 bg-surface-800 shadow-xl overflow-hidden">
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
          <div className="max-h-48 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-xs text-surface-500 text-center">
                No branches found
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
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  File tree sidebar (grouped by folders)                             */
/* ------------------------------------------------------------------ */

interface FolderNode {
  name: string;
  files: { path: string; basename: string; status: string; additions: number; deletions: number }[];
  children: Map<string, FolderNode>;
}

function buildFileTree(
  files: { path: string; status: string; additions: number; deletions: number }[]
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

    current.files.push({ path: f.path, basename, status: f.status, additions: f.additions, deletions: f.deletions });
  }

  return root;
}

function FileTreeSidebar({
  files,
  activeFile,
  onNavigate,
}: {
  files: { path: string; status: string; additions: number; deletions: number }[];
  activeFile: string | null;
  onNavigate: (path: string) => void;
}) {
  const tree = useMemo(() => buildFileTree(files), [files]);

  return (
    <div>
      {tree.files.map((f) => (
        <SidebarFileItem key={f.path} file={f} activeFile={activeFile} onNavigate={onNavigate} depth={0} />
      ))}
      {Array.from(tree.children.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, node]) => (
          <SidebarFolderNode key={node.name} node={node} activeFile={activeFile} onNavigate={onNavigate} depth={0} prefix="" />
        ))}
    </div>
  );
}

function SidebarFolderNode({
  node, activeFile, onNavigate, depth, prefix,
}: {
  node: FolderNode; activeFile: string | null; onNavigate: (p: string) => void; depth: number; prefix: string;
}) {
  const [open, setOpen] = useState(true);
  const folderPath = prefix ? `${prefix}/${node.name}` : node.name;
  const countFiles = (n: FolderNode): number =>
    n.files.length + Array.from(n.children.values()).reduce((s, c) => s + countFiles(c), 0);
  const total = countFiles(node);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left px-2 py-1.5 flex items-center gap-1.5 text-xs text-surface-400 hover:text-surface-200 hover:bg-surface-800/50 transition-colors"
        style={{ paddingLeft: `${8 + depth * 12}px` }}
      >
        {open ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
        {open ? <FolderOpen className="h-3.5 w-3.5 text-blue-400 shrink-0" /> : <Folder className="h-3.5 w-3.5 text-blue-400 shrink-0" />}
        <span className="font-medium truncate">{node.name}</span>
        <span className="text-[10px] text-surface-600 ml-auto shrink-0">{total}</span>
      </button>
      {open && (
        <div>
          {node.files.map((f) => (
            <SidebarFileItem key={f.path} file={f} activeFile={activeFile} onNavigate={onNavigate} depth={depth + 1} />
          ))}
          {Array.from(node.children.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([, child]) => (
              <SidebarFolderNode key={child.name} node={child} activeFile={activeFile} onNavigate={onNavigate} depth={depth + 1} prefix={folderPath} />
            ))}
        </div>
      )}
    </div>
  );
}

function SidebarFileItem({
  file, activeFile, onNavigate, depth,
}: {
  file: { path: string; basename: string; status: string; additions: number; deletions: number };
  activeFile: string | null; onNavigate: (p: string) => void; depth: number;
}) {
  const isActive = activeFile === file.path;
  return (
    <button
      onClick={() => onNavigate(file.path)}
      className={`w-full text-left py-1.5 pr-2 flex items-center gap-1.5 transition-colors text-xs ${
        isActive ? "bg-brand-500/10 border-l-2 border-brand-400" : "hover:bg-surface-800/50 border-l-2 border-transparent"
      }`}
      style={{ paddingLeft: `${8 + (depth + 1) * 12}px` }}
      title={file.path}
    >
      <FileStatusIcon status={file.status as any} size={13} />
      <span className={`font-mono truncate flex-1 ${isActive ? "text-brand-300" : "text-surface-300"}`}>
        {file.basename}
      </span>
      <div className="flex items-center gap-1 text-[10px] shrink-0">
        {file.additions > 0 && <span className="text-green-400">+{file.additions}</span>}
        {file.deletions > 0 && <span className="text-red-400">-{file.deletions}</span>}
      </div>
    </button>
  );
}
