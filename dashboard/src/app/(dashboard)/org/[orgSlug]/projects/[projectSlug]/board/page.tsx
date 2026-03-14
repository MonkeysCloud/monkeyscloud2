"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import TaskDrawer from "@/components/tasks/TaskDrawer";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Columns3,
  Plus,
  Loader2,
  Settings2,
  ArrowUp,
  ArrowDown,
  Pencil,
  Trash2,
  X,
  Check,
  AlertCircle,
  Bug,
  Lightbulb,
  Layers,
  BookOpen,
  Zap,
  FileText,
  GripVertical,
  Calendar,
} from "lucide-react";
import clsx from "clsx";

interface Task {
  id: number;
  number: number;
  key?: string;
  title: string;
  type: string;
  status: string;
  priority: string;
  position: number;
  story_points: string | null;
  sprint_id: number | null;
  assignee_id: number | null;
  due_date: string | null;
  labels: { id: number; name: string; color: string }[];
}

interface BoardData {
  id: number;
  name: string;
  type: string;
  columns: string[];
  done_columns: string[];
  prefix: string;
}

const COLUMN_COLORS = [
  "from-surface-600 to-surface-700",
  "from-amber-500 to-orange-500",
  "from-blue-500 to-indigo-500",
  "from-emerald-500 to-green-500",
  "from-violet-500 to-purple-500",
  "from-pink-500 to-rose-500",
  "from-cyan-500 to-teal-500",
  "from-red-500 to-orange-500",
  "from-fuchsia-500 to-pink-500",
  "from-lime-500 to-emerald-500",
];

const PRIORITY_BORDER: Record<string, string> = {
  urgent: "border-l-red-500",
  high: "border-l-orange-500",
  medium: "border-l-amber-500",
  low: "border-l-blue-500",
  none: "border-l-surface-700",
};

const TYPE_ICONS: Record<string, { icon: typeof FileText; color: string }> = {
  task: { icon: FileText, color: "text-blue-400" },
  bug: { icon: Bug, color: "text-red-400" },
  feature: { icon: Lightbulb, color: "text-amber-400" },
  improvement: { icon: Zap, color: "text-violet-400" },
  epic: { icon: Layers, color: "text-purple-400" },
  story: { icon: BookOpen, color: "text-emerald-400" },
};

