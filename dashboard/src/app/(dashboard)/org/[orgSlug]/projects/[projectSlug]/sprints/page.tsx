"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
  Zap,
  Plus,
  Loader2,
  Pencil,
  Trash2,
  X,
  Check,
  AlertCircle,
  CalendarDays,
  Target,
  Play,
  CheckCircle2,
  Ban,
  Clock,
  FileText,
  ListTodo,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  TrendingUp,
  GripVertical,
  Trophy,
  MousePointerClick,
} from "lucide-react";
import clsx from "clsx";

interface Sprint {
  id: number;
  name: string;
  goal: string | null;
  starts_at: string;
  ends_at: string;
  status: "planning" | "active" | "completed" | "cancelled";
  velocity: string | null;
}

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
  labels: { id: number; name: string; color: string }[];
}

const STATUS_CONFIG: Record<Sprint["status"], { label: string; icon: typeof Zap; class: string; bg: string }> = {
  planning:  { label: "Planning",  icon: Clock,        class: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/20" },
  active:    { label: "Active",    icon: Play,         class: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  completed: { label: "Completed", icon: CheckCircle2, class: "text-primary-400", bg: "bg-primary-500/10 border-primary-500/20" },
  cancelled: { label: "Cancelled", icon: Ban,          class: "text-surface-500", bg: "bg-surface-800/40 border-surface-700" },
};

const PRIORITY_DOTS: Record<string, string> = {
  urgent: "bg-red-500", high: "bg-orange-500", medium: "bg-amber-500", low: "bg-blue-500", none: "bg-surface-600",
};

function daysLeft(endsAt: string): number {
  return Math.ceil((new Date(endsAt).getTime() - Date.now()) / 86400000);
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function sprintDuration(start: string, end: string): string {
  const days = Math.ceil((new Date(end).getTime() - new Date(start).getTime()) / 86400000);
  const weeks = Math.round(days / 7);
  return weeks > 0 ? `${weeks} week${weeks !== 1 ? "s" : ""}` : `${days} day${days !== 1 ? "s" : ""}`;
}

/* ─── Sortable Task Row ─── */
function SortableTaskRow({ task, sprints, onAssign, onTaskClick, selectionMode, isSelected, onToggleSelect }: { task: Task; sprints: Sprint[]; onAssign?: (taskId: number, sprintId: number) => void; onTaskClick?: (task: Task) => void; selectionMode?: boolean; isSelected?: boolean; onToggleSelect?: (taskId: number) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { type: "task", task },
    disabled: selectionMode,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(selectionMode ? {} : { ...attributes, ...listeners })}
      onClick={selectionMode ? () => onToggleSelect?.(task.id) : undefined}
      className={clsx(
        "flex items-center gap-3 px-4 py-2 group transition-all",
        selectionMode
          ? isSelected
            ? "bg-violet-500/15 border-l-2 border-l-violet-500 cursor-pointer"
            : "hover:bg-surface-800/30 cursor-pointer"
          : "hover:bg-surface-800/20 cursor-grab active:cursor-grabbing touch-none"
      )}
    >
      {selectionMode && (
        <div className={clsx(
          "h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-all",
          isSelected ? "bg-violet-500 border-violet-500" : "border-surface-600 bg-transparent"
        )}>
          {isSelected && <Check className="h-3 w-3 text-white" />}
        </div>
      )}
      <span className={clsx("h-2 w-2 rounded-full shrink-0", PRIORITY_DOTS[task.priority])} />
      <span className="text-xs font-mono text-surface-500 shrink-0">{task.key || `#${task.number}`}</span>
      <span
        className="text-sm text-surface-300 flex-1 truncate cursor-pointer hover:text-white transition-colors"
        onPointerDown={(e) => { if (!selectionMode) e.stopPropagation(); }}
        onClick={(e) => { if (!selectionMode) { e.stopPropagation(); onTaskClick?.(task); } }}
      >{task.title}</span>
      {task.labels?.slice(0, 2).map((l) => (
        <span key={l.id} className="rounded-full px-1.5 py-0.5 text-xs font-medium" style={{ backgroundColor: l.color + "20", color: l.color }}>{l.name}</span>
      ))}
      {task.story_points && <span className="text-xs font-mono text-surface-500 bg-surface-800 px-1 py-0.5 rounded">{task.story_points}pt</span>}
      <span className="text-xs text-surface-600 rounded-md px-1.5 py-0.5 bg-surface-800/50">{task.status}</span>
      {/* Quick-assign buttons for backlog tasks */}
      {!selectionMode && onAssign && sprints.filter((s) => s.status === "planning" || s.status === "active").length > 0 && (
        <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-all">
          {sprints.filter((s) => s.status === "planning" || s.status === "active").slice(0, 2).map((s) => (
            <button key={s.id} onClick={() => onAssign(task.id, s.id)} className="flex items-center gap-0.5 rounded-md bg-violet-500/10 border border-violet-500/20 px-1.5 py-0.5 text-[13px] text-violet-400 hover:bg-violet-500/20" title={`Add to ${s.name}`}>
              <ArrowRight className="h-2.5 w-2.5" /> {s.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Task Row Overlay (for dragging) ─── */
function TaskRowOverlay({ task }: { task: Task }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-surface-900 border border-primary-500/50 rounded-lg shadow-xl shadow-primary-500/10 w-[500px]">
      <GripVertical className="h-4 w-4 text-primary-400" />
      <span className={clsx("h-2 w-2 rounded-full shrink-0", PRIORITY_DOTS[task.priority])} />
      <span className="text-xs font-mono text-surface-500 shrink-0">{task.key || `#${task.number}`}</span>
      <span className="text-sm text-white flex-1 truncate">{task.title}</span>
    </div>
  );
}

/* ─── Droppable Container ─── */
function DroppableContainer({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={clsx("transition-all", isOver && "ring-1 ring-violet-500/30 rounded-lg")}>
      {children}
    </div>
  );
}

export default function SprintsPage() {
  const params = useParams();
  const { currentOrg } = useAuthStore();
  const projectSlug = params.projectSlug as string;
  const orgId = currentOrg?.slug === params.orgSlug ? currentOrg?.id : undefined;

  const [projectId, setProjectId] = useState<number | null>(null);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newGoal, setNewGoal] = useState("");
  const [newStartsAt, setNewStartsAt] = useState("");
  const [newEndsAt, setNewEndsAt] = useState("");
  const [creating, setCreating] = useState(false);

  // Edit
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editGoal, setEditGoal] = useState("");
  const [editStartsAt, setEditStartsAt] = useState("");
  const [editEndsAt, setEditEndsAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [statusChangingId, setStatusChangingId] = useState<number | null>(null);

  // Backlog section
  const [expandedSprints, setExpandedSprints] = useState<Set<number>>(new Set());
  const [showBacklog, setShowBacklog] = useState(true);

  // Task drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [createInSprintId, setCreateInSprintId] = useState<number | null>(null);
  const [boardColumns, setBoardColumns] = useState<string[]>(["To Do", "In Progress", "Review", "Done"]);

  // Selection mode
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<number>>(new Set());
  const [showMoveDropdown, setShowMoveDropdown] = useState(false);
  const [bulkMoving, setBulkMoving] = useState(false);

  // DnD
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Sprint completion modal
  const [completingSprint, setCompletingSprint] = useState<Sprint | null>(null);
  const [completionMoveTo, setCompletionMoveTo] = useState<"backlog" | "next_sprint">("backlog");
  const [completionNextSprintId, setCompletionNextSprintId] = useState<number | null>(null);
  const [completionStartNext, setCompletionStartNext] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [doneColumns, setDoneColumns] = useState<string[]>(["Done"]);

  // Resolve project
  useEffect(() => {
    async function resolve() {
      if (!orgId) return;
      try {
        const res = await api.get<any>(`/api/v1/organizations/${orgId}/projects`);
        const proj = (res?.data ?? []).find((p: any) => p.slug === projectSlug);
        if (proj) {
          setProjectId(proj.id);
          try {
            const boardRes = await api.get<any>(`/api/v1/organizations/${orgId}/projects/${proj.id}/board`);
            setBoardColumns(boardRes?.data?.columns ?? ["To Do", "In Progress", "Review", "Done"]);
            setDoneColumns(boardRes?.data?.done_columns ?? ["Done"]);
          } catch {}
        }
      } catch {}
    }
    resolve();
  }, [orgId, projectSlug]);

  // Load sprints + tasks
  const loadAll = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const [sprintsRes, tasksRes] = await Promise.all([
        api.get<any>(`/api/v1/projects/${projectId}/sprints`),
        api.get<any>(`/api/v1/projects/${projectId}/tasks`),
      ]);
      const s = sprintsRes?.data ?? [];
      setSprints(s);
      setTasks(tasksRes?.data ?? []);
      const active = s.find((sp: Sprint) => sp.status === "active");
      if (active) setExpandedSprints(new Set([active.id]));
    } catch {
      setError("Failed to load sprints.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Default dates
  useEffect(() => {
    if (showCreate && !newStartsAt) {
      const today = new Date();
      const end = new Date(today);
      end.setDate(end.getDate() + 14);
      setNewStartsAt(today.toISOString().split("T")[0]);
      setNewEndsAt(end.toISOString().split("T")[0]);
    }
  }, [showCreate, newStartsAt]);

  async function handleCreate() {
    if (!newName.trim() || !projectId) return;
    setCreating(true); setError("");
    try {
      const res = await api.post<any>(`/api/v1/projects/${projectId}/sprints`, {
        name: newName.trim(), goal: newGoal.trim() || null, starts_at: newStartsAt, ends_at: newEndsAt,
      });
      setSprints((prev) => [...prev, res.data]);
      setNewName(""); setNewGoal(""); setNewStartsAt(""); setNewEndsAt(""); setShowCreate(false);
    } catch (err: any) { setError(err?.data?.error || "Failed to create sprint."); }
    finally { setCreating(false); }
  }

  async function handleUpdate(id: number) {
    if (!editName.trim() || !projectId) return;
    setSaving(true); setError("");
    try {
      const res = await api.put<any>(`/api/v1/projects/${projectId}/sprints/${id}`, {
        name: editName.trim(), goal: editGoal.trim() || null, starts_at: editStartsAt, ends_at: editEndsAt,
      });
      setSprints((prev) => prev.map((s) => (s.id === id ? res.data : s)));
      setEditingId(null);
    } catch (err: any) { setError(err?.data?.error || "Failed to update."); }
    finally { setSaving(false); }
  }

  async function handleStatusChange(sprint: Sprint, newStatus: Sprint["status"]) {
    if (!projectId) return;
    if (newStatus === "completed") {
      // Open the completion modal instead
      setCompletingSprint(sprint);
      setCompletionMoveTo("backlog");
      setCompletionNextSprintId(null);
      setCompletionStartNext(false);
      return;
    }
    setStatusChangingId(sprint.id);
    try {
      const res = await api.put<any>(`/api/v1/projects/${projectId}/sprints/${sprint.id}`, { status: newStatus });
      setSprints((prev) => prev.map((s) => (s.id === sprint.id ? res.data : s)));
    } catch (err: any) { setError(err?.data?.error || "Failed to update status."); }
    finally { setStatusChangingId(null); }
  }

  async function handleCompleteSprint() {
    if (!completingSprint || !projectId) return;
    setCompleting(true);
    setError("");
    try {
      await api.post<any>(`/api/v1/projects/${projectId}/sprints/${completingSprint.id}/complete`, {
        move_to: completionMoveTo,
        next_sprint_id: completionMoveTo === "next_sprint" ? completionNextSprintId : null,
        start_next_sprint: completionStartNext,
        done_columns: doneColumns,
      });
      setCompletingSprint(null);
      await loadAll();
    } catch (err: any) {
      setError(err?.data?.error || "Failed to complete sprint.");
    } finally {
      setCompleting(false);
    }
  }

  async function handleDelete(id: number) {
    if (!projectId) return;
    setDeletingId(id); setError("");
    try {
      await api.delete(`/api/v1/projects/${projectId}/sprints/${id}`);
      setSprints((prev) => prev.filter((s) => s.id !== id));
      setTasks((prev) => prev.map((t) => t.sprint_id === id ? { ...t, sprint_id: null } : t));
    } catch (err: any) { setError(err?.data?.error || "Failed to delete."); }
    finally { setDeletingId(null); }
  }

  async function assignTaskToSprint(taskId: number, sprintId: number | null) {
    try {
      await api.put<any>(`/api/v1/tasks/${taskId}`, { sprint_id: sprintId });
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, sprint_id: sprintId } : t));
    } catch {}
  }

  function toggleSelectTask(taskId: number) {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      next.has(taskId) ? next.delete(taskId) : next.add(taskId);
      return next;
    });
  }

  async function bulkMoveTasks(targetSprintId: number | null) {
    if (selectedTaskIds.size === 0) return;
    setBulkMoving(true);
    try {
      const promises = Array.from(selectedTaskIds).map((taskId) =>
        api.put<any>(`/api/v1/tasks/${taskId}`, { sprint_id: targetSprintId })
      );
      await Promise.all(promises);
      setTasks((prev) => prev.map((t) =>
        selectedTaskIds.has(t.id) ? { ...t, sprint_id: targetSprintId } : t
      ));
      setSelectedTaskIds(new Set());
      setSelectionMode(false);
      setShowMoveDropdown(false);
    } catch (err: any) {
      setError(err?.data?.error || "Failed to move tasks.");
    } finally {
      setBulkMoving(false);
    }
  }

  function toggleSprint(id: number) {
    setExpandedSprints((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function startEdit(s: Sprint) {
    setEditingId(s.id); setEditName(s.name); setEditGoal(s.goal || ""); setEditStartsAt(s.starts_at); setEditEndsAt(s.ends_at);
  }

  function handleTaskSaved(saved: any) {
    setTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === saved.id);
      if (idx >= 0) { const c = [...prev]; c[idx] = saved; return c; }
      return [...prev, saved];
    });
  }

  // Computed
  const sortedSprints = [...sprints].sort((a, b) => {
    const order = { active: 0, planning: 1, completed: 2, cancelled: 3 };
    return (order[a.status] ?? 4) - (order[b.status] ?? 4);
  });

  const backlogTasks = useMemo(() =>
    tasks.filter((t) => !t.sprint_id).sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
    [tasks]
  );
  const totalBacklogPoints = backlogTasks.reduce((s, t) => s + (parseFloat(t.story_points || "0") || 0), 0);

  function getSprintTasks(sprintId: number) {
    return tasks.filter((t) => t.sprint_id === sprintId).sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  }
  function getSprintPoints(sprintId: number) {
    return getSprintTasks(sprintId).reduce((s, t) => s + (parseFloat(t.story_points || "0") || 0), 0);
  }
  function getCompletedPoints(sprintId: number) {
    return getSprintTasks(sprintId)
      .filter((t) => t.status === "Done" || t.status === "completed")
      .reduce((s, t) => s + (parseFloat(t.story_points || "0") || 0), 0);
  }

  // ─── DnD Handlers ───

  // Determine which container (sprint_id or "backlog") a task belongs to
  function findContainer(taskId: number): string {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return "backlog";
    return task.sprint_id ? `sprint-${task.sprint_id}` : "backlog";
  }

  function handleDragStart(event: DragStartEvent) {
    const task = tasks.find((t) => t.id === event.active.id);
    if (task) setActiveTask(task);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as number;
    const overId = over.id as string | number;

    const activeContainer = findContainer(activeId);

    // Determine target container  
    let overContainer: string;
    if (typeof overId === "string" && (overId === "backlog" || overId.startsWith("sprint-"))) {
      overContainer = overId;
    } else {
      overContainer = findContainer(overId as number);
    }

    if (activeContainer === overContainer) return;

    // Move task to new container optimistically
    const newSprintId = overContainer === "backlog" ? null : parseInt(overContainer.replace("sprint-", ""));
    setTasks((prev) => prev.map((t) =>
      t.id === activeId ? { ...t, sprint_id: newSprintId } : t
    ));
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as number;
    const overId = over.id as string | number;

    const activeContainer = findContainer(activeId);

    let overContainer: string;
    if (typeof overId === "string" && (overId === "backlog" || overId.startsWith("sprint-"))) {
      overContainer = overId;
    } else {
      overContainer = findContainer(overId as number);
    }

    const targetSprintId = overContainer === "backlog" ? null : parseInt(overContainer.replace("sprint-", ""));

    // Get tasks in target container, sorted
    const containerTasks = tasks
      .filter((t) => (targetSprintId === null ? !t.sprint_id : t.sprint_id === targetSprintId))
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

    // Reorder within same container
    const oldIdx = containerTasks.findIndex((t) => t.id === activeId);
    let newIdx = containerTasks.findIndex((t) => t.id === overId);
    if (newIdx === -1) newIdx = containerTasks.length - 1;
    if (newIdx < 0) newIdx = 0;

    let reordered: Task[];
    if (oldIdx !== -1 && oldIdx !== newIdx) {
      reordered = arrayMove(containerTasks, oldIdx, newIdx);
    } else {
      reordered = containerTasks;
    }

    const updates = reordered.map((t, i) => ({
      id: t.id,
      status: t.status,
      position: i,
      sprint_id: targetSprintId,
    }));

    // Optimistic update
    setTasks((prev) => {
      const newTasks = prev.map((t) => {
        const update = updates.find((u) => u.id === t.id);
        if (update) return { ...t, sprint_id: update.sprint_id, position: update.position };
        return t;
      });
      return newTasks;
    });

    // Persist
    if (projectId && updates.length > 0) {
      try {
        await api.put(`/api/v1/projects/${projectId}/tasks/reorder`, { items: updates });
      } catch {
        loadAll();
      }
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
            <Zap className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Sprints</h1>
            <p className="text-sm text-surface-400">
              {sprints.length} sprint{sprints.length !== 1 ? "s" : ""} • {backlogTasks.length} backlog task{backlogTasks.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (selectionMode) {
                setSelectionMode(false);
                setSelectedTaskIds(new Set());
                setShowMoveDropdown(false);
              } else {
                setSelectionMode(true);
              }
            }}
            className={clsx(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium border transition-all",
              selectionMode
                ? "bg-violet-500/15 border-violet-500/30 text-violet-400"
                : "border-surface-700 text-surface-400 hover:bg-surface-800 hover:text-surface-300"
            )}
          >
            <MousePointerClick className="h-4 w-4" />
            {selectionMode ? "Cancel" : "Select"}
          </button>
          <button onClick={() => { setEditingTask(null); setCreateInSprintId(null); setDrawerOpen(true); }} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary-500 to-blue-600 px-4 py-2 text-sm font-medium text-white hover:from-primary-600 hover:to-blue-700 transition-all shadow-lg shadow-primary-500/20">
            <Plus className="h-4 w-4" /> New Task
          </button>
          {!showCreate && (
            <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-violet-500 to-fuchsia-600 px-4 py-2 text-sm font-medium text-white hover:from-violet-600 hover:to-fuchsia-700 transition-all shadow-lg shadow-violet-500/20">
              <Plus className="h-4 w-4" /> New Sprint
            </button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /><span>{error}</span>
          <button onClick={() => setError("")} className="ml-auto"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Create Form */}
      {showCreate && (
        <div className="mb-6 rounded-xl border border-surface-800 bg-[#111827] p-5 animate-in slide-in-from-top-2">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><Zap className="h-4 w-4 text-violet-400" />Create new sprint</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-surface-400 mb-1">Sprint name</label>
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreate()} placeholder="Sprint 1" className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-white placeholder:text-surface-500 outline-none focus:border-violet-500" autoFocus maxLength={100} />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-400 mb-1">Goal <span className="text-surface-600">(optional)</span></label>
              <textarea value={newGoal} onChange={(e) => setNewGoal(e.target.value)} placeholder="What does this sprint aim to achieve?" rows={2} className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-white placeholder:text-surface-500 outline-none focus:border-violet-500 resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-surface-400 mb-1">Start date</label>
                <input type="date" value={newStartsAt} onChange={(e) => setNewStartsAt(e.target.value)} className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-white outline-none [color-scheme:dark]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-400 mb-1">End date</label>
                <input type="date" value={newEndsAt} onChange={(e) => setNewEndsAt(e.target.value)} className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-white outline-none [color-scheme:dark]" />
              </div>
            </div>
            <div className="flex justify-between items-center pt-1">
              {newStartsAt && newEndsAt && <span className="text-[13px] text-surface-500">Duration: {sprintDuration(newStartsAt, newEndsAt)}</span>}
              <div className="flex gap-2 ml-auto">
                <button onClick={() => { setShowCreate(false); setNewName(""); setNewGoal(""); setNewStartsAt(""); setNewEndsAt(""); }} className="rounded-lg border border-surface-700 px-3 py-2 text-sm text-surface-400 hover:bg-surface-800">Cancel</button>
                <button onClick={handleCreate} disabled={creating || !newName.trim() || !newStartsAt || !newEndsAt} className={clsx("flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all", creating || !newName.trim() ? "bg-surface-800 text-surface-500 cursor-not-allowed" : "bg-violet-500 text-white hover:bg-violet-600")}>
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create Sprint
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="animate-pulse h-32 rounded-xl bg-surface-800/40 border border-surface-800" />)}</div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="space-y-3">
            {/* Active & Planning Sprint Cards (before backlog) */}
            {sortedSprints.filter((s) => s.status === "active" || s.status === "planning").map((sprint) => {
              const cfg = STATUS_CONFIG[sprint.status];
              const StatusIcon = cfg.icon;
              const remaining = daysLeft(sprint.ends_at);
              const isEditing = editingId === sprint.id;
              const isExpanded = expandedSprints.has(sprint.id);
              const sprintTasks = getSprintTasks(sprint.id);
              const totalPts = getSprintPoints(sprint.id);
              const completedPts = getCompletedPoints(sprint.id);
              const sprintTaskIds = sprintTasks.map((t) => t.id);

              return (
                <div key={sprint.id} className={clsx("rounded-xl border bg-[#111827] overflow-hidden transition-all", sprint.status === "active" ? "border-emerald-500/30 shadow-lg shadow-emerald-500/5" : "border-surface-800")}>
                  {isEditing ? (
                    <div className="p-4 space-y-3">
                      <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-white outline-none focus:border-violet-500" autoFocus />
                      <textarea value={editGoal} onChange={(e) => setEditGoal(e.target.value)} placeholder="Sprint goal..." rows={2} className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-white placeholder:text-surface-500 outline-none resize-none" />
                      <div className="grid grid-cols-2 gap-3">
                        <input type="date" value={editStartsAt} onChange={(e) => setEditStartsAt(e.target.value)} className="rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-white outline-none [color-scheme:dark]" />
                        <input type="date" value={editEndsAt} onChange={(e) => setEditEndsAt(e.target.value)} className="rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-white outline-none [color-scheme:dark]" />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => setEditingId(null)} className="rounded-lg border border-surface-700 px-3 py-1.5 text-sm text-surface-400 hover:bg-surface-800">Cancel</button>
                        <button onClick={() => handleUpdate(sprint.id)} disabled={saving} className="flex items-center gap-1 rounded-lg bg-violet-500 px-3 py-1.5 text-sm text-white hover:bg-violet-600 disabled:opacity-50">
                          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Sprint Header */}
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => toggleSprint(sprint.id)}>
                            {isExpanded ? <ChevronDown className="h-4 w-4 text-surface-500" /> : <ChevronRight className="h-4 w-4 text-surface-500" />}
                            <StatusIcon className={clsx("h-5 w-5", cfg.class)} />
                            <h3 className="text-sm font-semibold text-white">{sprint.name}</h3>
                            <span className={clsx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border", cfg.bg, cfg.class)}>{cfg.label}</span>
                            <span className="text-xs text-surface-500 font-mono bg-surface-800/60 px-1.5 py-0.5 rounded">{sprintTasks.length} tasks • {totalPts}pt</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {sprint.status === "planning" && (
                              <button onClick={() => handleStatusChange(sprint, "active")} disabled={statusChangingId === sprint.id} className="flex items-center gap-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-[13px] font-medium text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50">
                                {statusChangingId === sprint.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Start
                              </button>
                            )}
                            {sprint.status === "active" && (
                              <button onClick={() => handleStatusChange(sprint, "completed")} disabled={statusChangingId === sprint.id} className="flex items-center gap-1 rounded-md bg-primary-500/10 border border-primary-500/20 px-2.5 py-1 text-[13px] font-medium text-primary-400 hover:bg-primary-500/20 disabled:opacity-50">
                                {statusChangingId === sprint.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Complete
                              </button>
                            )}
                            <button onClick={() => startEdit(sprint)} className="p-1.5 rounded-md text-surface-500 hover:text-violet-400 hover:bg-surface-800"><Pencil className="h-4 w-4" /></button>
                            <button onClick={() => handleDelete(sprint.id)} disabled={deletingId === sprint.id} className="p-1.5 rounded-md text-surface-500 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-50">
                              {deletingId === sprint.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>

                        {sprint.goal && <p className="text-sm text-surface-400 mb-2 ml-7"><Target className="h-4 w-4 inline mr-1 text-surface-500" />{sprint.goal}</p>}

                        <div className="flex items-center gap-4 ml-7 text-[13px] text-surface-500">
                          <span className="flex items-center gap-1"><CalendarDays className="h-4 w-4" />{formatDate(sprint.starts_at)} → {formatDate(sprint.ends_at)}</span>
                          <span className="text-surface-600">•</span>
                          <span>{sprintDuration(sprint.starts_at, sprint.ends_at)}</span>
                          {sprint.status === "active" && (<><span className="text-surface-600">•</span><span className={remaining <= 2 ? "text-red-400 font-medium" : remaining <= 5 ? "text-amber-400" : "text-emerald-400"}>{remaining > 0 ? `${remaining}d left` : remaining === 0 ? "Ends today" : "Overdue"}</span></>)}
                          {sprint.velocity && (<><span className="text-surface-600">•</span><span className="flex items-center gap-0.5"><TrendingUp className="h-4 w-4 text-emerald-400" /> Velocity: {sprint.velocity}pt</span></>)}
                        </div>

                        {(sprint.status === "active" || sprint.status === "completed") && totalPts > 0 && (
                          <div className="mt-2 ml-7">
                            <div className="flex items-center justify-between text-xs text-surface-500 mb-1">
                              <span>{completedPts} / {totalPts} points completed</span>
                              <span>{Math.round((completedPts / totalPts) * 100)}%</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-surface-800 overflow-hidden">
                              <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all" style={{ width: `${(completedPts / totalPts) * 100}%` }} />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Expanded: Sprint Tasks — droppable */}
                      {isExpanded && (
                        <DroppableContainer id={`sprint-${sprint.id}`}>
                          <div className="border-t border-surface-800 bg-surface-900/30">
                            <SortableContext items={sprintTaskIds} strategy={verticalListSortingStrategy}>
                              {sprintTasks.length === 0 ? (
                                <div className="px-4 py-6 text-center">
                                  <p className="text-sm text-surface-500">Drag tasks from backlog to add to this sprint</p>
                                </div>
                              ) : (
                                <div className="divide-y divide-surface-800/50">
                                  {sprintTasks.map((task) => (
                                    <SortableTaskRow key={task.id} task={task} sprints={sprints} onTaskClick={(t) => { setEditingTask(t); setDrawerOpen(true); }} selectionMode={selectionMode} isSelected={selectedTaskIds.has(task.id)} onToggleSelect={toggleSelectTask} />
                                  ))}
                                </div>
                              )}
                            </SortableContext>
                            {/* Quick create task in sprint */}
                            <div className="px-3 py-2 border-t border-surface-800/30">
                              <button
                                onClick={() => {
                                  setEditingTask(null);
                                  setCreateInSprintId(sprint.id);
                                  setDrawerOpen(true);
                                }}
                                className="flex w-full items-center gap-1.5 rounded-lg border border-dashed border-surface-700 px-3 py-2 text-[13px] text-surface-500 hover:text-surface-300 hover:border-surface-600 hover:bg-surface-800/30 transition-all"
                              >
                                <Plus className="h-4 w-4" />
                                Create task
                              </button>
                            </div>
                          </div>
                        </DroppableContainer>
                      )}
                    </>
                  )}
                </div>
              );
            })}

            {sprints.length === 0 && (
              <div className="text-center py-16 rounded-2xl border border-dashed border-surface-800 bg-[#111827]/50">
                <Zap className="h-10 w-10 mx-auto text-surface-600 mb-3" />
                <h3 className="text-sm font-medium text-surface-300 mb-1">No sprints yet</h3>
                <p className="text-sm text-surface-500 mb-4">Create your first sprint to start planning</p>
                <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-violet-500/10 border border-violet-500/20 px-4 py-2 text-sm text-violet-400 hover:bg-violet-500/20">
                  <Plus className="h-4 w-4" /> Create your first sprint
                </button>
              </div>
            )}

            {/* Backlog Section — droppable */}
            <DroppableContainer id="backlog">
              <div className="rounded-xl border border-surface-800 bg-[#111827] overflow-hidden mt-6">
                <div className="flex items-center justify-between px-4 py-3 border-b border-surface-800 cursor-pointer" onClick={() => setShowBacklog(!showBacklog)}>
                  <div className="flex items-center gap-2.5">
                    {showBacklog ? <ChevronDown className="h-4 w-4 text-surface-500" /> : <ChevronRight className="h-4 w-4 text-surface-500" />}
                    <ListTodo className="h-4 w-4 text-surface-500" />
                    <h3 className="text-sm font-semibold text-surface-300">Backlog</h3>
                    <span className="text-xs text-surface-500 font-mono bg-surface-800/60 px-1.5 py-0.5 rounded">{backlogTasks.length} tasks • {totalBacklogPoints}pt</span>
                  </div>
                </div>
                {showBacklog && (
                  <SortableContext items={backlogTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
                    <div className="divide-y divide-surface-800/50">
                      {backlogTasks.length === 0 ? (
                        <div className="px-4 py-6 text-center text-sm text-surface-500">All tasks are assigned to sprints 🎉</div>
                      ) : (
                        backlogTasks.map((task) => (
                          <SortableTaskRow key={task.id} task={task} sprints={sprints} onAssign={assignTaskToSprint} onTaskClick={(t) => { setEditingTask(t); setDrawerOpen(true); }} selectionMode={selectionMode} isSelected={selectedTaskIds.has(task.id)} onToggleSelect={toggleSelectTask} />
                        ))
                      )}
                    </div>
                  </SortableContext>
                )}
              </div>
            </DroppableContainer>

            {/* Completed & Cancelled Sprints (after backlog — history) */}
            {sortedSprints.filter((s) => s.status === "completed" || s.status === "cancelled").length > 0 && (
              <div className="mt-4">
                <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wider mb-2">Completed Sprints</h3>
                <div className="space-y-2">
                  {sortedSprints.filter((s) => s.status === "completed" || s.status === "cancelled").map((sprint) => {
                    const cfg = STATUS_CONFIG[sprint.status];
                    const StatusIcon = cfg.icon;
                    const isExpanded = expandedSprints.has(sprint.id);
                    const sprintTasks = getSprintTasks(sprint.id);
                    const totalPts = getSprintPoints(sprint.id);
                    const completedPts = getCompletedPoints(sprint.id);

                    return (
                      <div key={sprint.id} className="rounded-xl border border-surface-800 bg-[#111827]/60 overflow-hidden">
                        <div className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => toggleSprint(sprint.id)}>
                              {isExpanded ? <ChevronDown className="h-4 w-4 text-surface-500" /> : <ChevronRight className="h-4 w-4 text-surface-500" />}
                              <StatusIcon className={clsx("h-5 w-5", cfg.class)} />
                              <h3 className="text-sm font-semibold text-surface-400">{sprint.name}</h3>
                              <span className={clsx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border", cfg.bg, cfg.class)}>{cfg.label}</span>
                              <span className="text-xs text-surface-500 font-mono bg-surface-800/60 px-1.5 py-0.5 rounded">{sprintTasks.length} tasks • {totalPts}pt</span>
                            </div>
                            <div className="flex items-center gap-1">
                              {sprint.velocity && (
                                <span className="flex items-center gap-0.5 text-xs text-emerald-400">
                                  <TrendingUp className="h-3.5 w-3.5" /> {sprint.velocity}pt velocity
                                </span>
                              )}
                              <button onClick={() => handleDelete(sprint.id)} disabled={deletingId === sprint.id} className="p-1.5 rounded-md text-surface-600 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-50">
                                {deletingId === sprint.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                              </button>
                            </div>
                          </div>
                          <div className="flex items-center gap-4 ml-7 mt-1 text-[13px] text-surface-600">
                            <span className="flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{formatDate(sprint.starts_at)} → {formatDate(sprint.ends_at)}</span>
                            <span>{sprintDuration(sprint.starts_at, sprint.ends_at)}</span>
                          </div>
                          {(totalPts > 0) && (
                            <div className="mt-2 ml-7">
                              <div className="h-1.5 rounded-full bg-surface-800 overflow-hidden">
                                <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400" style={{ width: `${(completedPts / totalPts) * 100}%` }} />
                              </div>
                            </div>
                          )}
                        </div>
                        {isExpanded && sprintTasks.length > 0 && (
                          <div className="border-t border-surface-800 bg-surface-900/30 divide-y divide-surface-800/50">
                            {sprintTasks.map((task) => (
                              <SortableTaskRow key={task.id} task={task} sprints={sprints} onTaskClick={(t) => { setEditingTask(t); setDrawerOpen(true); }} selectionMode={selectionMode} isSelected={selectedTaskIds.has(task.id)} onToggleSelect={toggleSelectTask} />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <DragOverlay>
            {activeTask ? <TaskRowOverlay task={activeTask} /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Stats */}
      {sprints.length > 0 && (
        <div className="flex items-center justify-between mt-4 text-xs text-surface-500">
          <span>{sprints.length} sprint{sprints.length !== 1 ? "s" : ""}</span>
          <div className="flex gap-3">
            {Object.entries(STATUS_CONFIG).map(([status, cfg]) => {
              const count = sprints.filter((s) => s.status === status).length;
              if (!count) return null;
              return <span key={status} className={cfg.class}>{count} {cfg.label.toLowerCase()}</span>;
            })}
          </div>
        </div>
      )}

      {/* Sprint Completion Modal */}
      {completingSprint && (() => {
        const sprintTasks = tasks.filter((t) => t.sprint_id === completingSprint.id);
        const completedTasks = sprintTasks.filter((t) => doneColumns.some((dc) => dc.toLowerCase() === t.status.toLowerCase()));
        const incompleteTasks = sprintTasks.filter((t) => !doneColumns.some((dc) => dc.toLowerCase() === t.status.toLowerCase()));
        const completedPts = completedTasks.reduce((s, t) => s + (parseFloat(t.story_points || "0") || 0), 0);
        const incompletePts = incompleteTasks.reduce((s, t) => s + (parseFloat(t.story_points || "0") || 0), 0);
        const planningSprints = sprints.filter((s) => s.status === "planning");

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setCompletingSprint(null)}>
            <div className="w-full max-w-lg mx-4 rounded-2xl border border-surface-700 bg-[#0f1629] shadow-2xl" onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className="px-6 pt-6 pb-4 border-b border-surface-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                      <Trophy className="h-5 w-5 text-emerald-400" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white">Complete Sprint</h2>
                      <p className="text-sm text-surface-400">{completingSprint.name}</p>
                    </div>
                  </div>
                  <button onClick={() => setCompletingSprint(null)} className="p-1.5 rounded-lg text-surface-500 hover:text-surface-300 hover:bg-surface-800"><X className="h-5 w-5" /></button>
                </div>
              </div>

              {/* Summary Stats */}
              <div className="px-6 py-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-3 text-center">
                    <div className="text-2xl font-bold text-emerald-400">{completedTasks.length}</div>
                    <div className="text-xs text-surface-400">Tasks Completed</div>
                    <div className="text-xs text-emerald-500 mt-0.5">{completedPts} pts</div>
                  </div>
                  <div className="rounded-lg bg-amber-500/5 border border-amber-500/20 p-3 text-center">
                    <div className="text-2xl font-bold text-amber-400">{incompleteTasks.length}</div>
                    <div className="text-xs text-surface-400">Tasks Incomplete</div>
                    <div className="text-xs text-amber-500 mt-0.5">{incompletePts} pts</div>
                  </div>
                </div>

                {/* Move incomplete tasks */}
                {incompleteTasks.length > 0 && (
                  <div className="pt-2">
                    <p className="text-sm font-medium text-surface-300 mb-2">Move {incompleteTasks.length} incomplete task{incompleteTasks.length !== 1 ? "s" : ""} to:</p>
                    <div className="space-y-2">
                      <label className={clsx("flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors", completionMoveTo === "backlog" ? "border-primary-500/40 bg-primary-500/5" : "border-surface-700 hover:border-surface-600")}>
                        <input type="radio" name="moveTo" checked={completionMoveTo === "backlog"} onChange={() => setCompletionMoveTo("backlog")} className="accent-primary-500" />
                        <div>
                          <span className="text-sm text-surface-300">Backlog</span>
                          <p className="text-xs text-surface-500">Tasks will be unassigned from any sprint</p>
                        </div>
                      </label>
                      <label className={clsx("flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors", completionMoveTo === "next_sprint" ? "border-primary-500/40 bg-primary-500/5" : "border-surface-700 hover:border-surface-600", planningSprints.length === 0 && "opacity-50 cursor-not-allowed")}>
                        <input type="radio" name="moveTo" checked={completionMoveTo === "next_sprint"} onChange={() => setCompletionMoveTo("next_sprint")} disabled={planningSprints.length === 0} className="accent-primary-500" />
                        <div className="flex-1">
                          <span className="text-sm text-surface-300">Next Sprint</span>
                          {planningSprints.length > 0 ? (
                            <select
                              value={completionNextSprintId ?? ""}
                              onChange={(e) => setCompletionNextSprintId(Number(e.target.value))}
                              onClick={() => setCompletionMoveTo("next_sprint")}
                              className="mt-1 w-full rounded-lg border border-surface-700 bg-surface-900 px-2 py-1.5 text-sm text-white outline-none focus:border-primary-500"
                            >
                              <option value="">Select sprint...</option>
                              {planningSprints.map((s) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </select>
                          ) : (
                            <p className="text-xs text-surface-500">No planning sprints available</p>
                          )}
                        </div>
                      </label>
                    </div>
                  </div>
                )}

                {/* Start next sprint */}
                {completionMoveTo === "next_sprint" && completionNextSprintId && (
                  <label className="flex items-center gap-3 rounded-lg border border-surface-700 px-3 py-2.5 cursor-pointer hover:border-surface-600 transition-colors">
                    <input type="checkbox" checked={completionStartNext} onChange={(e) => setCompletionStartNext(e.target.checked)} className="accent-emerald-500 h-4 w-4" />
                    <div>
                      <span className="text-sm text-surface-300">Start next sprint immediately</span>
                      <p className="text-xs text-surface-500">The selected sprint will be activated</p>
                    </div>
                  </label>
                )}
              </div>

              {/* Actions */}
              <div className="px-6 py-4 border-t border-surface-800 flex justify-end gap-2">
                <button onClick={() => setCompletingSprint(null)} className="rounded-lg border border-surface-700 px-4 py-2 text-sm text-surface-400 hover:bg-surface-800 transition-colors">Cancel</button>
                <button
                  onClick={handleCompleteSprint}
                  disabled={completing || (completionMoveTo === "next_sprint" && !completionNextSprintId && incompleteTasks.length > 0)}
                  className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-green-600 px-5 py-2 text-sm font-medium text-white hover:from-emerald-600 hover:to-green-700 transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {completing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Complete Sprint
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Task Drawer */}
      {projectId && orgId && (
        <TaskDrawer
          open={drawerOpen}
          onClose={() => { setDrawerOpen(false); setEditingTask(null); setCreateInSprintId(null); }}
          onSaved={handleTaskSaved}
          projectId={projectId}
          orgId={orgId}
          task={editingTask ?? (createInSprintId ? { sprint_id: createInSprintId } : undefined)}
          boardColumns={boardColumns}
        />
      )}

      {/* Floating Action Bar — selection mode */}
      {selectionMode && selectedTaskIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-2xl bg-surface-900/95 backdrop-blur-xl border border-surface-700 shadow-2xl shadow-black/40 px-5 py-3 animate-in slide-in-from-bottom-4">
          <span className="text-sm font-medium text-white">
            {selectedTaskIds.size} task{selectedTaskIds.size !== 1 ? "s" : ""} selected
          </span>
          <div className="h-5 w-px bg-surface-700" />
          <div className="relative">
            <button
              onClick={() => setShowMoveDropdown(!showMoveDropdown)}
              disabled={bulkMoving}
              className="flex items-center gap-2 rounded-lg bg-violet-500/15 border border-violet-500/30 px-4 py-2 text-sm font-medium text-violet-300 hover:bg-violet-500/25 transition-all disabled:opacity-50"
            >
              {bulkMoving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              Move to
              <ChevronDown className="h-3 w-3" />
            </button>
            {showMoveDropdown && (
              <div className="absolute bottom-full mb-2 left-0 w-52 rounded-xl bg-surface-900 border border-surface-700 shadow-xl py-1 overflow-hidden">
                {sprints.filter((s) => s.status === "active" || s.status === "planning").map((s) => (
                  <button
                    key={s.id}
                    onClick={() => bulkMoveTasks(s.id)}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-surface-300 hover:bg-surface-800 hover:text-white transition-colors text-left"
                  >
                    <Zap className={clsx("h-3.5 w-3.5", s.status === "active" ? "text-emerald-400" : "text-amber-400")} />
                    {s.name}
                  </button>
                ))}
                <div className="border-t border-surface-800 my-1" />
                <button
                  onClick={() => bulkMoveTasks(null)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-surface-300 hover:bg-surface-800 hover:text-white transition-colors text-left"
                >
                  <ListTodo className="h-3.5 w-3.5 text-surface-500" />
                  Backlog
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() => { setSelectedTaskIds(new Set()); setSelectionMode(false); setShowMoveDropdown(false); }}
            className="p-1.5 rounded-lg text-surface-500 hover:text-surface-300 hover:bg-surface-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
