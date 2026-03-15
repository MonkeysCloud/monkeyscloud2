"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";
import { Card } from "@/components/ui";
import {
  GitBranch,
  Tag,
  ChevronDown,
  Folder,
  FileText,
  ChevronRight,
  Download,
  Copy,
  Check,
  FileCode2,
  AlertCircle,
  Image as ImageIcon,
  FileArchive,
  GitCommit,
  Clock,
  User,
  Terminal,
  Archive,
} from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface FileEntry {
  name: string;
  path: string;
  type: "file" | "dir";
  size?: number;
  mode: string;
}

interface TreeEntryCommit {
  path: string;
  sha: string;
  message: string;
  author_name: string;
  date: string;
}

interface BranchInfo {
  name: string;
  commit_sha: string;
  is_default: boolean;
  updated_at: string;
}

interface TagInfo {
  name: string;
  sha: string;
  message: string;
  is_annotated: boolean;
}

interface CommitInfo {
  sha: string;
  message: string;
  author_name: string;
  author_email: string;
  committed_at: string;
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

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "ico", "bmp"]);
const BINARY_EXTS = new Set([
  "pdf", "zip", "gz", "tar", "rar", "7z", "bz2",
  "exe", "dll", "so", "dylib", "bin",
  "mp3", "mp4", "wav", "avi", "mov", "mkv", "flv",
  "woff", "woff2", "ttf", "eot", "otf",
  "doc", "docx", "xls", "xlsx", "ppt", "pptx",
  "sqlite", "db",
]);

function getExt(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() ?? "";
}

function isImageFile(filename: string): boolean {
  return IMAGE_EXTS.has(getExt(filename));
}

function isBinaryFile(filename: string): boolean {
  return BINARY_EXTS.has(getExt(filename)) || isImageFile(filename);
}

function isMarkdownFile(filename: string): boolean {
  const ext = getExt(filename);
  return ext === "md" || ext === "mdx";
}

/** Map file extension to Prism language key */
function extToLanguage(filename: string): string {
  const ext = getExt(filename);
  const map: Record<string, string> = {
    js: "javascript", jsx: "jsx", ts: "typescript", tsx: "tsx",
    py: "python", rb: "ruby", go: "go", rs: "rust", java: "java",
    php: "php", cs: "csharp", cpp: "cpp", c: "c", h: "c",
    swift: "swift", kt: "kotlin", scala: "scala",
    html: "html", css: "css", scss: "scss", less: "less",
    json: "json", yaml: "yaml", yml: "yaml", toml: "toml",
    xml: "xml", sql: "sql", sh: "bash", bash: "bash", zsh: "bash",
    md: "markdown", mdx: "markdown",
    dockerfile: "docker", makefile: "makefile",
    tf: "hcl", proto: "protobuf",
    graphql: "graphql", gql: "graphql",
    env: "bash", gitignore: "bash",
  };
  const basename = filename.toLowerCase();
  if (basename === "dockerfile" || basename.startsWith("dockerfile.")) return "docker";
  if (basename === "makefile") return "makefile";
  return map[ext] || "text";
}

