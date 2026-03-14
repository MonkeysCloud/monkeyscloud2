"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import dynamic from "next/dynamic";

const RichTextEditor = dynamic(() => import("@/components/ui/RichTextEditor"), { ssr: false });
import {
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Bug,
  Lightbulb,
  Layers,
  BookOpen,
  Zap,
  FileText,
  Search,
  Paperclip,
  Upload,
  Trash2,
  File as FileIcon,
  Link2,
  ExternalLink,
  Download,
  Eye,
  MessageSquare,
  Send,
  User,
  Pencil,
  ListTree,
  Plus,
} from "lucide-react";
import clsx from "clsx";
import toast from "react-hot-toast";

interface Label {
  id: number;
  name: string;
  color: string;
}

interface Sprint {
  id: number;
  name: string;
  status: string;
}

export interface TaskData {
  id?: number;
  title: string;
  description: string | null;
  type: string;
  status: string;
  priority: string;
  assignee_id: number | null;
  sprint_id: number | null;
  story_points: string | null;
  due_date: string | null;
  parent_id: number | null;
  label_ids: number[];
}

interface TaskDrawerProps {
  open: boolean;
  onClose: () => void;
  onSaved: (task: any) => void;
  projectId: number;
  orgId: number;
  task?: any; // existing task for edit mode
  boardColumns: string[];
}

const TYPES = [
  { value: "task", label: "Task", icon: FileText, color: "text-blue-400" },
  { value: "bug", label: "Bug", icon: Bug, color: "text-red-400" },
  { value: "feature", label: "Feature", icon: Lightbulb, color: "text-amber-400" },
  { value: "improvement", label: "Improvement", icon: Zap, color: "text-violet-400" },
  { value: "epic", label: "Epic", icon: Layers, color: "text-purple-400" },
  { value: "story", label: "Story", icon: BookOpen, color: "text-emerald-400" },
];

const PRIORITIES = [
  { value: "urgent", label: "Urgent", color: "bg-red-500" },
  { value: "high", label: "High", color: "bg-orange-500" },
  { value: "medium", label: "Medium", color: "bg-amber-500" },
  { value: "low", label: "Low", color: "bg-blue-500" },
  { value: "none", label: "None", color: "bg-surface-600" },
];

