"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import TaskDrawer from "@/components/tasks/TaskDrawer";
import {
  ListTodo,
  Plus,
  Loader2,
  Search,
  Filter,
  X,
  ChevronDown,
  Bug,
  Lightbulb,
  Layers,
  BookOpen,
  Zap,
  FileText,
  ArrowUpDown,
  Calendar,
  Tag,
} from "lucide-react";
import clsx from "clsx";

interface Task {
  id: number;
  number: number;
  key: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  priority: string;
  assignee_id: number | null;
  sprint_id: number | null;
  story_points: string | null;
  due_date: string | null;
  labels: { id: number; name: string; color: string }[];
  created_at: string;
}

const TYPE_ICONS: Record<string, { icon: typeof FileText; color: string }> = {
  task:        { icon: FileText, color: "text-blue-400" },
  bug:         { icon: Bug, color: "text-red-400" },
  feature:     { icon: Lightbulb, color: "text-amber-400" },
  improvement: { icon: Zap, color: "text-violet-400" },
  epic:        { icon: Layers, color: "text-purple-400" },
  story:       { icon: BookOpen, color: "text-emerald-400" },
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-red-500",
  high:   "bg-orange-500",
  medium: "bg-amber-500",
  low:    "bg-blue-500",
  none:   "bg-surface-600",
};