/* ─── Sortable Task Card ─── */
function SortableTaskCard({
  task,
  prefix,
  onClick,
}: {
  task: Task;
  prefix: string;
  onClick: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data: { type: "task", task } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  const typeInfo = TYPE_ICONS[task.type] ?? TYPE_ICONS.task;
  const TypeIcon = typeInfo.icon;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={clsx(
        "rounded-lg bg-surface-900/60 border border-surface-800 p-2.5 hover:border-surface-600 transition-all group border-l-2 cursor-grab active:cursor-grabbing touch-none overflow-hidden",
        PRIORITY_BORDER[task.priority] || "border-l-surface-700"
      )}
    >
      <div className="flex items-start justify-between gap-1 mb-1">
        <span className="text-xs font-mono text-surface-500">
          {task.key || `${prefix}-${task.number}`}
        </span>
        <TypeIcon className={clsx("h-4 w-4 shrink-0", typeInfo.color)} />
      </div>
      {/* Line 2: Title */}
      <p className="text-sm text-surface-200 leading-snug group-hover:text-white transition-colors line-clamp-2">
        {task.title}
      </p>
      {/* Line 2b: Labels */}
      {task.labels?.length > 0 && (
        <div className="flex items-center gap-1 mt-1.5 overflow-x-auto flex-nowrap scrollbar-hide">
          {task.labels.map((l) => (
            <span
              key={l.id}
              className="rounded-full px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap shrink-0"
              style={{ backgroundColor: l.color + "20", color: l.color }}
            >
              {l.name}
            </span>
          ))}
        </div>
      )}
      {/* Line 3: Due date + Story points */}
      {(task.due_date || task.story_points) && (
        <div className="flex items-center gap-1.5 mt-1.5">
          {task.due_date && (() => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const due = new Date(task.due_date + "T00:00:00");
            const isOverdue = due < today;
            const isToday = due.getTime() === today.getTime();
            return (
              <span
                className={clsx(
                  "flex items-center gap-1 text-[11px] font-medium rounded px-1.5 py-0.5 whitespace-nowrap shrink-0",
                  isOverdue
                    ? "bg-red-500/15 text-red-400"
                    : isToday
                      ? "bg-amber-500/15 text-amber-400"
                      : "bg-surface-800 text-surface-400"
                )}
              >
                <Calendar className="h-3 w-3" />
                {due.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            );
          })()}
          {task.story_points && (
            <span className="text-[11px] text-surface-500 bg-surface-800 rounded px-1.5 py-0.5 ml-auto font-mono shrink-0">
              {task.story_points}pt
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Static Card (for DragOverlay) ─── */
function TaskCardOverlay({ task, prefix }: { task: Task; prefix: string }) {
  const typeInfo = TYPE_ICONS[task.type] ?? TYPE_ICONS.task;
  const TypeIcon = typeInfo.icon;
  return (
    <div
      className={clsx(
        "rounded-lg bg-surface-900 border border-primary-500/50 p-2.5 shadow-xl shadow-primary-500/10 border-l-2 w-[250px]",
        PRIORITY_BORDER[task.priority] || "border-l-surface-700"
      )}
    >
      <div className="flex items-start justify-between gap-1 mb-1">
        <span className="text-xs font-mono text-surface-500">
          {task.key || `${prefix}-${task.number}`}
        </span>
        <TypeIcon className={clsx("h-4 w-4 shrink-0", typeInfo.color)} />
      </div>
      <p className="text-sm text-white leading-snug line-clamp-2">{task.title}</p>
    </div>
  );
}

/* ─── Droppable Column ─── */
function DroppableColumn({
  col,
  idx,
  tasks,
  prefix,
  onTaskClick,
  onAddTask,
}: {
  col: string;
  idx: number;
  tasks: Task[];
  prefix: string;
  onTaskClick: (t: Task) => void;
  onAddTask: (status: string) => void;
}) {
  const taskIds = useMemo(() => tasks.map((t) => t.id), [tasks]);
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({ id: `col:${col}` });

  return (
    <div className={clsx(
      "rounded-xl border bg-[#111827]/80 flex flex-col overflow-hidden transition-all",
      isOver ? "border-primary-500/40 ring-1 ring-primary-500/20" : "border-surface-800"
    )}>
      {/* Column Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-surface-800">
        <div className={`h-2.5 w-2.5 rounded-full bg-gradient-to-r ${COLUMN_COLORS[idx % COLUMN_COLORS.length]}`} />
        <span className="text-[13px] font-semibold text-surface-300 uppercase tracking-wider flex-1">{col}</span>
        <span className="text-xs text-surface-600 font-mono bg-surface-800/60 px-1.5 py-0.5 rounded">{tasks.length}</span>
      </div>

      {/* Sortable task list */}
      <SortableContext items={taskIds} strategy={verticalListSortingStrategy} id={col}>
        <div ref={setDroppableRef} className="flex-1 p-2 space-y-1.5 min-h-[180px] overflow-y-auto max-h-[60vh]" data-column={col}>
          {tasks.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <p className={clsx("text-[13px]", isOver ? "text-primary-400" : "text-surface-600")}>{isOver ? "Drop here" : "Drop tasks here"}</p>
            </div>
          ) : (
            tasks.map((task) => (
              <SortableTaskCard
                key={task.id}
                task={task}
                prefix={prefix}
                onClick={() => onTaskClick(task)}
              />
            ))
          )}
        </div>
      </SortableContext>

      {/* Add task */}
      <div className="px-2 pb-2">
        <button
          onClick={() => onAddTask(col)}
          className="flex w-full items-center gap-1.5 rounded-lg border border-dashed border-surface-700 px-3 py-2 text-[13px] text-surface-500 hover:text-surface-300 hover:border-surface-600 hover:bg-surface-800/30 transition-all"
        >
          <Plus className="h-4 w-4" />
          Add task
        </button>
      </div>
    </div>
  );
}

/* ─── Main Board Page ─── */
export default function BoardPage() {
  const params = useParams();
  const { currentOrg } = useAuthStore();
  const projectSlug = params.projectSlug as string;
  const orgSlug = params.orgSlug as string;
  const orgId = currentOrg?.id;

  const [projectId, setProjectId] = useState<number | null>(null);
  const [board, setBoard] = useState<BoardData | null>(null);
  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [sprints, setSprints] = useState<{ id: number; name: string; status: string }[]>([]);
  const [selectedSprintId, setSelectedSprintId] = useState<number | "all" | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Column settings
  const [showSettings, setShowSettings] = useState(false);
  const [editColumns, setEditColumns] = useState<string[]>([]);
  const [editDoneColumns, setEditDoneColumns] = useState<string[]>(["Done"]);
  const [newColName, setNewColName] = useState("");
  const [editingColIdx, setEditingColIdx] = useState<number | null>(null);
  const [editColName, setEditColName] = useState("");

  // Task drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any | null>(null);
  const [createInStatus, setCreateInStatus] = useState<string | null>(null);

  // DnD state
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Resolve project — wait until currentOrg matches URL
  useEffect(() => {
    async function resolve() {
      if (!orgId || currentOrg?.slug !== orgSlug) return;
      try {
        const res = await api.get<any>(`/api/v1/organizations/${orgId}/projects`);
        const proj = (res?.data ?? []).find((p: any) => p.slug === projectSlug);
        if (proj) setProjectId(proj.id);
      } catch {}
    }
    resolve();
  }, [orgId, currentOrg?.slug, orgSlug, projectSlug]);

  // Load board + tasks + sprints
  const sprintAutoSelected = useRef(false);
  const loadAll = useCallback(async () => {
    if (!projectId || !orgId) return;
    setLoading(true);
    try {
      const [boardRes, tasksRes, sprintsRes] = await Promise.all([
        api.get<any>(`/api/v1/organizations/${orgId}/projects/${projectId}/board`),
        api.get<any>(`/api/v1/projects/${projectId}/tasks?exclude_completed_sprints=1`),
        api.get<any>(`/api/v1/projects/${projectId}/sprints`),
      ]);
      setBoard(boardRes?.data ?? null);
      setEditColumns(boardRes?.data?.columns ?? []);
      setEditDoneColumns(boardRes?.data?.done_columns ?? ["Done"]);
      setAllTasks(tasksRes?.data ?? []);
      const sprintList = sprintsRes?.data ?? [];
      setSprints(sprintList);
      // Auto-select the active sprint only once
      if (!sprintAutoSelected.current) {
        sprintAutoSelected.current = true;
        const active = sprintList.find((s: any) => s.status === "active");
        setSelectedSprintId(active ? active.id : "all");
      }
    } catch {
      setError("Failed to load board.");
    } finally {
      setLoading(false);
    }
  }, [projectId, orgId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Column management
  async function saveColumns() {
    if (!projectId || !orgId) return;
    setSaving(true);
    setError("");
    try {
      const res = await api.put<any>(`/api/v1/organizations/${orgId}/projects/${projectId}/board`, { columns: editColumns, done_columns: editDoneColumns });
      setBoard(res?.data ?? null);
      setShowSettings(false);
    } catch (err: any) {
      setError(err?.data?.error || "Failed to save columns.");
    } finally {
      setSaving(false);
    }
  }

  function addColumn() {
    if (!newColName.trim() || editColumns.length >= 10) return;
    if (editColumns.some((c) => c.toLowerCase() === newColName.trim().toLowerCase())) return;
    setEditColumns([...editColumns, newColName.trim()]);
    setNewColName("");
  }

  function removeColumn(idx: number) { setEditColumns(editColumns.filter((_, i) => i !== idx)); }

  function moveColumn(idx: number, dir: -1 | 1) {
    const n = idx + dir;
    if (n < 0 || n >= editColumns.length) return;
    const c = [...editColumns];
    [c[idx], c[n]] = [c[n], c[idx]];
    setEditColumns(c);
  }

  function renameColumn(idx: number) {
    if (!editColName.trim()) return;
    if (editColumns.some((c, i) => i !== idx && c.toLowerCase() === editColName.trim().toLowerCase())) return;
    const c = [...editColumns];
    c[idx] = editColName.trim();
    setEditColumns(c);
    setEditingColIdx(null);
  }

  function handleTaskSaved(saved: any) {
    setAllTasks((prev: Task[]) => {
      const idx = prev.findIndex((t: Task) => t.id === saved.id);
      if (idx >= 0) { const c = [...prev]; c[idx] = saved; return c; }
      return [...prev, saved];
    });
  }

  // ─── DnD handlers ───

  const columns = board?.columns ?? [];
  const prefix = board?.prefix ?? "TSK";
  const hasActiveSprint = useMemo(() => sprints.some((s) => s.status === "active"), [sprints]);

  // Filter tasks by selected sprint
  const completedSprintIds = useMemo(() => new Set(
    sprints.filter((s) => s.status === "completed" || s.status === "cancelled").map((s) => s.id)
  ), [sprints]);

  const tasks: Task[] = useMemo(() => {
    if (selectedSprintId === "all" || selectedSprintId === null) {
      // Show tasks from active/planning sprints + backlog, exclude completed/cancelled sprint tasks
      return allTasks.filter((t) => !t.sprint_id || !completedSprintIds.has(t.sprint_id));
    }
    return allTasks.filter((t) => t.sprint_id === selectedSprintId);
  }, [allTasks, selectedSprintId, completedSprintIds]);

  // Group tasks by column, sorted by position
  // Tasks with unrecognized statuses (e.g. "backlog") go to the first column
  const tasksByColumn = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const col of columns) {
      map[col] = [];
    }
    for (const t of tasks) {
      if (columns.includes(t.status)) {
        map[t.status].push(t);
      } else if (columns.length > 0) {
        // Unrecognized status (like "backlog") → first column
        map[columns[0]].push(t);
      }
    }
    // Sort each column by position
    for (const col of columns) {
      map[col].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
    }
    return map;
  }, [tasks, columns]);

  // Find which column a task is in
  function findColumn(taskId: number): string | null {
    for (const col of columns) {
      if (tasksByColumn[col]?.some((t) => t.id === taskId)) return col;
    }
    return null;
  }

  // Resolve a DnD over ID to a column name
  function resolveColumn(overId: string | number): string | null {
    // Check if it's a column droppable ID (prefixed with "col:")
    if (typeof overId === "string" && overId.startsWith("col:")) {
      return overId.slice(4);
    }
    // Check if it's a column name directly (from SortableContext)
    if (typeof overId === "string" && columns.includes(overId)) {
      return overId;
    }
    // Otherwise it's a task ID — find which column it's in
    return findColumn(overId as number);
  }

  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    const task = tasks.find((t) => t.id === active.id);
    if (task) setActiveTask(task);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as number;
    const activeCol = findColumn(activeId);
    const overCol = resolveColumn(over.id);

    if (!activeCol || !overCol || activeCol === overCol) return;

    // Move task to the new column optimistically
    setAllTasks((prev: Task[]) => {
      return prev.map((t: Task) =>
        t.id === activeId ? { ...t, status: overCol } : t
      );
    });
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as number;
    const activeCol = findColumn(activeId);
    const overCol = resolveColumn(over.id);

    if (!activeCol) return;
    const targetCol = overCol || activeCol;

    // Get tasks in the target column
    const colTasks = (tasksByColumn[targetCol] || []).slice();

    const oldIdx = colTasks.findIndex((t) => t.id === activeId);
    let newIdx = colTasks.findIndex((t) => t.id === over.id);
    if (newIdx === -1) newIdx = Math.max(colTasks.length - 1, 0);

    let reordered: Task[];
    if (oldIdx !== -1 && oldIdx !== newIdx) {
      reordered = arrayMove(colTasks, oldIdx, newIdx);
    } else {
      reordered = colTasks;
    }

    // Assign new positions
    const updates = reordered.map((t, i) => ({
      id: t.id,
      status: targetCol,
      position: i,
      sprint_id: t.sprint_id ?? null,
    }));

    // Optimistic UI update
    setAllTasks((prev: Task[]) => {
      const newTasks = prev.map((t: Task) => {
        const update = updates.find((u) => u.id === t.id);
        if (update) return { ...t, status: update.status, position: update.position };
        return t;
      });
      return newTasks;
    });

    // Persist
    if (projectId && updates.length > 0) {
      try {
        await api.put(`/api/v1/projects/${projectId}/tasks/reorder`, { items: updates });
      } catch {
        // Reload on failure
        loadAll();
      }
    }
  }

  return (
    <div className="px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 max-w-[1400px] mx-auto">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <Columns3 className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Board</h1>
            <p className="text-sm text-surface-400">
              {board?.name ?? "Loading..."} • {tasks.length} task{tasks.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Sprint selector */}
          {sprints.length > 0 && (
            <select
              value={selectedSprintId === "all" ? "all" : String(selectedSprintId ?? "")}
              onChange={(e) => {
                const v = e.target.value;
                setSelectedSprintId(v === "all" ? "all" : parseInt(v));
              }}
              className="rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-white outline-none focus:border-primary-500 appearance-none cursor-pointer pr-8"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 8px center" }}
            >
              {sprints.filter((s) => s.status === "active" || s.status === "planning").map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.name} {s.status === "active" ? "●" : ""}
                </option>
              ))}
              <option value="all">All tasks</option>
            </select>
          )}
          <button
            onClick={() => { setShowSettings(!showSettings); setEditColumns(columns); setEditDoneColumns(board?.done_columns ?? ["Done"]); }}
            className={clsx(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium border transition-all",
              showSettings
                ? "bg-surface-800 text-surface-300 border-surface-700"
                : "border-surface-700 text-surface-400 hover:bg-surface-800"
            )}
          >
            <Settings2 className="h-4 w-4" />
            Columns
          </button>
          <button
            onClick={() => { setCreateInStatus(null); setEditingTask(null); setDrawerOpen(true); }}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary-500 to-blue-600 px-4 py-2 text-sm font-medium text-white hover:from-primary-600 hover:to-blue-700 transition-all shadow-lg shadow-primary-500/20"
          >
            <Plus className="h-4 w-4" />
            New Task
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 max-w-[1400px] mx-auto flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
          <button onClick={() => setError("")} className="ml-auto"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* No active sprint banner */}
      {!loading && !hasActiveSprint && sprints.length > 0 && (
        <div className="mb-4 max-w-[1400px] mx-auto flex items-center gap-3 rounded-xl bg-amber-500/10 border border-amber-500/20 px-5 py-4">
          <div className="h-10 w-10 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
            <Calendar className="h-5 w-5 text-amber-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-300">No active sprint</p>
            <p className="text-[13px] text-surface-400 mt-0.5">Start a sprint to begin tracking work on the board. You&apos;re currently viewing all backlog tasks.</p>
          </div>
          <a
            href={`/org/${orgSlug}/projects/${projectSlug}/sprints`}
            className="shrink-0 rounded-lg bg-amber-500/20 border border-amber-500/30 px-4 py-2 text-sm font-medium text-amber-300 hover:bg-amber-500/30 transition-colors"
          >
            Go to Sprints
          </a>
        </div>
      )}
      {!loading && sprints.length === 0 && (
        <div className="mb-4 max-w-[1400px] mx-auto flex items-center gap-3 rounded-xl bg-blue-500/10 border border-blue-500/20 px-5 py-4">
          <div className="h-10 w-10 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
            <Calendar className="h-5 w-5 text-blue-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-300">No sprints created yet</p>
            <p className="text-[13px] text-surface-400 mt-0.5">Create your first sprint to organize work into iterations. Tasks are shown from the backlog.</p>
          </div>
          <a
            href={`/org/${orgSlug}/projects/${projectSlug}/sprints`}
            className="shrink-0 rounded-lg bg-blue-500/20 border border-blue-500/30 px-4 py-2 text-sm font-medium text-blue-300 hover:bg-blue-500/30 transition-colors"
          >
            Create Sprint
          </a>
        </div>
      )}

      {/* Column Settings */}
      {showSettings && (
        <div className="mb-6 max-w-2xl mx-auto rounded-xl border border-surface-800 bg-[#111827] p-5 animate-in slide-in-from-top-2">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-blue-400" />
            Configure Columns
          </h3>
          <div className="space-y-1.5 mb-3">
            {editColumns.map((col, idx) => (
              <div key={idx} className="flex items-center gap-2 group">
                <div className="flex items-center gap-0.5">
                  <button onClick={() => moveColumn(idx, -1)} disabled={idx === 0} className="p-1 rounded text-surface-600 hover:text-surface-300 disabled:opacity-20"><ArrowUp className="h-4 w-4" /></button>
                  <button onClick={() => moveColumn(idx, 1)} disabled={idx === editColumns.length - 1} className="p-1 rounded text-surface-600 hover:text-surface-300 disabled:opacity-20"><ArrowDown className="h-4 w-4" /></button>
                </div>
                <div className={`h-2 w-2 rounded-full bg-gradient-to-r ${COLUMN_COLORS[idx % COLUMN_COLORS.length]}`} />
                {editingColIdx === idx ? (
                  <div className="flex-1 flex gap-1">
                    <input
                      value={editColName}
                      onChange={(e) => setEditColName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && renameColumn(idx)}
                      className="flex-1 bg-surface-900 border border-surface-700 rounded px-2 py-1 text-sm text-white outline-none focus:border-primary-500"
                      autoFocus
                    />
                    <button onClick={() => renameColumn(idx)} className="p-1 text-emerald-400"><Check className="h-4 w-4" /></button>
                    <button onClick={() => setEditingColIdx(null)} className="p-1 text-surface-500"><X className="h-4 w-4" /></button>
                  </div>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-surface-300">{col}</span>
                    <label className="flex items-center gap-1 text-xs text-surface-500 cursor-pointer" title="Mark as done state">
                      <input
                        type="checkbox"
                        checked={editDoneColumns.includes(col)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setEditDoneColumns((prev) => [...prev, col]);
                          } else {
                            setEditDoneColumns((prev) => prev.filter((c) => c !== col));
                          }
                        }}
                        className="accent-emerald-500 h-3.5 w-3.5"
                      />
                      Done
                    </label>
                    <button onClick={() => { setEditingColIdx(idx); setEditColName(col); }} className="opacity-0 group-hover:opacity-100 p-1 text-surface-500 hover:text-surface-300"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => removeColumn(idx)} className="opacity-0 group-hover:opacity-100 p-1 text-surface-500 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
                  </>
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={newColName}
              onChange={(e) => setNewColName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addColumn()}
              placeholder="New column name"
              className="flex-1 rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-white placeholder:text-surface-500 outline-none focus:border-primary-500"
            />
            <button onClick={addColumn} className="rounded-lg bg-primary-500/10 border border-primary-500/20 px-3 py-2 text-sm text-primary-400 hover:bg-primary-500/20"><Plus className="h-4 w-4" /></button>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={() => setShowSettings(false)} className="px-3 py-1.5 text-sm text-surface-400 hover:text-surface-300">Cancel</button>
            <button onClick={saveColumns} disabled={saving} className="rounded-lg bg-primary-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </button>
          </div>
        </div>
      )}

      {/* Board with DnD — only when a sprint is active */}
      {hasActiveSprint && (loading ? (
        <div className="max-w-[1400px] mx-auto grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse rounded-xl bg-surface-800/40 border border-surface-800 h-64" />
          ))}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="max-w-[1400px] mx-auto">
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(columns.length, 6)}, minmax(0, 1fr))` }}>
              {columns.map((col, idx) => (
                <DroppableColumn
                  key={col}
                  col={col}
                  idx={idx}
                  tasks={tasksByColumn[col] || []}
                  prefix={prefix}
                  onTaskClick={(task) => { setEditingTask(task); setDrawerOpen(true); }}
                  onAddTask={(status) => { setCreateInStatus(status); setEditingTask(null); setDrawerOpen(true); }}
                />
              ))}
            </div>
          </div>

          <DragOverlay>
            {activeTask ? <TaskCardOverlay task={activeTask} prefix={prefix} /> : null}
          </DragOverlay>
        </DndContext>
      ))}

      {/* Drawer */}
      {projectId && orgId && (
        <TaskDrawer
          open={drawerOpen}
          onClose={() => { setDrawerOpen(false); setEditingTask(null); setCreateInStatus(null); }}
          onSaved={handleTaskSaved}
          projectId={projectId}
          orgId={orgId}
          task={editingTask ?? (createInStatus ? { status: createInStatus, sprint_id: selectedSprintId || undefined } : undefined)}
          boardColumns={columns}
        />
      )}
    </div>
  );
}