/** Format bytes to human-readable */
function formatSize(bytes?: number): string {
  if (bytes === undefined || bytes === null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function CodePage() {
  const params = useParams<{ orgSlug: string; projectSlug: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { currentOrg } = useAuthStore();

  // State derived from URL query params
  const currentRef = searchParams.get("ref") || "main";
  const currentPath = searchParams.get("path") || "";

  const [branches, setBranches] = useState<BranchInfo[]>([]);
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [branchDropdownOpen, setBranchDropdownOpen] = useState(false);
  const [branchSearch, setBranchSearch] = useState("");
  const [refTab, setRefTab] = useState<"branches" | "tags">("branches");
  const [tags, setTags] = useState<TagInfo[]>([]);
  const [copied, setCopied] = useState(false);
  const [cloneCopied, setCloneCopied] = useState(false);
  const [viewMode, setViewMode] = useState<"code" | "raw">("code");
  const [isLargeFile, setIsLargeFile] = useState(false);
  const [readmeContent, setReadmeContent] = useState<string | null>(null);
  const [lastCommit, setLastCommit] = useState<CommitInfo | null>(null);
  const [showCloneMenu, setShowCloneMenu] = useState(false);
  const [cloneTab, setCloneTab] = useState<"https" | "ssh">("https");
  const [treeCommits, setTreeCommits] = useState<Record<string, TreeEntryCommit>>({});

  // Only use orgId when it matches the URL slug (prevents stale org ID in API calls)
  const orgId = currentOrg?.slug === params.orgSlug ? currentOrg?.id : undefined;
  const projectSlug = params.projectSlug;
  const gitBaseUrl = process.env.NEXT_PUBLIC_GIT_URL || "http://localhost:3001";
  const cloneUrl = `${gitBaseUrl}/${params.orgSlug}/${projectSlug}.git`;
  const sshHost = process.env.NEXT_PUBLIC_SSH_HOST || gitBaseUrl.replace(/^https?:\/\//, '');
  const sshCloneUrl = `git@${sshHost}:${params.orgSlug}/${projectSlug}.git`;

  // Determine what we're viewing
  const isViewingFile = fileContent !== null;
  const fileName = currentPath.split("/").pop() || "";
  const fileIsImage = isImageFile(fileName);
  const fileIsBinary = isBinaryFile(fileName);
  const fileIsMarkdown = isMarkdownFile(fileName);

  const apiBase = typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000")
    : "http://localhost:8000";

  // Build the blob URL for image rendering and downloads
  const blobUrl = orgId
    ? `${apiBase}/api/v1/organizations/${orgId}/projects/${projectSlug}/code/blob?ref=${encodeURIComponent(currentRef)}&path=${encodeURIComponent(currentPath)}`
    : "";

  // Breadcrumb segments
  const pathSegments = useMemo(() => {
    if (!currentPath) return [];
    return currentPath.split("/").filter(Boolean);
  }, [currentPath]);

  // Navigate helper — updates URL search params
  const navigate = useCallback(
    (ref: string, path: string) => {
      const sp = new URLSearchParams();
      if (ref && ref !== "main") sp.set("ref", ref);
      if (path) sp.set("path", path);
      const qs = sp.toString();
      router.push(
        `/org/${params.orgSlug}/projects/${projectSlug}/code${qs ? `?${qs}` : ""}`
      );
    },
    [router, params.orgSlug, projectSlug]
  );

  // ---------- Fetch branches ----------
  useEffect(() => {
    if (!orgId) return;
    api
      .get<BranchInfo[]>(
        `/api/v1/organizations/${orgId}/projects/${projectSlug}/code/branches`
      )
      .then((data) => setBranches(Array.isArray(data) ? data : []))
      .catch(() => setBranches([]));
  }, [orgId, projectSlug]);

  // ---------- Fetch tags ----------
  useEffect(() => {
    if (!orgId) return;
    const token = localStorage.getItem("mc_token");
    fetch(
      `${apiBase}/api/v1/organizations/${orgId}/projects/${projectSlug}/code/tags`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} }
    )
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setTags(Array.isArray(data) ? data : []))
      .catch(() => setTags([]));
  }, [orgId, projectSlug, apiBase]);

  // ---------- Fetch last commit ----------
  useEffect(() => {
    if (!orgId) return;
    const token = localStorage.getItem("mc_token");
    fetch(
      `${apiBase}/api/v1/organizations/${orgId}/projects/${projectSlug}/code/commits?branch=${encodeURIComponent(currentRef)}&limit=1`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} }
    )
      .then((r) => r.ok ? r.json() : [])
      .then((data: CommitInfo[]) => {
        setLastCommit(Array.isArray(data) && data.length > 0 ? data[0] : null);
      })
      .catch(() => setLastCommit(null));
  }, [orgId, projectSlug, currentRef, apiBase]);

  // ---------- Fetch tree or file ----------
  useEffect(() => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    setFileContent(null);
    setEntries([]);
    setReadmeContent(null);
    setViewMode("code");
    setIsLargeFile(false);

    const token = localStorage.getItem("mc_token");
    const base = `/api/v1/organizations/${orgId}/projects/${projectSlug}/code`;
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

    // Try loading as directory first
    api
      .get<FileEntry[]>(
        `${base}/tree?ref=${encodeURIComponent(currentRef)}&path=${encodeURIComponent(currentPath)}`
      )
      .then(async (data) => {
        const items = Array.isArray(data) ? data : [];
        if (items.length > 0) {
          // It's a directory with entries
          setEntries(items);

          // Check for README.md at root or in current dir
          const readme = items.find(
            (e) =>
              e.type === "file" &&
              e.name.toLowerCase().startsWith("readme")
          );
          if (readme) {
            try {
              const res = await fetch(
                `${apiBase}${base}/blob?ref=${encodeURIComponent(currentRef)}&path=${encodeURIComponent(readme.path)}`,
                { headers }
              );
              if (res.ok) {
                setReadmeContent(await res.text());
              }
            } catch {
              // Silently ignore README fetch failures
            }
          }
          setLoading(false);
        } else if (currentPath) {
          // Empty result + path = likely a file

          // For images and binary files, don't fetch text content
          const targetFile = currentPath.split("/").pop() || "";
          if (isImageFile(targetFile)) {
            setFileContent("__image__");
            setLoading(false);
            return;
          }
          if (isBinaryFile(targetFile)) {
            setFileContent("__binary__");
            setLoading(false);
            return;
          }

          // Text file — fetch content with size check
          try {
            const res = await fetch(
              `${apiBase}${base}/blob?ref=${encodeURIComponent(currentRef)}&path=${encodeURIComponent(currentPath)}`,
              { headers }
            );
            if (res.ok) {
              const text = await res.text();

              // > 1MB: don't try to render at all
              if (text.length > 1 * 1024 * 1024) {
                setFileContent("__too_large__");
                setLoading(false);
                return;
              }

              // > 100KB: force raw mode (no syntax highlighting)
              if (text.length > 100 * 1024) {
                setViewMode("raw");
                setIsLargeFile(true);
              }

              setFileContent(text);
            } else {
              setError("Could not load file or directory.");
            }
          } catch {
            setError("Git server is not reachable.");
          }
          setLoading(false);
        } else {
          // Root is empty — repo has no commits
          setEntries([]);
          setLoading(false);
        }
      })
      .catch(() => {
        setError("Could not load files.");
        setLoading(false);
      });
  }, [orgId, projectSlug, currentRef, currentPath, apiBase]);

  // ---------- Fetch tree commits (per-file last commit) ----------
  useEffect(() => {
    if (!orgId || isViewingFile || entries.length === 0) {
      setTreeCommits({});
      return;
    }
    const token = localStorage.getItem("mc_token");
    fetch(
      `${apiBase}/api/v1/organizations/${orgId}/projects/${projectSlug}/code/tree-commits?ref=${encodeURIComponent(currentRef)}&path=${encodeURIComponent(currentPath)}`,
      { headers: token ? { Authorization: `Bearer ${token}` } : {} }
    )
      .then((r) => r.ok ? r.json() : [])
      .then((data: TreeEntryCommit[]) => {
        const map: Record<string, TreeEntryCommit> = {};
        if (Array.isArray(data)) {
          for (const tc of data) {
            map[tc.path] = tc;
          }
        }
        setTreeCommits(map);
      })
      .catch(() => setTreeCommits({}));
  }, [orgId, projectSlug, currentRef, currentPath, entries, isViewingFile, apiBase]);

  // ---------- Handlers ----------
  const handleEntryClick = (entry: FileEntry) => {
    navigate(currentRef, entry.path);
  };

  const handleBranchSelect = (branch: string) => {
    setBranchDropdownOpen(false);
    navigate(branch, "");
  };

  const handleBreadcrumb = (index: number) => {
    if (index < 0) {
      navigate(currentRef, "");
    } else {
      const newPath = pathSegments.slice(0, index + 1).join("/");
      navigate(currentRef, newPath);
    }
  };

  const handleCopy = () => {
    if (fileContent && fileContent !== "__image__" && fileContent !== "__binary__" && fileContent !== "__too_large__") {
      navigator.clipboard.writeText(fileContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    // For any file type, open a download via the blob URL
    if (blobUrl && fileName) {
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = fileName;
      const token = localStorage.getItem("mc_token");
      // For auth, we just open the URL — browser will handle download
      // Use fetch + blob for authenticated download
      fetch(blobUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then((res) => res.blob())
        .then((blob) => {
          const url = URL.createObjectURL(blob);
          a.href = url;
          a.click();
          URL.revokeObjectURL(url);
        });
    }
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
    <div className="space-y-4">
      {/* Top Bar: Branch selector + breadcrumb */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Branch Selector */}
        <div className="relative">
          <button
            onClick={() => setBranchDropdownOpen(!branchDropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-surface-600 bg-surface-800 text-sm text-white hover:border-brand-500/60 transition-colors"
          >
            <GitBranch className="h-4 w-4 text-brand-400" />
            <span className="font-medium">{currentRef}</span>
            <ChevronDown className="h-3 w-3 text-surface-400" />
          </button>

          {branchDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => { setBranchDropdownOpen(false); setBranchSearch(""); }}
              />
              <div className="absolute top-full left-0 mt-1 z-50 w-64 rounded-lg border border-surface-600 bg-surface-800 shadow-xl overflow-hidden">
                <div className="p-2 border-b border-surface-700">
                  <input
                    type="text"
                    value={branchSearch}
                    onChange={(e) => setBranchSearch(e.target.value)}
                    placeholder={refTab === "branches" ? "Filter branches..." : "Filter tags..."}
                    className="w-full px-2.5 py-1.5 rounded-md border border-surface-600 bg-surface-900 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-brand-500/60"
                    autoFocus
                  />
                </div>
                {/* Branches / Tags tabs */}
                <div className="flex border-b border-surface-700">
                  <button
                    onClick={() => { setRefTab("branches"); setBranchSearch(""); }}
                    className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
                      refTab === "branches"
                        ? "text-white border-b-2 border-brand-400"
                        : "text-surface-400 hover:text-white"
                    }`}
                  >
                    <GitBranch className="h-3 w-3" />
                    Branches
                  </button>
                  <button
                    onClick={() => { setRefTab("tags"); setBranchSearch(""); }}
                    className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 ${
                      refTab === "tags"
                        ? "text-white border-b-2 border-brand-400"
                        : "text-surface-400 hover:text-white"
                    }`}
                  >
                    <Tag className="h-3 w-3" />
                    Tags
                  </button>
                </div>
                <div className="max-h-64 overflow-y-auto py-1">
                  {refTab === "branches" ? (() => {
                    const filtered = branches
                      .filter((b) => b.name.toLowerCase().includes(branchSearch.toLowerCase()));
                    const shown = filtered.slice(0, 10);
                    const moreCount = filtered.length - shown.length;
                    return (
                      <>
                        {shown.length === 0 && (
                          <div className="px-3 py-2 text-sm text-surface-500">
                            No branches match
                          </div>
                        )}
                        {shown.map((b) => (
                          <button
                            key={b.name}
                            onClick={() => { handleBranchSelect(b.name); setBranchSearch(""); }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-700 transition-colors flex items-center gap-2 ${
                              b.name === currentRef
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
                        {moreCount > 0 && (
                          <div className="px-3 py-1.5 text-xs text-surface-500 border-t border-surface-700">
                            {moreCount} more branch{moreCount !== 1 ? "es" : ""}
                          </div>
                        )}
                      </>
                    );
                  })() : (() => {
                    const filtered = tags
                      .filter((t) => t.name.toLowerCase().includes(branchSearch.toLowerCase()));
                    const shown = filtered.slice(0, 10);
                    const moreCount = filtered.length - shown.length;
                    return (
                      <>
                        {shown.length === 0 && (
                          <div className="px-3 py-2 text-sm text-surface-500">
                            {tags.length === 0 ? "No tags yet" : "No tags match"}
                          </div>
                        )}
                        {shown.map((t) => (
                          <button
                            key={t.name}
                            onClick={() => { handleBranchSelect(t.name); setBranchSearch(""); }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-700 transition-colors flex items-center gap-2 ${
                              t.name === currentRef
                                ? "text-brand-400 bg-surface-700/50"
                                : "text-surface-200"
                            }`}
                          >
                            <Tag className="h-3.5 w-3.5" />
                            <span className="truncate">{t.name}</span>
                          </button>
                        ))}
                        {moreCount > 0 && (
                          <div className="px-3 py-1.5 text-xs text-surface-500 border-t border-surface-700">
                            {moreCount} more tag{moreCount !== 1 ? "s" : ""}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Breadcrumbs */}
        <div className="flex items-center gap-1 text-sm text-surface-400">
          <button
            onClick={() => handleBreadcrumb(-1)}
            className="hover:text-brand-400 transition-colors font-medium text-surface-200"
          >
            {projectSlug}
          </button>
          {pathSegments.map((seg, i) => (
            <span key={i} className="flex items-center gap-1">
              <ChevronRight className="h-3 w-3 text-surface-600" />
              <button
                onClick={() => handleBreadcrumb(i)}
                className={`hover:text-brand-400 transition-colors ${
                  i === pathSegments.length - 1
                    ? "text-white font-medium"
                    : "text-surface-300"
                }`}
              >
                {seg}
              </button>
            </span>
          ))}
        </div>

        {/* Clone / Download actions */}
        <div className="flex items-center gap-2 ml-auto">
          {/* Clone button */}
          <div className="relative">
            <button
              onClick={() => setShowCloneMenu(!showCloneMenu)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-surface-600 bg-surface-800 text-sm text-surface-300 hover:border-brand-500/60 transition-colors"
            >
              <Terminal className="h-3.5 w-3.5" />
              Clone
              <ChevronDown className="h-3 w-3" />
            </button>
            {showCloneMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowCloneMenu(false)} />
                <div className="absolute top-full right-0 mt-1 z-50 w-96 rounded-lg border border-surface-600 bg-surface-800 shadow-xl p-3 space-y-3">
                  {/* Protocol tabs */}
                  <div className="flex gap-1 bg-surface-900 rounded-md p-0.5">
                    <button
                      onClick={() => setCloneTab("https")}
                      className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${cloneTab === "https" ? "bg-brand-500/20 text-brand-400" : "text-surface-400 hover:text-surface-300"}`}
                    >HTTPS</button>
                    <button
                      onClick={() => setCloneTab("ssh")}
                      className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${cloneTab === "ssh" ? "bg-brand-500/20 text-brand-400" : "text-surface-400 hover:text-surface-300"}`}
                    >SSH</button>
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      readOnly
                      value={cloneTab === "https" ? cloneUrl : sshCloneUrl}
                      className="flex-1 px-2.5 py-1.5 rounded-md border border-surface-600 bg-surface-900 text-xs text-white font-mono select-all focus:outline-none"
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                    />
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(cloneTab === "https" ? cloneUrl : sshCloneUrl);
                        setCloneCopied(true);
                        setTimeout(() => setCloneCopied(false), 2000);
                      }}
                      className="p-1.5 rounded-md border border-surface-600 hover:bg-surface-700 transition-colors"
                    >
                      {cloneCopied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5 text-surface-400" />}
                    </button>
                  </div>
                  <p className="text-[10px] text-surface-500">
                    <code className="bg-surface-700 px-1 rounded">git clone {cloneTab === "https" ? `https://x-token-auth:YOUR_TOKEN@${gitBaseUrl.replace(/^https?:\/\//, '')}/${params.orgSlug}/${projectSlug}.git` : sshCloneUrl}</code>
                  </p>
                  {cloneTab === "https" && (
                    <p className="text-[10px] text-surface-500">
                      Replace <code className="bg-surface-700 px-1 rounded">YOUR_TOKEN</code> with your <a href="/account/api-keys" className="text-brand-400 hover:underline">API key</a>.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Download ZIP */}
          <button
            onClick={() => {
              window.open(
                `${apiBase}/api/v1/organizations/${orgId}/projects/${projectSlug}/code/blob?ref=${encodeURIComponent(currentRef)}&path=`,
                "_blank"
              );
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-surface-600 bg-surface-800 text-sm text-surface-300 hover:border-brand-500/60 transition-colors"
            title="Download"
          >
            <Archive className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Download</span>
          </button>
        </div>
      </div>

      {/* Last Commit Bar */}
      {lastCommit && !isViewingFile && (
        <Card className="!p-0 overflow-hidden">
          <div className="flex items-center px-4 py-2.5 text-sm bg-surface-800/50">
            <GitCommit className="h-4 w-4 text-surface-500 shrink-0 mr-2" />
            <span className="text-surface-200 font-medium truncate mr-2" title={lastCommit.message}>
              {lastCommit.message.length > 72
                ? lastCommit.message.slice(0, 72) + "..."
                : lastCommit.message}
            </span>
            <div className="flex items-center gap-3 ml-auto shrink-0 text-xs text-surface-500">
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {lastCommit.author_name}
              </span>
              <span
                className="font-mono text-surface-600 hover:text-brand-400 cursor-pointer transition-colors"
                onClick={() => router.push(`/org/${params.orgSlug}/projects/${projectSlug}/commits/${lastCommit.sha}`)}
              >
                {lastCommit.sha.slice(0, 7)}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {timeAgo(lastCommit.committed_at)}
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* Content */}
      {loading ? (
        <Card className="!p-8">
          <div className="flex items-center justify-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />
            <span className="text-surface-400 text-sm">Loading...</span>
          </div>
        </Card>
      ) : error ? (
        <Card className="!p-8">
          <div className="flex flex-col items-center justify-center gap-3 text-center">
            <AlertCircle className="h-10 w-10 text-surface-500" />
            <p className="text-surface-400">{error}</p>
            <p className="text-xs text-surface-600">
              Make sure the Git server is running and the repository has been
              initialized.
            </p>
          </div>
        </Card>
      ) : isViewingFile ? (
        /* ---------- File Viewer ---------- */
        <Card className="!p-0 overflow-hidden">
          {/* File header */}
          <div className="flex items-center justify-between border-b border-surface-700 px-4 py-2.5">
            <div className="flex items-center gap-2">
              {fileIsImage ? (
                <ImageIcon className="h-4 w-4 text-brand-400" />
              ) : fileIsBinary ? (
                <FileArchive className="h-4 w-4 text-brand-400" />
              ) : (
                <FileCode2 className="h-4 w-4 text-brand-400" />
              )}
              <span className="text-sm font-medium text-white">{fileName}</span>
              {!fileIsImage && !fileIsBinary && fileContent && (
                <span className="text-xs text-surface-500">
                  {fileContent.split("\n").length} lines
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {/* View mode tabs — only for text files */}
              {!fileIsImage && !fileIsBinary && fileContent !== "__too_large__" && (
                <div className="flex items-center rounded-md border border-surface-600 overflow-hidden mr-2">
                  <button
                    onClick={() => !isLargeFile && setViewMode("code")}
                    disabled={isLargeFile}
                    title={isLargeFile ? "File too large for syntax highlighting" : ""}
                    className={`px-3 py-1 text-xs font-medium transition-colors ${
                      viewMode === "code"
                        ? "bg-surface-600 text-white"
                        : isLargeFile
                        ? "text-surface-600 cursor-not-allowed"
                        : "text-surface-400 hover:text-white hover:bg-surface-700"
                    }`}
                  >
                    {fileIsMarkdown ? "Preview" : "Code"}
                  </button>
                  <button
                    onClick={() => setViewMode("raw")}
                    className={`px-3 py-1 text-xs font-medium transition-colors border-l border-surface-600 ${
                      viewMode === "raw"
                        ? "bg-surface-600 text-white"
                        : "text-surface-400 hover:text-white hover:bg-surface-700"
                    }`}
                  >
                    Raw
                  </button>
                </div>
              )}

              {!fileIsImage && !fileIsBinary && (
                <button
                  onClick={handleCopy}
                  className="p-1.5 rounded-md text-surface-400 hover:text-white hover:bg-surface-700 transition-colors"
                  title="Copy content"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              )}
              <button
                onClick={handleDownload}
                className="p-1.5 rounded-md text-surface-400 hover:text-white hover:bg-surface-700 transition-colors"
                title="Download file"
              >
                <Download className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* File content */}
          <div className="overflow-auto max-h-[70vh]">
            {fileIsImage ? (
              /* Image Preview */
              <div className="flex items-center justify-center p-8 bg-[#0d1117]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={blobUrl + `&_token=${localStorage.getItem("mc_token") || ""}`}
                  alt={fileName}
                  className="max-w-full max-h-[60vh] object-contain rounded-lg"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                    (e.target as HTMLImageElement).parentElement!.innerHTML = `
                      <div class="text-center text-surface-400">
                        <p class="text-lg font-medium">Cannot preview this image</p>
                        <p class="text-sm mt-1">Click download to save the file</p>
                      </div>
                    `;
                  }}
                />
              </div>
            ) : fileIsBinary ? (
              /* Binary File — Download prompt */
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FileArchive className="h-16 w-16 text-surface-500 mb-4" />
                <p className="text-surface-300 font-medium text-lg">
                  {fileName}
                </p>
                <p className="text-surface-500 text-sm mt-1 mb-4">
                  Binary file — cannot be displayed
                </p>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 text-white font-medium hover:bg-brand-400 transition-colors"
                >
                  <Download className="h-4 w-4" />
                  Download file
                </button>
              </div>
            ) : fileContent === "__too_large__" ? (
              /* Large File — too big to display */
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FileArchive className="h-16 w-16 text-surface-500 mb-4" />
                <p className="text-surface-300 font-medium text-lg">
                  {fileName}
                </p>
                <p className="text-surface-500 text-sm mt-1">
                  This file is too large to display in the browser.
                </p>
                <p className="text-surface-600 text-xs mt-0.5 mb-4">
                  Files larger than 1 MB are not rendered for performance.
                </p>
                <div className="flex items-center gap-3">
                  <a
                    href={blobUrl + `&_token=${typeof window !== 'undefined' ? localStorage.getItem('mc_token') || '' : ''}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-surface-600 text-surface-300 hover:bg-surface-700 transition-colors"
                  >
                    <FileText className="h-4 w-4" />
                    View raw
                  </a>
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 text-white font-medium hover:bg-brand-400 transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </button>
                </div>
              </div>
            ) : fileIsMarkdown && viewMode === "code" ? (
              /* Markdown Rendered */
              <div className="p-6 prose prose-invert prose-sm max-w-none prose-headings:text-white prose-p:text-surface-300 prose-a:text-brand-400 prose-strong:text-white prose-code:text-brand-300 prose-code:bg-surface-700/50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-pre:bg-surface-900 prose-pre:border prose-pre:border-surface-700 prose-pre:text-sm">
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                  {fileContent || ""}
                </ReactMarkdown>
              </div>
            ) : viewMode === "code" ? (
              <SyntaxHighlighter
                language={extToLanguage(fileName)}
                style={oneDark}
                showLineNumbers
                lineNumberStyle={{
                  minWidth: "3em",
                  paddingRight: "1em",
                  color: "#4b5563",
                  userSelect: "none",
                }}
                customStyle={{
                  margin: 0,
                  padding: "1rem",
                  background: "transparent",
                  fontSize: "0.8125rem",
                  lineHeight: "1.6",
                }}
                codeTagProps={{
                  style: { fontFamily: "'JetBrains Mono', 'Fira Code', monospace" },
                }}
              >
                {fileContent || ""}
              </SyntaxHighlighter>
            ) : (
              <pre
                className="p-4 text-sm text-surface-200 font-mono whitespace-pre overflow-auto"
                style={{ fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}
              >
                {fileContent}
              </pre>
            )}
          </div>
        </Card>
      ) : (
        /* ---------- File Tree + README ---------- */
        <>
          <Card className="!p-0 overflow-hidden">
            {/* Table header */}
            <div className="flex items-center px-4 py-2.5 border-b border-surface-700 text-xs text-surface-500 font-medium uppercase tracking-wider">
              <div className="flex-1">Name</div>
              <div className="w-24 text-right">Size</div>
            </div>

            {/* Entries */}
            <div className="divide-y divide-surface-700/50">
              {/* Go-up button when inside a subdirectory */}
              {currentPath && (
                <button
                  onClick={() => {
                    const parentPath = pathSegments.slice(0, -1).join("/");
                    navigate(currentRef, parentPath);
                  }}
                  className="flex items-center w-full px-4 py-2.5 text-sm hover:bg-surface-800/80 transition-colors group"
                >
                  <span className="text-surface-500 mr-3">..</span>
                </button>
              )}

              {entries.map((entry) => {
                const tc = treeCommits[entry.path];
                return (
                  <button
                    key={entry.path}
                    onClick={() => handleEntryClick(entry)}
                    className="flex items-center w-full px-4 py-2 text-sm hover:bg-surface-800/80 transition-colors group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0" style={{ width: '40%' }}>
                      {entry.type === "dir" ? (
                        <Folder className="h-4 w-4 text-brand-400 shrink-0" />
                      ) : isImageFile(entry.name) ? (
                        <ImageIcon className="h-4 w-4 text-purple-400 shrink-0" />
                      ) : (
                        <FileText className="h-4 w-4 text-surface-500 shrink-0" />
                      )}
                      <span
                        className={`truncate ${
                          entry.type === "dir"
                            ? "text-surface-200 group-hover:text-brand-400"
                            : "text-surface-300 group-hover:text-white"
                        } transition-colors`}
                      >
                        {entry.name}
                      </span>
                    </div>
                    <div className="flex-1 truncate text-xs text-surface-500 px-3 hidden md:block">
                      {tc?.message || ""}
                    </div>
                    <div className="w-20 text-right text-xs text-surface-600 hidden sm:block">
                      {tc?.date ? timeAgo(tc.date) : ""}
                    </div>
                    <div className="w-16 text-right text-xs text-surface-600">
                      {entry.type === "file" ? formatSize(entry.size) : ""}
                    </div>
                  </button>
                );
              })}

              {entries.length === 0 && !currentPath && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileCode2 className="h-12 w-12 text-surface-600 mb-3" />
                  <p className="text-surface-400 font-medium">No files yet</p>
                  <p className="text-xs text-surface-600 mt-1">
                    Push code to this repository to see it here.
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* README rendered below file tree — like GitHub */}
          {readmeContent && (
            <Card className="!p-0 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-surface-700">
                <FileText className="h-4 w-4 text-surface-400" />
                <span className="text-sm font-medium text-white">README.md</span>
              </div>
              <div className="p-6 prose prose-invert prose-sm max-w-none prose-headings:text-white prose-p:text-surface-300 prose-a:text-brand-400 prose-strong:text-white prose-code:text-brand-300 prose-code:bg-surface-700/50 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-pre:bg-surface-900 prose-pre:border prose-pre:border-surface-700 prose-pre:text-sm prose-img:rounded-lg">
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                  {readmeContent}
                </ReactMarkdown>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
