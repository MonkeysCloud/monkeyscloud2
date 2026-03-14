"use client";

import { Card, CardTitle, StatusBadge, Button, Badge } from "@/components/ui";
import { RotateCcw, XCircle, Clock, GitBranch, Terminal } from "lucide-react";

const build = {
  id: 248, project: "API Gateway", status: "passed", branch: "main",
  sha: "a1b2c3de4f5g6h7i8j9k", trigger: "push", triggeredBy: "Jorge",
  duration: "2m 14s", startedAt: "2024-02-28 21:30:00",
};

const steps = [
  { name: "Clone Repository", status: "passed", duration: "3s", log: "Cloning into '/build/api-gateway'...\nChecking out branch 'main'...\nDone." },
  { name: "Install Dependencies", status: "passed", duration: "28s", log: "composer install --no-dev --optimize-autoloader\nInstalling 81 packages...\nGenerating autoload files." },
  { name: "Run Tests", status: "passed", duration: "45s", log: "PHPUnit 11.5.55\n\n............................................ 42 / 42 (100%)\n\nOK (42 tests, 128 assertions)" },
  { name: "Build Image", status: "passed", duration: "38s", log: "Building Docker image...\nStep 1/8: FROM php:8.4-fpm-alpine\nStep 8/8: CMD [\"frankenphp\", \"run\"]\nSuccessfully tagged api-gateway:v2.4.1" },
  { name: "Push to Registry", status: "passed", duration: "12s", log: "Pushing gcr.io/monkeyscloud/api-gateway:v2.4.1...\nDigest: sha256:abc123...\nDone." },
];

export default function BuildDetailPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <StatusBadge status={build.status} />
            <h1 className="text-2xl font-bold text-white">Build #{build.id}</h1>
          </div>
          <p className="text-sm text-surface-400 mt-1">
            {build.project} · <GitBranch className="inline h-3 w-3" /> {build.branch} ·{" "}
            <code className="text-surface-300">{build.sha.slice(0, 7)}</code> ·{" "}
            Triggered by {build.triggeredBy} ({build.trigger})
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm"><XCircle className="h-4 w-4" /> Cancel</Button>
          <Button size="sm"><RotateCcw className="h-4 w-4" /> Retry</Button>
        </div>
      </div>

      {/* Steps timeline */}
      <Card>
        <CardTitle>Build Steps</CardTitle>
        <div className="mt-4 space-y-3">
          {steps.map((step, i) => (
            <details key={i} className="group rounded-lg border border-surface-700/50 bg-surface-900/30 overflow-hidden">
              <summary className="flex items-center justify-between cursor-pointer px-4 py-3 hover:bg-surface-800/50 transition-colors">
                <div className="flex items-center gap-3">
                  <StatusBadge status={step.status} />
                  <span className="text-sm font-medium text-white">{step.name}</span>
                </div>
                <span className="text-xs text-surface-500">
                  <Clock className="inline h-3 w-3 mr-1" />{step.duration}
                </span>
              </summary>
              <div className="border-t border-surface-700/50 bg-surface-950 p-4">
                <pre className="text-xs text-surface-400 font-mono whitespace-pre-wrap leading-relaxed">
                  {step.log}
                </pre>
              </div>
            </details>
          ))}
        </div>
      </Card>

      {/* Timing */}
      <Card>
        <div className="flex items-center gap-4 text-sm text-surface-400">
          <span><Clock className="inline h-4 w-4 mr-1" /> Duration: <span className="text-white">{build.duration}</span></span>
          <span>Started: <span className="text-surface-300">{build.startedAt}</span></span>
        </div>
      </Card>
    </div>
  );
}