export default function TaskDrawer({
  open,
  onClose,
  onSaved,
  projectId,
  orgId,
  task,
  boardColumns,
}: TaskDrawerProps) {
  const isEdit = !!task?.id;
  const params = useParams();
  const router = useRouter();
  const [previewAttachment, setPreviewAttachment] = useState<any>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("task");
  const [status, setStatus] = useState("backlog");
  const [priority, setPriority] = useState("medium");
  const [storyPoints, setStoryPoints] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [sprintId, setSprintId] = useState<string>("");
  const [assigneeId, setAssigneeId] = useState<string>("");
  const [members, setMembers] = useState<{ id: number; name: string; email: string }[]>([]);

  const [labels, setLabels] = useState<Label[]>([]);
  const [selectedLabelIds, setSelectedLabelIds] = useState<number[]>([]);
  const [sprints, setSprints] = useState<Sprint[]>([]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Child task search (create mode)
  const [childSearch, setChildSearch] = useState("");
  const [childResults, setChildResults] = useState<any[]>([]);
  const [selectedChildren, setSelectedChildren] = useState<any[]>([]);
  const [searchingChildren, setSearchingChildren] = useState(false);

  // Subtasks (edit mode)
  const [existingChildren, setExistingChildren] = useState<any[]>([]);
  const [showAddSubtask, setShowAddSubtask] = useState(false);
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [creatingSubtask, setCreatingSubtask] = useState(false);
  const [subtaskSearch, setSubtaskSearch] = useState("");
  const [subtaskSearchResults, setSubtaskSearchResults] = useState<any[]>([]);

  // Attachments
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [existingAttachments, setExistingAttachments] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Comments
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [commentPendingFiles, setCommentPendingFiles] = useState<File[]>([]);
  const [postingComment, setPostingComment] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editCommentBody, setEditCommentBody] = useState("");
  const [savingComment, setSavingComment] = useState(false);

  // Load labels, sprints, and attachments (for edit)
  useEffect(() => {
    if (!open) return;
    async function load() {
      try {
        const requests: Promise<any>[] = [
          api.get<any>(`/api/v1/organizations/${orgId}/task-labels`),
          api.get<any>(`/api/v1/projects/${projectId}/sprints`),
          api.get<any>(`/api/v1/organizations/${orgId}/members`),
        ];
        if (task?.id) {
          requests.push(api.get<any>(`/api/v1/tasks/${task.id}/attachments`));
          requests.push(api.get<any>(`/api/v1/tasks/${task.id}/comments`));
          requests.push(api.get<any>(`/api/v1/tasks/${task.id}`));
        }
        const results = await Promise.all(requests);
        setLabels(results[0]?.data ?? []);
        setSprints(results[1]?.data ?? []);
        // Members: might be array of objects with user info
        const memberList = (results[2]?.data ?? []).map((m: any) => ({
          id: m.user_id || m.id,
          name: m.name || m.user_name || m.email || `User ${m.user_id || m.id}`,
          email: m.email || '',
        }));
        setMembers(memberList);
        if (results[3]) {
          setExistingAttachments(results[3]?.data ?? []);
        } else {
          setExistingAttachments([]);
        }
        if (results[4]) {
          setComments(results[4]?.data ?? []);
        } else {
          setComments([]);
        }
        if (results[5]?.data?.children) {
          setExistingChildren(results[5].data.children);
        } else {
          setExistingChildren([]);
        }
      } catch {}
    }
    load();
  }, [open, orgId, projectId, task?.id]);

  // Populate for edit mode
  useEffect(() => {
    // Always reset data immediately to prevent stale data flash
    setExistingAttachments([]);
    setPendingFiles([]);
    setComments([]);
    setNewComment("");
    setCommentPendingFiles([]);
    setEditingCommentId(null);
    setExistingChildren([]);
    setShowAddSubtask(false);
    setSubtaskTitle("");
    setSubtaskSearch("");
    setSubtaskSearchResults([]);

    if (task) {
      setTitle(task.title || "");
      setDescription(task.description || "");
      setType(task.type || "task");
      setStatus(task.status || "backlog");
      setPriority(task.priority || "medium");
      setStoryPoints(task.story_points ?? "");
      setDueDate(task.due_date || "");
      setSprintId(task.sprint_id ? String(task.sprint_id) : "");
      setAssigneeId(task.assignee_id ? String(task.assignee_id) : "");
      setSelectedLabelIds(task.labels?.map((l: any) => l.id) ?? []);
    } else {
      setTitle("");
      setDescription("");
      setType("task");
      setStatus("backlog");
      setPriority("medium");
      setStoryPoints("");
      setDueDate("");
      setSprintId("");
      setAssigneeId("");
      setSelectedLabelIds([]);
      setChildSearch("");
      setChildResults([]);
      setSelectedChildren([]);
    }
  }, [task, open]);

  function toggleLabel(id: number) {
    setSelectedLabelIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }

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

  async function postComment() {
    if ((!newComment.trim() && commentPendingFiles.length === 0) || !task?.id) return;
    setPostingComment(true);
    try {
      const uploadedAttachments: { file_name: string; file_url: string; mime_type: string }[] = [];
      if (commentPendingFiles.length > 0) {
        for (const file of commentPendingFiles) {
          const formData = new FormData();
          formData.append("file", file);
          const json = await api.upload<any>(`/api/v1/tasks/${task.id}/attachments`, formData);
          if (json?.data) {
            uploadedAttachments.push(json.data);
            setExistingAttachments((prev) => [...prev, json.data]);
          }
        }
      }
      let commentBody = newComment.trim();
      if (uploadedAttachments.length > 0) {
        const refs = uploadedAttachments.map((a) => `[attachment:${a.file_name}:${a.file_url}]`).join("\n");
        commentBody = commentBody ? `${commentBody}\n${refs}` : refs;
      }
      if (commentBody) {
        const res = await api.post<any>(`/api/v1/tasks/${task.id}/comments`, { body: commentBody });
        setComments((prev) => [...prev, res.data]);
      }
      setNewComment("");
      setCommentPendingFiles([]);
    } catch (err: any) {
      setError(err?.data?.error || "Failed to post comment.");
    } finally {
      setPostingComment(false);
    }
  }

  async function saveCommentEdit(commentId: number) {
    if (!editCommentBody.trim()) return;
    setSavingComment(true);
    try {
      const res = await api.put<any>(`/api/v1/comments/${commentId}`, { body: editCommentBody.trim() });
      setComments((prev) => prev.map((c) => c.id === commentId ? { ...c, ...res.data } : c));
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
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch {}
  }
  async function createEditSubtask() {
    if (!subtaskTitle.trim() || !task?.id) return;
    setCreatingSubtask(true);
    try {
      const res = await api.post<any>(`/api/v1/tasks/${task.id}/children`, { title: subtaskTitle.trim() });
      if (res?.data) {
        setExistingChildren((prev) => [...prev, { id: res.data.id, key: res.data.key, number: res.data.number, title: res.data.title, type: res.data.type || 'task', status: res.data.status || 'backlog', priority: res.data.priority || 'medium', story_points: res.data.story_points, assignee_id: res.data.assignee_id }]);
      }
      setSubtaskTitle("");
    } catch (err: any) {
      setError(err?.data?.error || "Failed to create subtask.");
    } finally {
      setCreatingSubtask(false);
    }
  }

  async function linkSubtask(t: any) {
    if (!task?.id) return;
    try {
      await api.put<any>(`/api/v1/tasks/${t.id}/parent`, { parent_id: task.id });
      setExistingChildren((prev) => [...prev, { id: t.id, key: t.key, number: t.number, title: t.title, type: t.type, status: t.status, priority: t.priority, story_points: t.story_points, assignee_id: t.assignee_id }]);
      setSubtaskSearchResults((prev) => prev.filter((r) => r.id !== t.id));
      setSubtaskSearch("");
    } catch {}
  }

  async function unlinkSubtask(childId: number) {
    try {
      await api.put<any>(`/api/v1/tasks/${childId}/parent`, { parent_id: null });
      setExistingChildren((prev) => prev.filter((c) => c.id !== childId));
    } catch {}
  }

  async function handleSave() {
    if (!title.trim()) { setError("Title is required."); return; }
    setSaving(true);
    setError("");
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        type,
        status,
        priority,
        story_points: storyPoints ? parseFloat(storyPoints) : null,
        due_date: dueDate || null,
        sprint_id: sprintId ? parseInt(sprintId) : null,
        assignee_id: assigneeId ? parseInt(assigneeId) : null,
        label_ids: selectedLabelIds,
      };

      let res;
      if (isEdit) {
        res = await api.put<any>(`/api/v1/tasks/${task.id}`, payload);
      } else {
        res = await api.post<any>(`/api/v1/projects/${projectId}/tasks`, payload);
      }

      // Link selected children to this task
      if (!isEdit && selectedChildren.length > 0 && res?.data?.id) {
        await Promise.all(
          selectedChildren.map((child) =>
            api.put(`/api/v1/tasks/${child.id}/parent`, { parent_id: res.data.id })
          )
        );
      }

      // Upload pending attachments
      if (pendingFiles.length > 0 && res?.data?.id) {
        await Promise.all(
          pendingFiles.map((file) => {
            const formData = new FormData();
            formData.append("file", file);
            return api.upload(`/api/v1/tasks/${res.data.id}/attachments`, formData);
          })
        );
      }

      onSaved(res.data);
      onClose();
    } catch (err: any) {
      setError(err?.data?.error || err?.message || "Failed to save task.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const statusOptions = ["backlog", ...boardColumns];

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 w-[800px] max-w-full bg-[#0d1117] border-l border-surface-800 z-50 flex flex-col animate-in slide-in-from-right">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-800">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-white">
              {isEdit ? `Edit Task #${task.number}` : "New Task"}
            </h2>
            {isEdit && task.id && (
              <button
                onClick={() => {
                  const url = `${window.location.origin}/org/${params.orgSlug}/projects/${params.projectSlug}/tasks/${task.key || task.id}`;
                  navigator.clipboard.writeText(url);
                  toast.success("Link copied!");
                }}
                className="flex items-center gap-1 text-xs text-surface-500 hover:text-primary-400 transition-colors rounded-md px-1.5 py-0.5 hover:bg-surface-800/50"
                title="Copy link to task"
              >
                <Link2 className="h-4 w-4" />
              </button>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md text-surface-500 hover:text-white hover:bg-surface-800 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-5 mt-3 flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-[13px] font-medium text-surface-400 mb-1 uppercase tracking-wider">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2.5 text-sm text-white placeholder:text-surface-500 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30"
              autoFocus
              maxLength={255}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[13px] font-medium text-surface-400 mb-1 uppercase tracking-wider">Description</label>
            <RichTextEditor
              content={description}
              onChange={(html) => setDescription(html)}
              placeholder="Describe the task in detail..."
            />
          </div>

          {/* Type & Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[13px] font-medium text-surface-400 mb-1 uppercase tracking-wider">Type</label>
              <div className="space-y-1">
                {TYPES.map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.value}
                      onClick={() => setType(t.value)}
                      className={clsx(
                        "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-all",
                        type === t.value
                          ? "bg-surface-800 text-white border border-surface-600"
                          : "text-surface-400 hover:bg-surface-800/50 border border-transparent"
                      )}
                    >
                      <Icon className={clsx("h-4 w-4", t.color)} />
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-[13px] font-medium text-surface-400 mb-1 uppercase tracking-wider">Priority</label>
              <div className="space-y-1">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setPriority(p.value)}
                    className={clsx(
                      "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-all",
                      priority === p.value
                        ? "bg-surface-800 text-white border border-surface-600"
                        : "text-surface-400 hover:bg-surface-800/50 border border-transparent"
                    )}
                  >
                    <span className={clsx("h-2.5 w-2.5 rounded-full", p.color)} />
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-[13px] font-medium text-surface-400 mb-1 uppercase tracking-wider">Status</label>
            <div className="flex flex-wrap gap-1.5">
              {statusOptions.map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={clsx(
                    "rounded-md px-2.5 py-1 text-[13px] font-medium border transition-all",
                    status === s
                      ? "bg-primary-500/15 text-primary-400 border-primary-500/30"
                      : "bg-surface-800/40 text-surface-400 border-surface-700 hover:bg-surface-800"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Labels */}
          {labels.length > 0 && (
            <div>
              <label className="block text-[13px] font-medium text-surface-400 mb-1 uppercase tracking-wider">Labels</label>
              <div className="flex flex-wrap gap-1.5">
                {labels.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => toggleLabel(l.id)}
                    className={clsx(
                      "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-medium border transition-all",
                      selectedLabelIds.includes(l.id)
                        ? "border-opacity-50 text-white"
                        : "border-surface-700 text-surface-400 hover:bg-surface-800"
                    )}
                    style={
                      selectedLabelIds.includes(l.id)
                        ? { backgroundColor: l.color + "20", borderColor: l.color + "50", color: l.color }
                        : {}
                    }
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: l.color }} />
                    {l.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Sprint */}
          <div>
            <label className="block text-[13px] font-medium text-surface-400 mb-1 uppercase tracking-wider">Sprint</label>
            <select
              value={sprintId}
              onChange={(e) => setSprintId(e.target.value)}
              className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-white outline-none focus:border-primary-500 [color-scheme:dark]"
            >
              <option value="">Backlog (no sprint)</option>
              {sprints.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.status})</option>
              ))}
            </select>
          </div>

          {/* Assignee */}
          <div>
            <label className="block text-[13px] font-medium text-surface-400 mb-1 uppercase tracking-wider">Assignee</label>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-white outline-none focus:border-primary-500 [color-scheme:dark]"
            >
              <option value="">Unassigned</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

          {/* Story Points & Due Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[13px] font-medium text-surface-400 mb-1 uppercase tracking-wider">Story Points</label>
              <input
                type="number"
                value={storyPoints}
                onChange={(e) => setStoryPoints(e.target.value)}
                placeholder="0"
                min="0"
                max="100"
                step="0.5"
                className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-white outline-none focus:border-primary-500 [color-scheme:dark]"
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium text-surface-400 mb-1 uppercase tracking-wider">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-white outline-none focus:border-primary-500 [color-scheme:dark]"
              />
            </div>
          </div>

          {/* Attachments */}
          <div>
            <label className="block text-[13px] font-medium text-surface-400 mb-1 uppercase tracking-wider">Attachments</label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-surface-600 bg-surface-900/50 px-3 py-3 text-sm text-surface-400 hover:border-primary-500 hover:text-primary-400 cursor-pointer transition-colors"
            >
              <Upload className="h-4 w-4" />
              Click to attach files
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = e.target.files;
                if (files && files.length > 0) {
                  const newFiles = Array.from(files);
                  setPendingFiles((prev) => [...prev, ...newFiles]);
                }
                e.target.value = "";
              }}
            />
            {/* Existing attachments */}
            {existingAttachments.length > 0 && (
              <div className="mt-2 space-y-1">
                {existingAttachments.map((att) => (
                  <div
                    key={att.id}
                    onClick={() => setPreviewAttachment(att)}
                    className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 bg-surface-800/40 group cursor-pointer hover:bg-surface-800/60 transition-colors"
                  >
                    <FileIcon className="h-4 w-4 text-primary-400 shrink-0" />
                    <span className="text-xs text-surface-300 flex-1 truncate">{att.file_name}</span>
                    <span className="text-xs text-surface-500">{(att.file_size / 1024).toFixed(0)} KB</span>
                    <Eye className="h-4 w-4 text-surface-600 group-hover:text-primary-400 transition-colors" />
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          await api.delete(`/api/v1/attachments/${att.id}`);
                          setExistingAttachments((prev) => prev.filter((a) => a.id !== att.id));
                        } catch {}
                      }}
                      className="p-0.5 text-surface-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {/* Pending (new) files */}
            {pendingFiles.length > 0 && (
              <div className="mt-2 space-y-1">
                {pendingFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 bg-surface-800/40 group">
                    <FileIcon className="h-4 w-4 text-surface-500 shrink-0" />
                    <span className="text-xs text-surface-300 flex-1 truncate">{file.name}</span>
                    <span className="text-xs text-surface-500">{(file.size / 1024).toFixed(0)} KB</span>
                    <span className="text-xs text-amber-400">new</span>
                    <button
                      type="button"
                      onClick={() => setPendingFiles((prev) => prev.filter((_, i) => i !== idx))}
                      className="p-0.5 text-surface-600 hover:text-red-400 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Child Tasks / Subtasks (create mode — queue for linking on save) */}
          {!isEdit && (
            <div>
              <label className="block text-[13px] font-medium text-surface-400 mb-1 uppercase tracking-wider">Subtasks</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-surface-500" />
                <input
                  type="text"
                  value={childSearch}
                  onChange={async (e) => {
                    const q = e.target.value;
                    setChildSearch(q);
                    if (q.length < 2) { setChildResults([]); return; }
                    setSearchingChildren(true);
                    try {
                      const res = await api.get<any>(`/api/v1/projects/${projectId}/tasks?search=${encodeURIComponent(q)}`);
                      const tasks = (res?.data ?? []).filter((t: any) => !selectedChildren.find((s) => s.id === t.id));
                      setChildResults(tasks.slice(0, 8));
                    } catch {} finally { setSearchingChildren(false); }
                  }}
                  placeholder="Search tasks by title or number..."
                  className="w-full rounded-lg border border-surface-700 bg-surface-900 pl-8 pr-3 py-2 text-sm text-white placeholder:text-surface-500 outline-none focus:border-primary-500"
                />
              </div>
              {childResults.length > 0 && (
                <div className="mt-1 rounded-lg border border-surface-700 bg-surface-900 max-h-40 overflow-y-auto divide-y divide-surface-800">
                  {childResults.map((t) => {
                    const TIcon = TYPES.find((ty) => ty.value === t.type)?.icon || FileText;
                    const tColor = TYPES.find((ty) => ty.value === t.type)?.color || "text-surface-400";
                    return (
                      <button
                        key={t.id}
                        onClick={() => {
                          setSelectedChildren((prev) => [...prev, t]);
                          setChildResults((prev) => prev.filter((r) => r.id !== t.id));
                          setChildSearch("");
                        }}
                        className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-surface-800/50 transition-colors"
                      >
                        <TIcon className={clsx("h-4 w-4 shrink-0", tColor)} />
                        <span className="text-xs font-mono text-surface-500">{t.key || `#${t.number}`}</span>
                        <span className="text-sm text-surface-300 truncate">{t.title}</span>
                      </button>
                    );
                  })}
                </div>
              )}
              {selectedChildren.length > 0 && (
                <div className="mt-2 space-y-1">
                  {selectedChildren.map((child) => {
                    const CIcon = TYPES.find((ty) => ty.value === child.type)?.icon || FileText;
                    const cColor = TYPES.find((ty) => ty.value === child.type)?.color || "text-surface-400";
                    return (
                      <div key={child.id} className="flex items-center gap-2 rounded-md bg-surface-800/50 px-2.5 py-1.5">
                        <CIcon className={clsx("h-4 w-4 shrink-0", cColor)} />
                        <span className="text-xs font-mono text-surface-500">{child.key || `#${child.number}`}</span>
                        <span className="text-sm text-surface-300 flex-1 truncate">{child.title}</span>
                        <button onClick={() => setSelectedChildren((prev) => prev.filter((c) => c.id !== child.id))} className="text-surface-500 hover:text-red-400">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Subtasks (edit mode — live create/link/unlink) */}
          {isEdit && task?.id && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[13px] font-medium text-surface-400 uppercase tracking-wider flex items-center gap-1.5">
                  <ListTree className="h-4 w-4" />
                  Subtasks ({existingChildren.length})
                </label>
                {!showAddSubtask && (
                  <button
                    onClick={() => setShowAddSubtask(true)}
                    className="flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add
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
                      onKeyDown={(e) => { if (e.key === "Enter") createEditSubtask(); if (e.key === "Escape") { setShowAddSubtask(false); setSubtaskTitle(""); } }}
                      placeholder="New subtask title..."
                      className="flex-1 rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-white placeholder:text-surface-500 outline-none focus:border-primary-500"
                      autoFocus
                    />
                    <button
                      onClick={createEditSubtask}
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
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-surface-500" />
                    <input
                      type="text"
                      value={subtaskSearch}
                      onChange={async (e) => {
                        const q = e.target.value;
                        setSubtaskSearch(q);
                        if (q.length < 2) { setSubtaskSearchResults([]); return; }
                        try {
                          const res = await api.get<any>(`/api/v1/projects/${projectId}/tasks?search=${encodeURIComponent(q)}`);
                          const existingIds = existingChildren.map((c: any) => c.id);
                          existingIds.push(task.id);
                          setSubtaskSearchResults((res?.data ?? []).filter((t: any) => !existingIds.includes(t.id)).slice(0, 8));
                        } catch {}
                      }}
                      placeholder="Or search existing tasks to link..."
                      className="w-full rounded-lg border border-surface-700 bg-surface-900 pl-8 pr-3 py-2 text-sm text-white placeholder:text-surface-500 outline-none focus:border-primary-500"
                    />
                  </div>
                  {subtaskSearchResults.length > 0 && (
                    <div className="rounded-lg border border-surface-700 bg-surface-900 max-h-40 overflow-y-auto divide-y divide-surface-800">
                      {subtaskSearchResults.map((t) => {
                        const TIcon = TYPES.find((ty) => ty.value === t.type)?.icon || FileText;
                        const tColor = TYPES.find((ty) => ty.value === t.type)?.color || "text-surface-400";
                        return (
                          <button
                            key={t.id}
                            onClick={() => linkSubtask(t)}
                            className="flex items-center gap-2 w-full px-3 py-1.5 text-left hover:bg-surface-800/50 transition-colors"
                          >
                            <TIcon className={clsx("h-4 w-4 shrink-0", tColor)} />
                            <span className="text-xs font-mono text-surface-500">{t.key || `#${t.number}`}</span>
                            <span className="text-sm text-surface-300 truncate">{t.title}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Existing children list */}
              <div className="space-y-1">
                {existingChildren.length === 0 && !showAddSubtask && (
                  <div className="text-center py-3">
                    <p className="text-sm text-surface-500">No subtasks yet</p>
                    <button onClick={() => setShowAddSubtask(true)} className="mt-1 inline-flex items-center gap-1 text-xs text-primary-400 hover:text-primary-300">
                      <Plus className="h-3.5 w-3.5" /> Add a subtask
                    </button>
                  </div>
                )}
                {existingChildren.map((child) => {
                  const CIcon = TYPES.find((ty) => ty.value === child.type)?.icon || FileText;
                  const cColor = TYPES.find((ty) => ty.value === child.type)?.color || "text-surface-400";
                  const isDone = child.status === "Done" || child.status === "completed";
                  return (
                    <div key={child.id} className="flex items-center gap-2 rounded-md bg-surface-800/50 px-2.5 py-1.5 group cursor-pointer hover:bg-surface-800/70 transition-colors"
                      onClick={() => router.push(`/org/${params.orgSlug}/projects/${params.projectSlug}/tasks/${child.key || child.id}`)}
                    >
                      <CIcon className={clsx("h-4 w-4 shrink-0", cColor)} />
                      <span className="text-xs font-mono text-surface-500">{child.key || `#${child.number}`}</span>
                      <span className={clsx("text-sm flex-1 truncate", isDone ? "line-through text-surface-500" : "text-surface-300")}>{child.title}</span>
                      <span className={clsx("text-[11px] rounded px-1 py-0.5", isDone ? "bg-emerald-500/10 text-emerald-400" : "bg-surface-700 text-surface-400")}>{child.status}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); unlinkSubtask(child.id); }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-surface-600 hover:text-red-400 transition-all"
                        title="Remove subtask"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Comments (edit mode only) */}
          {isEdit && task?.id && (
            <div>
              <label className="block text-[13px] font-medium text-surface-400 mb-2 uppercase tracking-wider flex items-center gap-1.5">
                <MessageSquare className="h-4 w-4" />
                Comments ({comments.length})
              </label>

              {/* Comment list */}
              <div className="space-y-3 mb-3">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex gap-2.5 group">
                    <div className="h-6 w-6 rounded-full bg-surface-700 flex items-center justify-center shrink-0 mt-0.5">
                      <User className="h-3.5 w-3.5 text-surface-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-medium text-surface-300">
                          {comment.is_ai ? "AI" : `User #${comment.user_id}`}
                        </span>
                        <span className="text-xs text-surface-600">{timeAgo(comment.created_at)}</span>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
                          <button onClick={() => { setEditingCommentId(comment.id); setEditCommentBody(comment.body); }} className="p-0.5 text-surface-600 hover:text-blue-400"><Pencil className="h-3.5 w-3.5" /></button>
                          <button onClick={() => deleteComment(comment.id)} className="p-0.5 text-surface-600 hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                      </div>
                      {editingCommentId === comment.id ? (
                        <div>
                          <textarea
                            value={editCommentBody}
                            onChange={(e) => setEditCommentBody(e.target.value)}
                            rows={2}
                            className="w-full rounded-md border border-surface-700 bg-surface-900 px-2.5 py-1.5 text-sm text-white outline-none"
                            autoFocus
                          />
                          <div className="flex gap-2 mt-1">
                            <button onClick={() => saveCommentEdit(comment.id)} disabled={savingComment} className="text-xs text-primary-400 hover:underline">
                              {savingComment ? "Saving..." : "Save"}
                            </button>
                            <button onClick={() => setEditingCommentId(null)} className="text-xs text-surface-500">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1">
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
                                  <div className="flex flex-wrap gap-1.5 mt-1">
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
                                            className="max-w-[160px] max-h-[120px] object-cover"
                                          />
                                        </a>
                                      ) : (
                                        <a
                                          key={i}
                                          href={`${apiBase}${fileUrl}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1.5 rounded-md bg-surface-800 border border-surface-700 px-2 py-1 text-xs text-surface-300 hover:border-primary-500/50 hover:text-primary-400 transition-colors"
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
                {comments.length === 0 && (
                  <p className="text-sm text-surface-500 text-center py-3">No comments yet</p>
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
                      className="rounded-lg border border-surface-700 p-2 text-surface-400 hover:text-primary-400 hover:border-primary-500/50 transition-colors cursor-pointer"
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
                            setCommentPendingFiles((prev) => [...prev, ...Array.from(fileList)]);
                          }
                        }}
                      />
                    </label>
                    <button
                      onClick={postComment}
                      disabled={postingComment || (!newComment.trim() && commentPendingFiles.length === 0)}
                      className="rounded-lg bg-primary-500 p-2 text-white hover:bg-primary-600 disabled:opacity-40 transition-colors"
                    >
                      {postingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                {commentPendingFiles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {commentPendingFiles.map((file, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 rounded-md bg-surface-800 border border-surface-700 px-2 py-1 text-xs text-surface-300"
                      >
                        <Paperclip className="h-3 w-3 text-surface-500" />
                        <span className="max-w-[120px] truncate">{file.name}</span>
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
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-surface-800 flex justify-between items-center">
          <button
            onClick={onClose}
            className="rounded-lg border border-surface-700 px-4 py-2 text-sm text-surface-400 hover:bg-surface-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !title.trim()}
            className={clsx(
              "flex items-center gap-1.5 rounded-lg px-5 py-2 text-sm font-medium transition-all",
              saving || !title.trim()
                ? "bg-surface-800 text-surface-500 cursor-not-allowed"
                : "bg-gradient-to-r from-primary-500 to-blue-600 text-white hover:from-primary-600 hover:to-blue-700 shadow-lg shadow-primary-500/20"
            )}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {isEdit ? "Update Task" : "Create Task"}
          </button>
        </div>
      </div>

      {/* Attachment Preview Modal */}
      {previewAttachment && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setPreviewAttachment(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg mx-4 rounded-2xl border border-surface-700 bg-[#111827] shadow-2xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-surface-800">
              <div className="flex items-center gap-3 min-w-0">
                <FileIcon className="h-5 w-5 text-primary-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{previewAttachment.file_name}</p>
                  <p className="text-xs text-surface-500">
                    {(previewAttachment.file_size / 1024).toFixed(0)} KB · {previewAttachment.mime_type}
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

            {previewAttachment.mime_type?.startsWith('image/') && (
              <div className="px-5 py-4 flex items-center justify-center bg-surface-900/50 max-h-[400px] overflow-hidden">
                <img
                  src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}${previewAttachment.file_url}`}
                  alt={previewAttachment.file_name}
                  className="max-w-full max-h-[360px] rounded-lg object-contain"
                />
              </div>
            )}

            {!previewAttachment.mime_type?.startsWith('image/') && (
              <div className="px-5 py-10 flex flex-col items-center justify-center gap-3 bg-surface-900/30">
                <FileIcon className="h-16 w-16 text-surface-600" />
                <p className="text-sm text-surface-500">Preview not available</p>
              </div>
            )}

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
              <button
                onClick={() => {
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
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-primary-500 hover:bg-primary-400 px-4 py-2.5 text-sm font-medium text-white transition-colors"
              >
                <Download className="h-4 w-4" />
                Download
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
