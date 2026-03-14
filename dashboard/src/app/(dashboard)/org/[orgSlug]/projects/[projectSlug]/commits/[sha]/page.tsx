"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";
import { Card } from "@/components/ui";
import {
  GitCommit,
  ArrowLeft,
  Clock,
  User,
  Copy,
  Check,
  AlertCircle,
  Plus,
  Minus,
  FileText,
  ChevronDown,
  ChevronRight,
  GitBranch,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CommitDetail {
  sha: string;
  message: string;
  author_name: string;
  author_email: string;
  committed_at: string;
  files_changed: number;
  additions: number;
  deletions: number;
  parent_shas: string[] | null;
  diff: string;
}

interface FileDiff {
  filename: string;
  oldFilename?: string;
  additions: number;
  deletions: number;
  chunks: DiffChunk[];
  isBinary: boolean;
  isNew: boolean;
  isDeleted: boolean;
  isRenamed: boolean;
}

interface DiffChunk {
  header: string;
  lines: DiffLine[];
}

interface DiffLine {
  type: "add" | "del" | "ctx" | "header";
  content: string;
  oldLine?: number;
  newLine?: number;
}

/* ------------------------------------------------------------------ */
/*  Diff Parser                                                        */
/* ------------------------------------------------------------------ */

function parseDiff(raw: string): FileDiff[] {
  if (!raw) return [];
  const files: FileDiff[] = [];
  const diffSections = raw.split(/^diff --git /m).filter(Boolean);

  for (const section of diffSections) {
    const lines = section.split("\n");
    const headerMatch = lines[0]?.match(/a\/(.+?) b\/(.+)/);
    if (!headerMatch) continue;

    const oldFile = headerMatch[1];
    const newFile = headerMatch[2];
    const isRenamed = oldFile !== newFile;
    const isNew = lines.some((l) => l.startsWith("new file mode"));
    const isDeleted = lines.some((l) => l.startsWith("deleted file mode"));
    const isBinary = lines.some((l) => l.includes("Binary files"));

    const chunks: DiffChunk[] = [];
    let currentChunk: DiffChunk | null = null;
    let oldLine = 0;
    let newLine = 0;

    for (const line of lines) {
      if (line.startsWith("@@")) {
        const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)/);
        if (match) {
          currentChunk = { header: line, lines: [] };
          chunks.push(currentChunk);
          oldLine = parseInt(match[1], 10);
          newLine = parseInt(match[2], 10);
        }
        continue;
      }

      if (!currentChunk) continue;

      if (line.startsWith("+")) {
        currentChunk.lines.push({ type: "add", content: line.slice(1), newLine: newLine++ });
      } else if (line.startsWith("-")) {
        currentChunk.lines.push({ type: "del", content: line.slice(1), oldLine: oldLine++ });
      } else if (line.startsWith(" ") || line === "") {
        currentChunk.lines.push({ type: "ctx", content: line.slice(1) || "", oldLine: oldLine++, newLine: newLine++ });
      }
    }

    let additions = 0;
    let deletions = 0;
    for (const chunk of chunks) {
      for (const l of chunk.lines) {
        if (l.type === "add") additions++;
        if (l.type === "del") deletions++;
      }
    }

    files.push({
      filename: newFile,
      oldFilename: isRenamed ? oldFile : undefined,
      additions,
      deletions,
      chunks,
      isBinary,
      isNew,
      isDeleted,
      isRenamed,
    });
  }

  return files;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
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