const STATUS_COLORS: Record<string, string> = {
  backlog:       "bg-surface-600 text-surface-300",
  "To Do":       "bg-surface-700 text-surface-200",
  "In Progress": "bg-blue-500/15 text-blue-400",
  "Review":      "bg-violet-500/15 text-violet-400",
  "Done":        "bg-emerald-500/15 text-emerald-400",
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function TasksPage() {
  const params = useParams();
  const router = useRouter();
  const { currentOrg } = useAuthStore();
  const projectSlug = params.projectSlug as string;
  const orgSlug = params.orgSlug as string;
  const orgId = currentOrg?.slug === params.orgSlug ? currentOrg?.id : undefined;

  const [projectId, setProjectId] = useState<number | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [boardColumns, setBoardColumns] = useState<string[]>([]);

  // Filters
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterType, setFilterType] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any | null>(null);

  // Sort
  const [sortField, setSortField] = useState<"number" | "priority" | "created_at">("number");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Resolve project + board
  useEffect(() => {
    async function resolve() {
      if (!orgId) return;
      try {
        const res = await api.get<any>(`/api/v1/organizations/${orgId}/projects`);
        const proj = (res?.data ?? []).find((p: any) => p.slug === projectSlug);
        if (proj) {
          setProjectId(proj.id);
          // Load board columns
          try {
            const boardRes = await api.get<any>(`/api/v1/organizations/${orgId}/projects/${proj.id}/board`);
            setBoardColumns(boardRes?.data?.columns ?? ["To Do", "In Progress", "Review", "Done"]);
          } catch {
            setBoardColumns(["To Do", "In Progress", "Review", "Done"]);
          }
        }
      } catch {}
    }
    resolve();
  }, [orgId, projectSlug]);

  // Load tasks
  const loadTasks = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);
      if (filterPriority) params.set("priority", filterPriority);
      if (filterType) params.set("type", filterType);
      params.set("exclude_completed_sprints", "1");
      const qs = params.toString();
      const res = await api.get<any>(`/api/v1/projects/${projectId}/tasks?${qs}`);
      setTasks(res?.data ?? []);
    } catch {
      setError("Failed to load tasks.");
    } finally {
      setLoading(false);
    }
  }, [projectId, filterStatus, filterPriority, filterType]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  // Client-side search + sort
  let filtered = tasks;
  if (search) {
    const s = search.toLowerCase();
    filtered = filtered.filter(
      (t) => t.title.toLowerCase().includes(s) || String(t.number).includes(s)
    );
  }

  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3, none: 4 };
  filtered = [...filtered].sort((a, b) => {
    if (sortField === "number") return sortDir === "asc" ? a.number - b.number : b.number - a.number;
    if (sortField === "priority") {
      const pa = (priorityOrder as any)[a.priority] ?? 5;
      const pb = (priorityOrder as any)[b.priority] ?? 5;
      return sortDir === "asc" ? pa - pb : pb - pa;
    }
    return sortDir === "asc"
      ? new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      : new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  function toggleSort(field: typeof sortField) {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("desc"); }
  }

  function handleTaskSaved(savedTask: any) {
    setTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === savedTask.id);
      if (idx >= 0) { const copy = [...prev]; copy[idx] = savedTask; return copy; }
      return [savedTask, ...prev];
    });
  }

  function openEdit(task: Task) {
    setEditingTask(task);
    setDrawerOpen(true);
  }

  function openCreate() {
    setEditingTask(null);
    setDrawerOpen(true);
  }

  async function quickStatusChange(taskId: number, newStatus: string) {
    try {
      const res = await api.put<any>(`/api/v1/tasks/${taskId}`, { status: newStatus });
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...res.data } : t)));
    } catch {}
  }

  const activeFilters = [filterStatus, filterPriority, filterType].filter(Boolean).length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <ListTodo className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Tasks</h1>
            <p className="text-sm text-surface-400">
              {tasks.length} task{tasks.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary-500 to-blue-600 px-4 py-2 text-sm font-medium text-white hover:from-primary-600 hover:to-blue-700 transition-all shadow-lg shadow-primary-500/20"
        >
          <Plus className="h-4 w-4" />
          New Task
        </button>
      </div>

      {/* Search + Filters */}
      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks by title or number..."
            className="w-full rounded-lg border border-surface-700 bg-surface-900 pl-10 pr-3 py-2 text-sm text-white placeholder:text-surface-500 outline-none focus:border-primary-500"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={clsx(
            "flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors",
            activeFilters > 0
              ? "border-primary-500/30 bg-primary-500/10 text-primary-400"
              : "border-surface-700 text-surface-400 hover:bg-surface-800"
          )}
        >
          <Filter className="h-4 w-4" />
          Filters
          {activeFilters > 0 && (
            <span className="ml-1 h-4 w-4 rounded-full bg-primary-500 text-[13px] text-white flex items-center justify-center font-bold">
              {activeFilters}
            </span>
          )}
        </button>
      </div>

      {/* Filter Dropdowns */}
      {showFilters && (
        <div className="mb-4 flex items-center gap-3 animate-in slide-in-from-top-1">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-white outline-none [color-scheme:dark]"
          >
            <option value="">All Statuses</option>
            <option value="backlog">Backlog</option>
            {boardColumns.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-white outline-none [color-scheme:dark]"
          >
            <option value="">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
            <option value="none">None</option>
          </select>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-white outline-none [color-scheme:dark]"
          >
            <option value="">All Types</option>
            <option value="task">Task</option>
            <option value="bug">Bug</option>
            <option value="feature">Feature</option>
            <option value="improvement">Improvement</option>
            <option value="epic">Epic</option>
            <option value="story">Story</option>
          </select>
          {activeFilters > 0 && (
            <button
              onClick={() => { setFilterStatus(""); setFilterPriority(""); setFilterType(""); }}
              className="flex items-center gap-1 text-[13px] text-surface-500 hover:text-red-400"
            >
              <X className="h-4 w-4" />
              Clear
            </button>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
          <span>{error}</span>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="animate-pulse h-14 rounded-lg bg-surface-800/40 border border-surface-800" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        /* Empty */
        <div className="text-center py-16 rounded-2xl border border-dashed border-surface-800 bg-[#111827]/50">
          <ListTodo className="h-10 w-10 mx-auto text-surface-600 mb-3" />
          <h3 className="text-sm font-medium text-surface-300 mb-1">
            {tasks.length === 0 ? "No tasks yet" : "No tasks match your filters"}
          </h3>
          <p className="text-sm text-surface-500 mb-4">
            {tasks.length === 0 ? "Create your first task to get started" : "Try adjusting your search or filters"}
          </p>
          {tasks.length === 0 && (
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary-500/10 border border-primary-500/20 px-4 py-2 text-sm text-primary-400 hover:bg-primary-500/20"
            >
              <Plus className="h-4 w-4" />
              Create your first task
            </button>
          )}
        </div>
      ) : (
        /* Task Table */
        <div className="rounded-xl border border-surface-800 overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-[60px_1fr_100px_90px_90px_90px] gap-2 px-4 py-2.5 bg-surface-800/30 border-b border-surface-800 text-xs font-semibold text-surface-500 uppercase tracking-wider">
            <button onClick={() => toggleSort("number")} className="flex items-center gap-0.5 hover:text-surface-300">
              # <ArrowUpDown className="h-2.5 w-2.5" />
            </button>
            <span>Title</span>
            <span>Status</span>
            <button onClick={() => toggleSort("priority")} className="flex items-center gap-0.5 hover:text-surface-300">
              Priority <ArrowUpDown className="h-2.5 w-2.5" />
            </button>
            <span>Type</span>
            <span>Due</span>
          </div>

          {/* Task Rows */}
          {filtered.map((task) => {
            const typeInfo = TYPE_ICONS[task.type] ?? TYPE_ICONS.task;
            const TypeIcon = typeInfo.icon;
            const statusClass = STATUS_COLORS[task.status] || "bg-surface-700 text-surface-300";

            return (
              <div
                key={task.id}
                onClick={() => router.push(`/org/${orgSlug}/projects/${projectSlug}/tasks/${task.key || task.id}`)}
                className="grid grid-cols-[60px_1fr_100px_90px_90px_90px] gap-2 px-4 py-3 border-b border-surface-800/50 hover:bg-surface-800/20 cursor-pointer transition-colors group"
              >
                {/* Number */}
                <span className="text-[13px] font-mono text-surface-500">
                  {task.key || `#${task.number}`}
                </span>

                {/* Title + Labels */}
                <div className="min-w-0">
                  <p className="text-sm text-white truncate group-hover:text-primary-400 transition-colors">
                    {task.title}
                  </p>
                  {task.labels?.length > 0 && (
                    <div className="flex gap-1 mt-0.5">
                      {task.labels.slice(0, 3).map((l) => (
                        <span
                          key={l.id}
                          className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[13px] font-medium"
                          style={{ backgroundColor: l.color + "20", color: l.color }}
                        >
                          {l.name}
                        </span>
                      ))}
                      {task.labels.length > 3 && (
                        <span className="text-[13px] text-surface-500">+{task.labels.length - 3}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Status */}
                <div>
                  <span className={clsx("inline-block rounded-md px-2 py-0.5 text-xs font-medium", statusClass)}>
                    {task.status}
                  </span>
                </div>

                {/* Priority */}
                <div className="flex items-center gap-1.5">
                  <span className={clsx("h-2 w-2 rounded-full", PRIORITY_COLORS[task.priority] || "bg-surface-600")} />
                  <span className="text-[13px] text-surface-400 capitalize">{task.priority}</span>
                </div>

                {/* Type */}
                <div className="flex items-center gap-1">
                  <TypeIcon className={clsx("h-4 w-4", typeInfo.color)} />
                  <span className="text-[13px] text-surface-400 capitalize">{task.type}</span>
                </div>

                {/* Due Date */}
                <div className="text-[13px] text-surface-500">
                  {task.due_date ? (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {formatDate(task.due_date)}
                    </span>
                  ) : (
                    "—"
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Stats */}
      {tasks.length > 0 && (
        <div className="flex items-center justify-between mt-3 text-[13px] text-surface-500">
          <span>Showing {filtered.length} of {tasks.length}</span>
          <div className="flex gap-3">
            {["backlog", ...boardColumns].map((s) => {
              const count = tasks.filter((t) => t.status === s).length;
              if (!count) return null;
              return <span key={s}>{count} {s.toLowerCase()}</span>;
            })}
          </div>
        </div>
      )}

      {/* Drawer */}
      {projectId && orgId && (
        <TaskDrawer
          open={drawerOpen}
          onClose={() => { setDrawerOpen(false); setEditingTask(null); }}
          onSaved={handleTaskSaved}
          projectId={projectId}
          orgId={orgId}
          task={editingTask}
          boardColumns={boardColumns}
        />
      )}
    </div>
  );
}
