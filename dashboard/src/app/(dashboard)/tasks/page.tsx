"use client";

import { Card, CardTitle, StatusBadge, Badge, Button, EmptyState } from "@/components/ui";
import { Plus, ListChecks, Filter } from "lucide-react";
import Link from "next/link";

const columns = [
  { id: "backlog", label: "Backlog", color: "bg-surface-600" },
  { id: "todo", label: "To Do", color: "bg-surface-500" },
  { id: "in_progress", label: "In Progress", color: "bg-brand-500" },
  { id: "in_review", label: "In Review", color: "bg-amber-500" },
  { id: "done", label: "Done", color: "bg-emerald-500" },
];

const tasks = [
  { id: 1, key: "MC-128", title: "Implement rate limiting", status: "in_review", priority: "high", assignee: "Jorge", type: "feature" },
  { id: 2, key: "MC-127", title: "Fix login redirect loop", status: "in_progress", priority: "urgent", assignee: "Maria", type: "bug" },
  { id: 3, key: "MC-126", title: "Add dark mode toggle", status: "in_progress", priority: "medium", assignee: "David", type: "feature" },
  { id: 4, key: "MC-125", title: "Upgrade to PHP 8.4", status: "todo", priority: "low", assignee: "Jorge", type: "chore" },
  { id: 5, key: "MC-124", title: "Write API documentation", status: "todo", priority: "medium", assignee: null, type: "task" },
  { id: 6, key: "MC-123", title: "Setup monitoring alerts", status: "backlog", priority: "medium", assignee: null, type: "task" },
  { id: 7, key: "MC-122", title: "Database query optimization", status: "backlog", priority: "high", assignee: null, type: "improvement" },
  { id: 8, key: "MC-121", title: "Add Stripe webhooks", status: "done", priority: "high", assignee: "Maria", type: "feature" },
  { id: 9, key: "MC-120", title: "Email verification flow", status: "done", priority: "medium", assignee: "Jorge", type: "feature" },
];

const priorityColors: Record<string, string> = {
  urgent: "text-red-400", high: "text-orange-400", medium: "text-amber-400", low: "text-surface-400",
};

export default function TasksPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Tasks</h1>
          <p className="text-sm text-surface-400 mt-1">Sprint 12 · Feb 15 – Feb 28</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm"><Filter className="h-4 w-4" /> Filter</Button>
          <Button size="sm"><Plus className="h-4 w-4" /> New Task</Button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {columns.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.id);
          return (
            <div key={col.id} className="flex-shrink-0 w-72">
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className={`h-2 w-2 rounded-full ${col.color}`} />
                <span className="text-sm font-medium text-surface-300">{col.label}</span>
                <Badge>{colTasks.length}</Badge>
              </div>
              <div className="space-y-2">
                {colTasks.map((task) => (
                  <Link key={task.id} href={`/tasks/${task.id}`}>
                    <Card hover className="!p-3.5">
                      <div className="flex items-center justify-between mb-2">
                        <code className="text-xs text-surface-500">{task.key}</code>
                        <span className={`text-xs font-medium ${priorityColors[task.priority]}`}>
                          {task.priority === "urgent" ? "🔴" : task.priority === "high" ? "🟠" : task.priority === "medium" ? "🟡" : "⚪"} {task.priority}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-white mb-2">{task.title}</p>
                      <div className="flex items-center justify-between text-xs text-surface-500">
                        <Badge variant="default">{task.type}</Badge>
                        {task.assignee && (
                          <span className="flex items-center gap-1">
                            <span className="h-5 w-5 rounded-full bg-brand-600 flex items-center justify-center text-[10px] text-white font-bold">
                              {task.assignee.charAt(0)}
                            </span>
                          </span>
                        )}
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