export default function CommitDetailPage() {
  const params = useParams<{ orgSlug: string; projectSlug: string; sha: string }>();
  const router = useRouter();
  const { currentOrg } = useAuthStore();

  const [commit, setCommit] = useState<CommitDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedSha, setCopiedSha] = useState(false);
  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(new Set());

  const orgId = currentOrg?.slug === params.orgSlug ? currentOrg?.id : undefined;
  const projectSlug = params.projectSlug;
  const sha = params.sha;

  useEffect(() => {
    if (!orgId || !sha) return;
    setLoading(true);
    setError(null);
    api
      .get<CommitDetail>(
        `/api/v1/organizations/${orgId}/projects/${projectSlug}/code/commits/${sha}`
      )
      .then((data) => {
        setCommit(data);
        setLoading(false);
      })
      .catch(() => {
        setError("Could not load commit details.");
        setLoading(false);
      });
  }, [orgId, projectSlug, sha]);

  const fileDiffs = useMemo(() => (commit ? parseDiff(commit.diff) : []), [commit]);

  const toggleFile = useCallback((filename: string) => {
    setCollapsedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(filename)) next.delete(filename);
      else next.add(filename);
      return next;
    });
  }, []);

  const handleCopySha = () => {
    if (!commit) return;
    navigator.clipboard.writeText(commit.sha);
    setCopiedSha(true);
    setTimeout(() => setCopiedSha(false), 2000);
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
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-surface-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to commits
      </button>

      {/* Loading */}
      {loading && (
        <Card className="!p-8">
          <div className="flex items-center justify-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />
            <span className="text-surface-400 text-sm">Loading commit...</span>
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

      {/* Commit Info */}
      {commit && (
        <>
          <Card className="!p-5">
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <div
                className={`h-10 w-10 rounded-full ${getAvatarColor(commit.author_name)} flex items-center justify-center text-white text-sm font-bold shrink-0`}
              >
                {commit.author_name
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                {/* Message */}
                <h1 className="text-lg font-bold text-white leading-snug">
                  {commit.message.split("\n")[0]}
                </h1>
                {commit.message.includes("\n") && (
                  <pre className="text-sm text-surface-400 mt-2 whitespace-pre-wrap font-sans">
                    {commit.message.split("\n").slice(1).join("\n").trim()}
                  </pre>
                )}

                {/* Meta */}
                <div className="flex items-center gap-4 mt-3 text-sm text-surface-400 flex-wrap">
                  <span className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" />
                    <span className="text-surface-200 font-medium">{commit.author_name}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    <span title={formatDate(commit.committed_at)}>{timeAgo(commit.committed_at)}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <GitCommit className="h-3.5 w-3.5" />
                    <button
                      onClick={handleCopySha}
                      className="flex items-center gap-1 px-2 py-0.5 rounded border border-surface-600 bg-surface-800 hover:bg-surface-700 transition-colors"
                      title="Copy full SHA"
                    >
                      <code className="text-xs text-brand-400 font-mono">{commit.sha.slice(0, 7)}</code>
                      {copiedSha ? (
                        <Check className="h-3 w-3 text-green-400" />
                      ) : (
                        <Copy className="h-3 w-3 text-surface-500" />
                      )}
                    </button>
                  </span>
                </div>

                {/* Parents */}
                {commit.parent_shas && commit.parent_shas.length > 0 && (
                  <div className="flex items-center gap-2 mt-2 text-xs text-surface-500">
                    <GitBranch className="h-3 w-3" />
                    <span>{commit.parent_shas.length} parent{commit.parent_shas.length > 1 ? "s" : ""}:</span>
                    {commit.parent_shas.map((p) => (
                      <button
                        key={p}
                        onClick={() =>
                          router.push(
                            `/org/${params.orgSlug}/projects/${projectSlug}/commits/${p}`
                          )
                        }
                        className="font-mono text-brand-400 hover:underline"
                      >
                        {p.slice(0, 7)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* Stats Bar */}
          <div className="flex items-center gap-4 text-sm">
            <span className="flex items-center gap-1.5 text-surface-400">
              <FileText className="h-4 w-4" />
              <span className="text-white font-medium">{fileDiffs.length}</span> file{fileDiffs.length !== 1 ? "s" : ""} changed
            </span>
            <span className="flex items-center gap-1 text-green-400">
              <Plus className="h-3.5 w-3.5" />
              {commit.additions.toLocaleString()} addition{commit.additions !== 1 ? "s" : ""}
            </span>
            <span className="flex items-center gap-1 text-red-400">
              <Minus className="h-3.5 w-3.5" />
              {commit.deletions.toLocaleString()} deletion{commit.deletions !== 1 ? "s" : ""}
            </span>
          </div>

          {/* File Diffs */}
          <div className="space-y-3">
            {fileDiffs.map((file) => {
              const isCollapsed = collapsedFiles.has(file.filename);
              return (
                <Card key={file.filename} className="!p-0 overflow-hidden">
                  {/* File header */}
                  <button
                    onClick={() => toggleFile(file.filename)}
                    className="flex items-center gap-2 w-full px-4 py-2.5 text-sm hover:bg-surface-800/60 transition-colors border-b border-surface-700/50"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="h-3.5 w-3.5 text-surface-500 shrink-0" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 text-surface-500 shrink-0" />
                    )}
                    <FileText className="h-3.5 w-3.5 text-surface-500 shrink-0" />
                    <span className="font-mono text-surface-200 truncate text-left">
                      {file.isRenamed && file.oldFilename ? (
                        <>
                          <span className="text-red-400 line-through">{file.oldFilename}</span>
                          {" → "}
                        </>
                      ) : null}
                      {file.filename}
                    </span>
                    <div className="flex items-center gap-2 ml-auto shrink-0">
                      {file.isNew && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 border border-green-500/20">NEW</span>
                      )}
                      {file.isDeleted && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/20">DELETED</span>
                      )}
                      {file.isRenamed && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/20">RENAMED</span>
                      )}
                      {file.additions > 0 && (
                        <span className="text-xs text-green-400">+{file.additions}</span>
                      )}
                      {file.deletions > 0 && (
                        <span className="text-xs text-red-400">-{file.deletions}</span>
                      )}
                    </div>
                  </button>

                  {/* Diff content */}
                  {!isCollapsed && (
                    <div className="overflow-x-auto">
                      {file.isBinary ? (
                        <div className="px-4 py-6 text-center text-sm text-surface-500">
                          Binary file not shown
                        </div>
                      ) : (
                        <table className="w-full text-xs font-mono border-collapse">
                          <tbody>
                            {file.chunks.map((chunk, ci) => (
                              <React.Fragment key={ci}>
                                {/* Chunk header */}
                                <tr className="bg-blue-500/5">
                                  <td
                                    colSpan={3}
                                    className="px-4 py-1.5 text-blue-400/80 text-xs border-b border-surface-700/30"
                                  >
                                    {chunk.header}
                                  </td>
                                </tr>
                                {/* Lines */}
                                {chunk.lines.map((line, li) => (
                                  <tr
                                    key={li}
                                    className={
                                      line.type === "add"
                                        ? "bg-green-500/8 hover:bg-green-500/15"
                                        : line.type === "del"
                                        ? "bg-red-500/8 hover:bg-red-500/15"
                                        : "hover:bg-surface-800/40"
                                    }
                                  >
                                    <td className="w-10 px-2 py-0 text-right text-surface-600 select-none border-r border-surface-700/30 align-top">
                                      {line.type !== "add" ? line.oldLine : ""}
                                    </td>
                                    <td className="w-10 px-2 py-0 text-right text-surface-600 select-none border-r border-surface-700/30 align-top">
                                      {line.type !== "del" ? line.newLine : ""}
                                    </td>
                                    <td className="px-3 py-0 whitespace-pre-wrap break-all">
                                      <span
                                        className={
                                          line.type === "add"
                                            ? "text-green-300"
                                            : line.type === "del"
                                            ? "text-red-300"
                                            : "text-surface-300"
                                        }
                                      >
                                        <span className="select-none text-surface-600 inline-block w-4">
                                          {line.type === "add" ? "+" : line.type === "del" ? "-" : " "}
                                        </span>
                                        {line.content}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </React.Fragment>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>

          {/* Empty diff */}
          {fileDiffs.length === 0 && commit.diff === "" && (
            <Card className="!p-8">
              <div className="flex flex-col items-center justify-center gap-2 text-center">
                <FileText className="h-8 w-8 text-surface-600" />
                <p className="text-surface-400 text-sm">No file changes in this commit.</p>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
