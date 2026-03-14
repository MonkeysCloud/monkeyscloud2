"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import dynamic from "next/dynamic";

const RichTextEditor = dynamic(() => import("@/components/ui/RichTextEditor"), { ssr: false });
import {
  ArrowLeft,
  Loader2,
  Send,
  Pencil,
  Trash2,
  X,
  Check,
  AlertCircle,
  Clock,
  Calendar,
  Bug,
  Lightbulb,
  Layers,
  BookOpen,
  Zap,
  FileText,
  MessageSquare,
  Tag,
  Target,
  User,
  Timer,
  Plus,
  ListTree,
  ChevronRight,
  Paperclip,
  Upload,
  Download,
  File as FileIcon,
  Link2,
  ExternalLink,
  Eye,
  Search,
  Settings2,
} from "lucide-react";
import clsx from "clsx";
import toast from "react-hot-toast";

interface Comment {
  id: number;
  user_id: number | null;
  is_ai: boolean;
  body: string;
  parent_id: number | null;
  created_at: string;
  updated_at: string;
}

interface ChildTask {
  id: number;
  number: number;
  key: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  story_points: string | null;
  assignee_id: number | null;
}

interface AttachmentItem {
  id: number;
  file_name: string;
  file_url: string;
  file_size: number;
  mime_type: string;
  created_at: string;
}

interface TaskFull {
  id: number;
  board_id: number;
  sprint_id: number | null;
  number: number;
  key?: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  priority: string;
  story_points: string | null;
  assignee_id: number | null;
  reporter_id: number;
  parent_id: number | null;
  branch_name: string | null;
  due_date: string | null;
  started_at: string | null;
  completed_at: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  labels: { id: number; name: string; color: string }[];
  comments: Comment[];
  children?: ChildTask[];
  children_count?: number;
  parent?: { id: number; number: number; key?: string; title: string; type: string } | null;
  attachments?: AttachmentItem[];
}

const TYPE_CONFIG: Record<string, { icon: typeof FileText; color: string; bg: string }> = {
  task:        { icon: FileText, color: "text-blue-400", bg: "bg-blue-500/10" },
  bug:         { icon: Bug, color: "text-red-400", bg: "bg-red-500/10" },
  feature:     { icon: Lightbulb, color: "text-amber-400", bg: "bg-amber-500/10" },
  improvement: { icon: Zap, color: "text-violet-400", bg: "bg-violet-500/10" },
  epic:        { icon: Layers, color: "text-purple-400", bg: "bg-purple-500/10" },
  story:       { icon: BookOpen, color: "text-emerald-400", bg: "bg-emerald-500/10" },
};

const PRIORITY_CONFIG: Record<string, { color: string; dot: string }> = {
  urgent: { color: "text-red-400",     dot: "bg-red-500" },
  high:   { color: "text-orange-400",  dot: "bg-orange-500" },
  medium: { color: "text-amber-400",   dot: "bg-amber-500" },
  low:    { color: "text-blue-400",    dot: "bg-blue-500" },
  none:   { color: "text-surface-500", dot: "bg-surface-600" },
};

