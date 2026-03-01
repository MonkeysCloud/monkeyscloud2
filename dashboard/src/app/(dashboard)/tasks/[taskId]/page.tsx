"use client";

import { Card, CardTitle, StatusBadge, Badge, Button } from "@/components/ui";
import { Clock, MessageSquare, GitPullRequest, User, Calendar } from "lucide-react";

const task = {
  id: 1, key: "MC-128", title: "Implement rate limiting", status: "in_review",
  priority: "high", type: "feature", storyPoints: 5,
  assignee: "Jorge", reporter: "Maria",
  description: "Add token-bucket rate limiting to all authenticated API endpoints.\n\n### Acceptance Criteria\n- Configurable limits per organization\n- Redis-backed counters\n- Return `X-RateLimit-*` headers\n- 429 response with retry-after",
  linkedPr: { number: 42, title: "Add rate limiting middleware", status: "open" },
  dueDate: "2024-02-28",
};

const comments = [
  { user: "Maria", body: "Let's make sure we add tests for the Redis fallback case.", ago: "3h ago" },
  { user: "Jorge", body: "Good point — added a test for when Redis is unreachable. Falls back to in-memory with shorter windows.", ago: "2h ago" },
];

const timeEntries = [
  { user: "Jorge", minutes: 120, note: "Initial implementation", date: "Feb 27" },
  { user: "Jorge", minutes: 60, note: "Redis integration + tests", date: "Feb 28" },
];

export default function TaskDetailPage({ params }: { params: { taskId: string } }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main */}
      <div className="lg:col-span-2 space-y-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Badge variant="default">{task.key}</Badge>
            <StatusBadge status={task.status} />
          </div>
          <h1 className="text-2xl font-bold text-white">{task.title}</h1>
        </div>

        <Card>
          <CardTitle>Description</CardTitle>
          <pre className="mt-3 text-sm text-surface-300 whitespace-pre-wrap font-sans leading-relaxed">
            {task.description}
          </pre>
        </Card>

        {/* Comments */}
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="h-5 w-5 text-surface-400" />
            <CardTitle>Comments</CardTitle>
            <Badge>{comments.length}</Badge>
          </div>
          <div className="space-y-4">
            {comments.map((c, i) => (
              <div key={i} className="rounded-lg bg-surface-900/30 border border-surface-700/50 p-4">
                <div className="flex justify-between mb-2">
                  <span className="text-sm font-medium text-white">{c.user}</span>
                  <span className="text-xs text-surface-500">{c.ago}</span>
                </div>
                <p className="text-sm text-surface-300">{c.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <textarea
              placeholder="Write a comment…"
              className="w-full rounded-lg border border-surface-700 bg-surface-900 px-4 py-3 text-sm text-white placeholder:text-surface-500 focus:outline-none focus:ring-1 focus:ring-brand-500 resize-none"
              rows={3}
            />
            <Button size="sm" className="mt-2">Post Comment</Button>
          </div>
        </Card>
      </div>

      {/* Sidebar */}
      <div className="space-y-4">
        <Card>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-surface-400">Status</span><StatusBadge status={task.status} /></div>
            <div className="flex justify-between"><span className="text-surface-400">Priority</span><span className="text-orange-400 font-medium">🟠 {task.priority}</span></div>
            <div className="flex justify-between"><span className="text-surface-400">Type</span><Badge>{task.type}</Badge></div>
            <div className="flex justify-between"><span className="text-surface-400">Story Points</span><span className="text-white">{task.storyPoints}</span></div>
            <div className="flex justify-between"><span className="text-surface-400">Assignee</span><span className="text-white">{task.assignee}</span></div>
            <div className="flex justify-between"><span className="text-surface-400">Reporter</span><span className="text-surface-300">{task.reporter}</span></div>
            <div className="flex justify-between"><span className="text-surface-400">Due</span><span className="text-surface-300"><Calendar className="inline h-3 w-3 mr-1" />{task.dueDate}</span></div>
          </div>
        </Card>

        {/* Linked PR */}
        {task.linkedPr && (
          <Card>
            <CardTitle>Linked Pull Request</CardTitle>
            <div className="mt-3 flex items-center gap-2">
              <GitPullRequest className="h-4 w-4 text-emerald-400" />
              <span className="text-sm text-surface-200">#{task.linkedPr.number} {task.linkedPr.title}</span>
            </div>
            <StatusBadge status={task.linkedPr.status} className="mt-2" />
          </Card>
        )}

        {/* Time Tracking */}
        <Card>
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-surface-400" />
            <CardTitle>Time Tracked</CardTitle>
          </div>
          <p className="text-xl font-bold text-white mb-3">
            {Math.floor(timeEntries.reduce((s, e) => s + e.minutes, 0) / 60)}h {timeEntries.reduce((s, e) => s + e.minutes, 0) % 60}m
          </p>
          <div className="space-y-1.5">
            {timeEntries.map((e, i) => (
              <div key={i} className="flex justify-between text-xs text-surface-400">
                <span>{e.user}: {e.note}</span>
                <span>{Math.floor(e.minutes / 60)}h {e.minutes % 60}m</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
