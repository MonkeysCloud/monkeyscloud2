import { Badge } from "./Badge";

const statusMap: Record<string, { variant: "success" | "warning" | "danger" | "info" | "default"; label: string }> = {
  // Build / Deploy
  queued: { variant: "default", label: "Queued" },
  running: { variant: "info", label: "Running" },
  deploying: { variant: "info", label: "Deploying" },
  passed: { variant: "success", label: "Passed" },
  live: { variant: "success", label: "Live" },
  failed: { variant: "danger", label: "Failed" },
  cancelled: { variant: "default", label: "Cancelled" },
  rolled_back: { variant: "warning", label: "Rolled Back" },
  // PR
  open: { variant: "info", label: "Open" },
  merged: { variant: "success", label: "Merged" },
  closed: { variant: "default", label: "Closed" },
  draft: { variant: "default", label: "Draft" },
  // Task
  backlog: { variant: "default", label: "Backlog" },
  todo: { variant: "default", label: "To Do" },
  in_progress: { variant: "info", label: "In Progress" },
  in_review: { variant: "warning", label: "In Review" },
  done: { variant: "success", label: "Done" },
  // Environment
  active: { variant: "success", label: "Active" },
  stopped: { variant: "default", label: "Stopped" },
  suspended: { variant: "warning", label: "Suspended" },
  archived: { variant: "default", label: "Archived" },
  // Generic
  pending: { variant: "warning", label: "Pending" },
  error: { variant: "danger", label: "Error" },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusMap[status] ?? { variant: "default" as const, label: status };
  return (
    <Badge variant={config.variant} className={className}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {config.label}
    </Badge>
  );
}