function timeAgo(dateStr: string): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { currentOrg } = useAuthStore();
  const taskId = params.taskId as string;
  const orgSlug = params.orgSlug as string;
  const projectSlug = params.projectSlug as string;

  const [task, setTask] = useState<TaskFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Comments
  const [newComment, setNewComment] = useState("");
  const [posting, setPosting] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editCommentBody, setEditCommentBody] = useState("");
  const [savingComment, setSavingComment] = useState(false);
  const [commentPendingFiles, setCommentPendingFiles] = useState<File[]>([]);

  // Inline edit
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [editingDesc, setEditingDesc] = useState(false);
  const [descValue, setDescValue] = useState("");

  // Time entry
  const [showLogTime, setShowLogTime] = useState(false);
  const [timeMinutes, setTimeMinutes] = useState("");
  const [timeDesc, setTimeDesc] = useState("");
  const [loggingTime, setLoggingTime] = useState(false);

  // Subtask
  const [showAddSubtask, setShowAddSubtask] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [creatingSubtask, setCreatingSubtask] = useState(false);

  // Attachments
  const [uploading, setUploading] = useState(false);
  const [previewAttachment, setPreviewAttachment] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Labels + Sprints (for sidebar editing)
  const [allLabels, setAllLabels] = useState<{ id: number; name: string; color: string }[]>([]);
  const [sprints, setSprints] = useState<{ id: number; name: string; status: string }[]>([]);
  const [members, setMembers] = useState<{ id: number; name: string }[]>([]);
  const [projectId, setProjectId] = useState<number | null>(null);

  // Subtask search (link existing tasks)
  const [subtaskSearch, setSubtaskSearch] = useState("");
  const [subtaskSearchResults, setSubtaskSearchResults] = useState<any[]>([]);
  const [searchingSubtasks, setSearchingSubtasks] = useState(false);

  // Custom fields
  const [customFieldConfigs, setCustomFieldConfigs] = useState<any[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<number, string>>({});

  // Load task
  const loadTask = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    try {
      const res = await api.get<any>(`/api/v1/tasks/${taskId}`);
      const loaded = res?.data ?? null;
      setTask(loaded);

      // If URL uses numeric ID, silently update to key-based URL without reload
      if (loaded?.key && /^\d+$/.test(taskId as string)) {
        window.history.replaceState(
          null,
          '',
          `/org/${params.orgSlug}/projects/${params.projectSlug}/tasks/${loaded.key}`
        );
      }
    } catch {
      setError("Failed to load task.");
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => { loadTask(); }, [loadTask]);

  // Load labels + sprints for editing
  useEffect(() => {
    if (!currentOrg?.id || !task) return;
    async function loadMeta() {
      try {
        const [labelsRes, projsRes, membersRes] = await Promise.all([
          api.get<any>(`/api/v1/organizations/${currentOrg!.id}/task-labels`),
          api.get<any>(`/api/v1/organizations/${currentOrg!.id}/projects`),
          api.get<any>(`/api/v1/organizations/${currentOrg!.id}/members`),
        ]);
        setAllLabels(labelsRes?.data ?? []);
        setMembers((membersRes?.data ?? []).map((m: any) => ({
          id: m.user_id || m.id,
          name: m.name || m.user_name || m.email || `User ${m.user_id || m.id}`,
        })));

        // Find project by slug to get its ID for sprints
        const projects = projsRes?.data ?? [];
        const proj = projects.find((p: any) => p.slug === projectSlug);
        if (proj?.id) {
          setProjectId(proj.id);
          const sprintsRes = await api.get<any>(`/api/v1/projects/${proj.id}/sprints`);
          setSprints(sprintsRes?.data ?? []);

          // Load custom field configs
          try {
            const cfgRes = await api.get<any>(`/api/v1/organizations/${currentOrg!.id}/projects/${proj.id}/field-configs`);
            const allConfigs = cfgRes?.data ?? [];
            setCustomFieldConfigs(allConfigs.filter((f: any) => !f.is_system && f.enabled));

            // Load custom field values for this task
            if (task?.id) {
              const cfvRes = await api.get<any>(`/api/v1/tasks/${task.id}/custom-fields`);
              const vals: Record<number, string> = {};
              for (const v of cfvRes?.data ?? []) {
                vals[v.field_config_id] = v.value ?? "";
              }
              setCustomFieldValues(vals);
            }
          } catch {}
        }
      } catch {}
    }
    loadMeta();
  }, [currentOrg?.id, task?.board_id]);

  async function updateField(field: string, value: any) {
    if (!task) return;
    try {
      const res = await api.put<any>(`/api/v1/tasks/${task.id}`, { [field]: value });
      setTask((prev) => prev ? { ...prev, ...res.data } : prev);
    } catch (err: any) {
      setError(err?.data?.error || "Failed to update.");
    }
  }

  async function postComment() {
    if ((!newComment.trim() && commentPendingFiles.length === 0) || !task) return;
    setPosting(true);
    try {
      // Upload attached files first to get URLs
      const uploadedAttachments: { file_name: string; file_url: string; mime_type: string }[] = [];
      if (commentPendingFiles.length > 0) {
        for (const file of commentPendingFiles) {
          const formData = new FormData();
          formData.append("file", file);
          const json = await api.upload<any>(`/api/v1/tasks/${task.id}/attachments`, formData);
          if (json?.data) {
            uploadedAttachments.push(json.data);
            setTask((prev) => prev ? {
              ...prev,
              attachments: [...(prev.attachments || []), json.data],
            } : prev);
          }
        }
      }
      // Build comment body with attachment references
      let commentBody = newComment.trim();
      if (uploadedAttachments.length > 0) {
        const refs = uploadedAttachments.map((a) => `[attachment:${a.file_name}:${a.file_url}]`).join("\n");
        commentBody = commentBody ? `${commentBody}\n${refs}` : refs;
      }
      if (commentBody) {
        const res = await api.post<any>(`/api/v1/tasks/${task.id}/comments`, { body: commentBody });
        setTask((prev) => prev ? { ...prev, comments: [...(prev.comments || []), res.data] } : prev);
      }
      setNewComment("");
      setCommentPendingFiles([]);
    } catch (err: any) {
      setError(err?.data?.error || "Failed to post comment.");
    } finally {
      setPosting(false);
    }
  }

  async function saveCommentEdit(commentId: number) {
    if (!editCommentBody.trim()) return;
    setSavingComment(true);
    try {
      const res = await api.put<any>(`/api/v1/comments/${commentId}`, { body: editCommentBody.trim() });
      setTask((prev) => prev ? {
        ...prev,
        comments: prev.comments.map((c) => c.id === commentId ? { ...c, ...res.data } : c),
      } : prev);
      setEditingCommentId(null);
    } catch (err: any) {
      setError(err?.data?.error || "Failed to edit comment.");
    } finally {
      setSavingComment(false);
    }
  }

  async function deleteComment(commentId: number) {
    try {
      await api.delete(`/api/v1/comments/${commentId}`);
      setTask((prev) => prev ? { ...prev, comments: prev.comments.filter((c) => c.id !== commentId) } : prev);
    } catch {}
  }

  async function logTimeEntry() {
    if (!timeMinutes || !task) return;
    setLoggingTime(true);
    try {
      await api.post<any>(`/api/v1/tasks/${task.id}/time-entries`, {
        duration_minutes: parseInt(timeMinutes),
        description: timeDesc.trim() || null,
      });
      setTimeMinutes("");
      setTimeDesc("");
      setShowLogTime(false);
    } catch (err: any) {
      setError(err?.data?.error || "Failed to log time.");
    } finally {
      setLoggingTime(false);
    }
  }

  async function createSubtask() {
    if (!subtaskTitle.trim() || !task) return;
    setCreatingSubtask(true);
    try {
      const res = await api.post<any>(`/api/v1/tasks/${task.id}/children`, { title: subtaskTitle.trim() });
      setTask((prev) => prev ? {
        ...prev,
        children: [...(prev.children || []), res.data],
        children_count: (prev.children_count || 0) + 1,
      } : prev);
      setSubtaskTitle("");
      setShowAddSubtask(false);
    } catch (err: any) {
      setError(err?.data?.error || "Failed to create subtask.");
    } finally {
      setCreatingSubtask(false);
    }
  }

  async function uploadAttachment(file: File) {
    if (!task) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const json = await api.upload<any>(`/api/v1/tasks/${task.id}/attachments`, formData);
      if (json?.data) {
        setTask((prev) => prev ? {
          ...prev,
          attachments: [...(prev.attachments || []), json.data],
        } : prev);
      }
    } catch (err: any) {
      setError("Failed to upload file.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function deleteAttachment(attachmentId: number) {
    try {
      await api.delete(`/api/v1/attachments/${attachmentId}`);
      setTask((prev) => prev ? {
        ...prev,
        attachments: (prev.attachments || []).filter((a) => a.id !== attachmentId),
      } : prev);
    } catch {}
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / 1048576).toFixed(1) + " MB";
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-surface-800 rounded" />
          <div className="h-32 bg-surface-800 rounded-xl" />
          <div className="h-64 bg-surface-800 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center">
        <AlertCircle className="h-10 w-10 mx-auto text-surface-600 mb-3" />
        <h2 className="text-sm font-medium text-surface-300">Task not found</h2>
        <button onClick={() => router.back()} className="mt-3 text-primary-400 text-sm hover:underline">Go back</button>
      </div>
    );
  }

  const typeInfo = TYPE_CONFIG[task.type] ?? TYPE_CONFIG.task;
  const TypeIcon = typeInfo.icon;
  const prioInfo = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.medium;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-300 mb-4 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      {/* Error */}
      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
          <button onClick={() => setError("")} className="ml-auto"><X className="h-4 w-4" /></button>
        </div>
      )}

      <div className="grid grid-cols-[1fr_280px] gap-6">
        {/* Left — Main */}
        <div className="space-y-6">
          {/* Header */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={clsx("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold", typeInfo.bg, typeInfo.color)}>
                <TypeIcon className="h-4 w-4" />
                {task.type.toUpperCase()}
              </span>
              <span className="text-sm font-mono text-surface-500">{task.key || `#${task.number}`}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  toast.success("Link copied to clipboard!");
                }}
                className="flex items-center gap-1 text-xs text-surface-500 hover:text-primary-400 transition-colors ml-1 rounded-md px-2 py-1 hover:bg-surface-800/50"
                title="Copy link to task"
              >
                <Link2 className="h-4 w-4" />
                Copy link
              </button>
            </div>
            {editingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={titleValue}
                  onChange={(e) => setTitleValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { updateField("title", titleValue); setEditingTitle(false); } if (e.key === "Escape") setEditingTitle(false); }}
                  className="flex-1 rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-lg font-bold text-white outline-none focus:border-primary-500"
                  autoFocus
                />
                <button onClick={() => { updateField("title", titleValue); setEditingTitle(false); }} className="p-1.5 text-emerald-400"><Check className="h-4 w-4" /></button>
                <button onClick={() => setEditingTitle(false)} className="p-1.5 text-surface-500"><X className="h-4 w-4" /></button>
              </div>
            ) : (
              <h1
                onClick={() => { setTitleValue(task.title); setEditingTitle(true); }}
                className="text-xl font-bold text-white hover:text-primary-400 cursor-pointer transition-colors"
              >
                {task.title}
              </h1>
            )}
          </div>

          {/* Parent Breadcrumb */}
          {task.parent && (
            <div className="flex items-center gap-1.5 -mt-4 mb-2">
              <span className="text-xs text-surface-500">Child of</span>
              <button
                onClick={() => router.push(`/org/${orgSlug}/projects/${projectSlug}/tasks/${task.parent!.key || task.parent!.id}`)}
                className="flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300 transition-colors"
              >
                <span className={clsx("inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs font-bold", TYPE_CONFIG[task.parent.type]?.bg || 'bg-surface-800', TYPE_CONFIG[task.parent.type]?.color || 'text-surface-400')}>
                  {task.parent.key || `#${task.parent.number}`}
                </span>
                {task.parent.title}
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Description */}
          <div className="rounded-xl border border-surface-800 bg-[#111827] p-4">
            <h3 className="text-[13px] font-semibold text-surface-400 uppercase tracking-wider mb-2">Description</h3>
            {editingDesc ? (
              <div>
                <RichTextEditor
                  content={descValue}
                  onChange={(html) => setDescValue(html)}
                  placeholder="Describe the task in detail..."
                />
                <div className="flex gap-2 mt-2">
                  <button onClick={() => { updateField("description", descValue); setEditingDesc(false); }} className="flex items-center gap-1 rounded-md bg-primary-500 px-3 py-1.5 text-xs font-medium text-white"><Check className="h-4 w-4" /> Save</button>
                  <button onClick={() => setEditingDesc(false)} className="text-xs text-surface-500 hover:text-surface-300">Cancel</button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => { setDescValue(task.description || ""); setEditingDesc(true); }}
                className="cursor-pointer hover:bg-surface-800/30 rounded-lg p-2 -m-2 transition-colors"
              >
                {task.description ? (
                  <div className="text-sm text-surface-300 prose prose-invert prose-sm max-w-none [&_h1]:text-lg [&_h1]:font-bold [&_h2]:text-base [&_h2]:font-semibold [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_code]:bg-surface-800 [&_code]:px-1 [&_code]:rounded [&_a]:text-primary-400" dangerouslySetInnerHTML={{ __html: task.description }} />
                ) : (
                  <p className="text-sm text-surface-500 italic">Click to add a description...</p>
                )}
              </div>
            )}
          </div>

          {/* Subtasks */}
          <div className="rounded-xl border border-surface-800 bg-[#111827] p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider flex items-center gap-1.5">
                <ListTree className="h-4 w-4" />
                Subtasks ({task.children?.length || task.children_count || 0})
              </h3>
              {!showAddSubtask && (
                <button
                  onClick={() => setShowAddSubtask(true)}
                  className="flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300 transition-colors"
                >
                  <Plus className="h-4 w-4" /> Add subtask
                </button>
              )}
            </div>

            {showAddSubtask && (
              <div className="space-y-2 mb-3">
                {/* Create new subtask */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={subtaskTitle}
                    onChange={(e) => setSubtaskTitle(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") createSubtask(); if (e.key === "Escape") { setShowAddSubtask(false); setSubtaskTitle(""); } }}
                    placeholder="New subtask title..."
                    className="flex-1 rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-white placeholder:text-surface-500 outline-none focus:border-primary-500"
                    autoFocus
                  />
                  <button
                    onClick={createSubtask}
                    disabled={creatingSubtask || !subtaskTitle.trim()}
                    className="rounded-lg bg-primary-500 px-3 py-2 text-xs font-medium text-white hover:bg-primary-600 disabled:opacity-40"
                  >
                    {creatingSubtask ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                  </button>
                  <button onClick={() => { setShowAddSubtask(false); setSubtaskTitle(""); }} className="text-surface-500 hover:text-surface-300">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Search existing tasks to link */}
                {projectId && (
                  <div>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-surface-500" />
                      <input
                        type="text"
                        value={subtaskSearch}
                        onChange={async (e) => {
                          const q = e.target.value;
                          setSubtaskSearch(q);
                          if (q.length < 2) { setSubtaskSearchResults([]); return; }
                          setSearchingSubtasks(true);
                          try {
                            const res = await api.get<any>(`/api/v1/projects/${projectId}/tasks?search=${encodeURIComponent(q)}`);
                            const existing = (task.children || []).map((c: any) => c.id);
                            existing.push(task.id);
                            setSubtaskSearchResults((res?.data ?? []).filter((t: any) => !existing.includes(t.id)).slice(0, 8));
                          } catch {} finally { setSearchingSubtasks(false); }
                        }}
                        placeholder="Or search existing tasks to link..."
                        className="w-full rounded-lg border border-surface-700 bg-surface-900 pl-8 pr-3 py-2 text-sm text-white placeholder:text-surface-500 outline-none focus:border-primary-500"
                      />
                    </div>
                    {subtaskSearchResults.length > 0 && (
                      <div className="mt-1 rounded-lg border border-surface-700 bg-surface-900 max-h-40 overflow-y-auto divide-y divide-surface-800">
                        {subtaskSearchResults.map((t) => {
                          const TInfo = TYPE_CONFIG[t.type] ?? TYPE_CONFIG.task;
                          const TIcon = TInfo.icon;
                          return (
                            <button
                              key={t.id}
                              onClick={async () => {
                                try {
                                  await api.put<any>(`/api/v1/tasks/${t.id}/parent`, { parent_id: task.id });
                                  // In-place update: add linked task to children
                                  setTask((prev) => prev ? {
                                    ...prev,
                                    children: [...(prev.children || []), { id: t.id, key: t.key, number: t.number, title: t.title, type: t.type, status: t.status, priority: t.priority, story_points: t.story_points, assignee_id: t.assignee_id }],
                                    children_count: (prev.children_count || 0) + 1,
                                  } : prev);
                                  setSubtaskSearchResults((prev) => prev.filter((r) => r.id !== t.id));
                                  setSubtaskSearch("");
                                } catch {}
                              }}
                              className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-surface-800/50 transition-colors"
                            >
                              <TIcon className={clsx("h-4 w-4 shrink-0", TInfo.color)} />
                              <span className="text-xs font-mono text-surface-500">{t.key || `#${t.number}`}</span>
                              <span className="text-sm text-surface-300 truncate">{t.title}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1">
              {(task.children || []).length === 0 && !showAddSubtask ? (
                <div className="text-center py-4">
                  <p className="text-sm text-surface-500">No subtasks yet</p>
                  <button onClick={() => setShowAddSubtask(true)} className="mt-2 inline-flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300">
                    <Plus className="h-4 w-4" /> Add a subtask
                  </button>
                </div>
              ) : (
                (task.children || []).map((child) => {
                  const childTypeInfo = TYPE_CONFIG[child.type] ?? TYPE_CONFIG.task;
                  const ChildTypeIcon = childTypeInfo.icon;
                  const childPrio = PRIORITY_CONFIG[child.priority] ?? PRIORITY_CONFIG.medium;
                  const isDone = child.status === "Done" || child.status === "completed";
                  return (
                    <div
                      key={child.id}
                      className="flex items-center gap-2.5 rounded-lg px-3 py-2 hover:bg-surface-800/40 cursor-pointer transition-colors group"
                    >
                      <span className={clsx("h-2 w-2 rounded-full shrink-0", childPrio.dot)} />
                      <ChildTypeIcon className={clsx("h-4 w-4 shrink-0", childTypeInfo.color)} />
                      <span
                        onClick={() => router.push(`/org/${orgSlug}/projects/${projectSlug}/tasks/${child.key || child.id}`)}
                        className="text-xs font-mono text-surface-500"
                      >{child.key || `#${child.number}`}</span>
                      <span
                        onClick={() => router.push(`/org/${orgSlug}/projects/${projectSlug}/tasks/${child.key || child.id}`)}
                        className={clsx("text-sm flex-1 truncate", isDone ? "line-through text-surface-500" : "text-surface-300 group-hover:text-white")}
                      >
                        {child.title}
                      </span>
                      <span className={clsx("text-[13px] font-medium rounded-md px-1.5 py-0.5", isDone ? "bg-emerald-500/10 text-emerald-400" : "bg-surface-800 text-surface-400")}>
                        {child.status}
                      </span>
                      {child.story_points && (
                        <span className="text-[13px] font-mono text-surface-500 bg-surface-800 px-1 py-0.5 rounded">{child.story_points}pt</span>
                      )}
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            await api.put<any>(`/api/v1/tasks/${child.id}/parent`, { parent_id: null });
                            setTask((prev) => prev ? {
                              ...prev,
                              children: (prev.children || []).filter((c: any) => c.id !== child.id),
                              children_count: Math.max((prev.children_count || 1) - 1, 0),
                            } : prev);
                          } catch {}
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-surface-600 hover:text-red-400 transition-all"
                        title="Remove subtask"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Attachments */}
          <div className="rounded-xl border border-surface-800 bg-[#111827] p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-surface-400 uppercase tracking-wider flex items-center gap-1.5">
                <Paperclip className="h-4 w-4" />
                Attachments ({task.attachments?.length || 0})
              </h3>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300 transition-colors"
              >
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {uploading ? "Uploading..." : "Upload file"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => { if (e.target.files?.[0]) uploadAttachment(e.target.files[0]); }}
              />
            </div>

            <div className="space-y-1">
              {(task.attachments || []).length === 0 ? (
                <div className="text-center py-4">
                  <Paperclip className="h-6 w-6 mx-auto text-surface-600 mb-2" />
                  <p className="text-sm text-surface-500">No attachments yet</p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-2 inline-flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300"
                  >
                    <Upload className="h-4 w-4" /> Upload a file
                  </button>
                </div>
              ) : (
                (task.attachments || []).map((att) => (
                  <div
                    key={att.id}
                    onClick={() => setPreviewAttachment(att)}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 hover:bg-surface-800/40 transition-colors group cursor-pointer"
                  >
                    <FileIcon className="h-4 w-4 text-surface-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-surface-300 truncate">{att.file_name}</p>
                      <p className="text-[13px] text-surface-500">{formatFileSize(att.file_size)} · {att.mime_type.split('/')[1]?.toUpperCase()}</p>
                    </div>
                    <Eye className="h-4 w-4 text-surface-600 group-hover:text-primary-400 transition-colors" />
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteAttachment(att.id); }}
                      className="p-1 text-surface-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Comments */}
          <div className="rounded-xl border border-surface-800 bg-[#111827] p-4">
            <h3 className="text-[13px] font-semibold text-surface-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <MessageSquare className="h-4 w-4" />
              Comments ({task.comments?.length || 0})
            </h3>

            {/* Comment list */}
            <div className="space-y-3 mb-4">
              {(task.comments || []).map((comment) => (
                <div key={comment.id} className="flex gap-3 group">
                  <div className="h-7 w-7 rounded-full bg-surface-700 flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-surface-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[13px] font-medium text-surface-300">
                        {comment.is_ai ? "AI" : `User #${comment.user_id}`}
                      </span>
                      <span className="text-xs text-surface-600">{timeAgo(comment.created_at)}</span>
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
                        <button onClick={() => { setEditingCommentId(comment.id); setEditCommentBody(comment.body); }} className="p-0.5 text-surface-600 hover:text-blue-400"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => deleteComment(comment.id)} className="p-0.5 text-surface-600 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                    {editingCommentId === comment.id ? (
                      <div>
                        <textarea
                          value={editCommentBody}
                          onChange={(e) => setEditCommentBody(e.target.value)}
                          rows={3}
                          className="w-full rounded-md border border-surface-700 bg-surface-900 px-2.5 py-1.5 text-sm text-white outline-none"
                          autoFocus
                        />
                        <div className="flex gap-2 mt-1">
                          <button onClick={() => saveCommentEdit(comment.id)} disabled={savingComment} className="text-[13px] text-primary-400 hover:underline">
                            {savingComment ? "Saving..." : "Save"}
                          </button>
                          <button onClick={() => setEditingCommentId(null)} className="text-[13px] text-surface-500">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {/* Comment text (without attachment markers) */}
                        {(() => {
                          const lines = comment.body.split("\n");
                          const textLines = lines.filter((l: string) => !l.startsWith("[attachment:"));
                          const attachmentLines = lines.filter((l: string) => l.startsWith("[attachment:"));
                          const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
                          return (
                            <>
                              {textLines.join("\n").trim() && (
                                <p className="text-sm text-surface-300 whitespace-pre-wrap">{textLines.join("\n").trim()}</p>
                              )}
                              {attachmentLines.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-1">
                                  {attachmentLines.map((line: string, i: number) => {
                                    const match = line.match(/^\[attachment:(.+?):(.+?)\]$/);
                                    if (!match) return null;
                                    const [, fileName, fileUrl] = match;
                                    const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(fileName);
                                    return isImage ? (
                                      <a
                                        key={i}
                                        href={`${apiBase}${fileUrl}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block rounded-lg overflow-hidden border border-surface-700 hover:border-primary-500/50 transition-colors"
                                      >
                                        <img
                                          src={`${apiBase}${fileUrl}`}
                                          alt={fileName}
                                          className="max-w-[200px] max-h-[150px] object-cover"
                                        />
                                      </a>
                                    ) : (
                                      <a
                                        key={i}
                                        href={`${apiBase}${fileUrl}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 rounded-md bg-surface-800 border border-surface-700 px-2.5 py-1.5 text-xs text-surface-300 hover:border-primary-500/50 hover:text-primary-400 transition-colors"
                                      >
                                        <FileIcon className="h-3.5 w-3.5 text-surface-500" />
                                        {fileName}
                                        <Download className="h-3 w-3 text-surface-500" />
                                      </a>
                                    );
                                  })}
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {(task.comments || []).length === 0 && (
                <p className="text-sm text-surface-500 text-center py-4">No comments yet</p>
              )}
            </div>

            {/* Post comment */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); postComment(); } }}
                  placeholder="Write a comment..."
                  rows={2}
                  className="flex-1 rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-white placeholder:text-surface-500 outline-none focus:border-primary-500 resize-none"
                />
                <div className="flex flex-col gap-1 self-end">
                  <label
                    className="rounded-lg border border-surface-700 p-2.5 text-surface-400 hover:text-primary-400 hover:border-primary-500/50 transition-colors cursor-pointer"
                    title="Attach file"
                  >
                    <Paperclip className="h-4 w-4" />
                    <input
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        const fileList = e.target.files;
                        if (fileList && fileList.length > 0) {
                          const newFiles = Array.from(fileList);
                          setCommentPendingFiles((prev) => [...prev, ...newFiles]);
                        }
                      }}
                    />
                  </label>
                  <button
                    onClick={postComment}
                    disabled={posting || (!newComment.trim() && commentPendingFiles.length === 0)}
                    className="rounded-lg bg-primary-500 p-2.5 text-white hover:bg-primary-600 disabled:opacity-40 transition-colors"
                  >
                    {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {/* Pending files */}
              {commentPendingFiles.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {commentPendingFiles.map((file, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1.5 rounded-md bg-surface-800 border border-surface-700 px-2 py-1 text-xs text-surface-300"
                    >
                      <Paperclip className="h-3 w-3 text-surface-500" />
                      <span className="max-w-[150px] truncate">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => setCommentPendingFiles((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-surface-500 hover:text-red-400 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-4">
          {/* Type */}
          <div className="rounded-lg border border-surface-800 bg-[#111827] p-3">
            <h4 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">Type</h4>
            <div className="space-y-0.5">
              {Object.entries(TYPE_CONFIG).map(([key, cfg]) => {
                const Icon = cfg.icon;
                return (
                  <button
                    key={key}
                    onClick={() => updateField("type", key)}
                    className={clsx(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-all",
                      task.type === key
                        ? "bg-surface-800 text-white border border-surface-600"
                        : "text-surface-400 hover:bg-surface-800/50 border border-transparent"
                    )}
                  >
                    <Icon className={clsx("h-4 w-4", cfg.color)} />
                    <span className="capitalize">{key}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Status */}
          <div className="rounded-lg border border-surface-800 bg-[#111827] p-3">
            <h4 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">Status</h4>
            <div className="flex flex-wrap gap-1">
              {["backlog", "To Do", "In Progress", "Review", "Done"].map((s) => (
                <button
                  key={s}
                  onClick={() => updateField("status", s)}
                  className={clsx(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition-all border",
                    task.status === s
                      ? "bg-primary-500/15 text-primary-400 border-primary-500/30"
                      : "text-surface-400 hover:bg-surface-800/50 border-transparent hover:border-surface-700"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Priority */}
          <div className="rounded-lg border border-surface-800 bg-[#111827] p-3">
            <h4 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">Priority</h4>
            <div className="space-y-0.5">
              {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => updateField("priority", key)}
                  className={clsx(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-all",
                    task.priority === key
                      ? "bg-surface-800 text-white border border-surface-600"
                      : "text-surface-400 hover:bg-surface-800/50 border border-transparent"
                  )}
                >
                  <span className={clsx("h-2 w-2 rounded-full", cfg.dot)} />
                  <span className="capitalize">{key}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Labels */}
          <div className="rounded-lg border border-surface-800 bg-[#111827] p-3">
            <h4 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Tag className="h-4 w-4" /> Labels
            </h4>
            {allLabels.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {allLabels.map((l) => {
                  const isActive = task.labels?.some((tl: any) => tl.id === l.id);
                  return (
                    <button
                      key={l.id}
                      onClick={async () => {
                        const currentIds = (task.labels || []).map((tl: any) => tl.id);
                        const newIds = isActive
                          ? currentIds.filter((id: number) => id !== l.id)
                          : [...currentIds, l.id];
                        await updateField("label_ids", newIds);
                        loadTask();
                      }}
                      className={clsx(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-all border",
                        isActive
                          ? "border-transparent"
                          : "border-dashed border-surface-600 opacity-50 hover:opacity-100"
                      )}
                      style={{
                        backgroundColor: l.color + (isActive ? "30" : "10"),
                        color: l.color,
                      }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: l.color }} />
                      {l.name}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-surface-500 italic">No labels available</p>
            )}
          </div>

          {/* Sprint */}
          <div className="rounded-lg border border-surface-800 bg-[#111827] p-3">
            <h4 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">Sprint</h4>
            <select
              value={task.sprint_id ?? ""}
              onChange={(e) => updateField("sprint_id", e.target.value ? Number(e.target.value) : null)}
              className="w-full rounded-md border border-surface-700 bg-surface-900 px-2.5 py-1.5 text-sm text-white outline-none [color-scheme:dark]"
            >
              <option value="">No sprint</option>
              {sprints.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.status === "active" ? "(active)" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Assignee */}
          <div className="rounded-lg border border-surface-800 bg-[#111827] p-3">
            <h4 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2 flex items-center gap-1">
              <User className="h-4 w-4" /> Assignee
            </h4>
            <select
              value={task.assignee_id ?? ""}
              onChange={(e) => updateField("assignee_id", e.target.value ? Number(e.target.value) : null)}
              className="w-full rounded-md border border-surface-700 bg-surface-900 px-2.5 py-1.5 text-sm text-white outline-none [color-scheme:dark]"
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          {/* Story Points */}
          <div className="rounded-lg border border-surface-800 bg-[#111827] p-3">
            <h4 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Target className="h-4 w-4" /> Story Points
            </h4>
            <input
              type="number"
              defaultValue={task.story_points ?? ""}
              onBlur={(e) => updateField("story_points", e.target.value ? parseFloat(e.target.value) : null)}
              min="0" max="100" step="0.5"
              className="w-full rounded-md border border-surface-700 bg-surface-900 px-2.5 py-1.5 text-sm text-white outline-none [color-scheme:dark]"
            />
          </div>

          {/* Due Date */}
          <div className="rounded-lg border border-surface-800 bg-[#111827] p-3">
            <h4 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Calendar className="h-4 w-4" /> Due Date
            </h4>
            <input
              type="date"
              defaultValue={task.due_date ?? ""}
              onChange={(e) => updateField("due_date", e.target.value || null)}
              className="w-full rounded-md border border-surface-700 bg-surface-900 px-2.5 py-1.5 text-sm text-white outline-none [color-scheme:dark]"
            />
          </div>

          {/* Custom Fields */}
          {customFieldConfigs.length > 0 && (
            <div className="rounded-lg border border-surface-800 bg-[#111827] p-3">
              <h4 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Settings2 className="h-4 w-4" /> Custom Fields
              </h4>
              <div className="space-y-2">
                {customFieldConfigs.map((cfg: any) => {
                  const val = customFieldValues[cfg.id] ?? "";
                  return (
                    <div key={cfg.id}>
                      <label className="text-[11px] text-surface-500 mb-0.5 block">{cfg.field_label}</label>
                      {cfg.field_type === "checkbox" ? (
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={val === "true" || val === "1"}
                            onChange={(e) => {
                              const newVal = e.target.checked ? "true" : "false";
                              setCustomFieldValues((prev) => ({ ...prev, [cfg.id]: newVal }));
                              api.put(`/api/v1/tasks/${task.id}/custom-fields`, { values: { [cfg.id]: newVal } }).catch(() => {});
                            }}
                            className="rounded border-surface-700"
                          />
                          <span className="text-sm text-surface-300">{val === "true" || val === "1" ? "Yes" : "No"}</span>
                        </label>
                      ) : cfg.field_type === "select" ? (
                        <select
                          value={val}
                          onChange={(e) => {
                            setCustomFieldValues((prev) => ({ ...prev, [cfg.id]: e.target.value }));
                            api.put(`/api/v1/tasks/${task.id}/custom-fields`, { values: { [cfg.id]: e.target.value } }).catch(() => {});
                          }}
                          className="w-full rounded-md border border-surface-700 bg-surface-900 px-2 py-1 text-sm text-white outline-none [color-scheme:dark]"
                        >
                          <option value="">—</option>
                          {(cfg.options ?? []).map((o: string) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : (
                        <input
                          type={cfg.field_type === "number" ? "number" : cfg.field_type === "date" ? "date" : cfg.field_type === "url" ? "url" : cfg.field_type === "email" ? "email" : "text"}
                          defaultValue={val}
                          onBlur={(e) => {
                            if (e.target.value !== val) {
                              setCustomFieldValues((prev) => ({ ...prev, [cfg.id]: e.target.value }));
                              api.put(`/api/v1/tasks/${task.id}/custom-fields`, { values: { [cfg.id]: e.target.value } }).catch(() => {});
                            }
                          }}
                          placeholder={cfg.field_label}
                          className="w-full rounded-md border border-surface-700 bg-surface-900 px-2 py-1 text-sm text-white outline-none [color-scheme:dark]"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Time Tracking */}
          <div className="rounded-lg border border-surface-800 bg-[#111827] p-3">
            <h4 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Timer className="h-4 w-4" /> Time Tracking
            </h4>
            {showLogTime ? (
              <div className="space-y-2">
                <input type="number" value={timeMinutes} onChange={(e) => setTimeMinutes(e.target.value)} placeholder="Minutes" min="1" className="w-full rounded-md border border-surface-700 bg-surface-900 px-2.5 py-1.5 text-sm text-white outline-none [color-scheme:dark]" />
                <input type="text" value={timeDesc} onChange={(e) => setTimeDesc(e.target.value)} placeholder="What did you work on?" className="w-full rounded-md border border-surface-700 bg-surface-900 px-2.5 py-1.5 text-sm text-white placeholder:text-surface-500 outline-none" />
                <div className="flex gap-2">
                  <button onClick={logTimeEntry} disabled={loggingTime || !timeMinutes} className="flex-1 rounded-md bg-primary-500 py-1.5 text-[13px] font-medium text-white hover:bg-primary-600 disabled:opacity-40">
                    {loggingTime ? "Logging..." : "Log Time"}
                  </button>
                  <button onClick={() => setShowLogTime(false)} className="rounded-md border border-surface-700 px-3 py-1.5 text-[13px] text-surface-400">Cancel</button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowLogTime(true)}
                className="w-full rounded-md border border-dashed border-surface-700 py-1.5 text-[13px] text-surface-500 hover:text-surface-300 hover:border-surface-600 transition-colors"
              >
                + Log time
              </button>
            )}
          </div>

          {/* Meta */}
          <div className="rounded-lg border border-surface-800 bg-[#111827] p-3 text-[13px] text-surface-500 space-y-1">
            <div className="flex justify-between">
              <span>Created</span>
              <span className="text-surface-400">{formatDate(task.created_at)}</span>
            </div>
            <div className="flex justify-between">
              <span>Updated</span>
              <span className="text-surface-400">{timeAgo(task.updated_at)}</span>
            </div>
            {task.started_at && (
              <div className="flex justify-between">
                <span>Started</span>
                <span className="text-surface-400">{formatDate(task.started_at)}</span>
              </div>
            )}
            {task.completed_at && (
              <div className="flex justify-between">
                <span>Completed</span>
                <span className="text-emerald-400">{formatDate(task.completed_at)}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Attachment Preview Modal */}
      {previewAttachment && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setPreviewAttachment(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg mx-4 rounded-2xl border border-surface-700 bg-[#111827] shadow-2xl overflow-hidden"
          >
            {/* Preview header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-surface-800">
              <div className="flex items-center gap-3 min-w-0">
                <FileIcon className="h-5 w-5 text-primary-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{previewAttachment.file_name}</p>
                  <p className="text-xs text-surface-500">
                    {formatFileSize(previewAttachment.file_size)} · {previewAttachment.mime_type}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setPreviewAttachment(null)}
                className="p-1.5 rounded-lg text-surface-400 hover:text-white hover:bg-surface-800 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Image preview */}
            {previewAttachment.mime_type?.startsWith('image/') && (
              <div className="px-5 py-4 flex items-center justify-center bg-surface-900/50 max-h-[400px] overflow-hidden">
                <img
                  src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}${previewAttachment.file_url}`}
                  alt={previewAttachment.file_name}
                  className="max-w-full max-h-[360px] rounded-lg object-contain"
                />
              </div>
            )}

            {/* Non-image file icon */}
            {!previewAttachment.mime_type?.startsWith('image/') && (
              <div className="px-5 py-10 flex flex-col items-center justify-center gap-3 bg-surface-900/30">
                <FileIcon className="h-16 w-16 text-surface-600" />
                <p className="text-sm text-surface-500">Preview not available for this file type</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 px-5 py-4 border-t border-surface-800">
              <a
                href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}${previewAttachment.file_url}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-surface-800 hover:bg-surface-700 px-4 py-2.5 text-sm font-medium text-surface-200 hover:text-white transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                Open in New Tab
              </a>
              <a
                href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}${previewAttachment.file_url}`}
                download={previewAttachment.file_name}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary-500 hover:bg-primary-400 px-4 py-2.5 text-sm font-medium text-white transition-colors"
                onClick={(e) => {
                  e.preventDefault();
                  fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}${previewAttachment.file_url}`, { cache: 'no-store' })
                    .then(res => res.blob())
                    .then(blob => {
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = previewAttachment.file_name;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);
                    });
                }}
              >
                <Download className="h-4 w-4" />
                Download
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
