"use client";

import { Card, CardTitle, Button, Input, Badge } from "@/components/ui";
import { Trash2 } from "lucide-react";

export default function ProjectSettingsPage() {
  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Project Settings</h1>
        <p className="text-sm text-surface-400 mt-1">Manage your project configuration</p>
      </div>

      {/* General */}
      <Card>
        <CardTitle>General</CardTitle>
        <div className="mt-4 space-y-4">
          <Input id="name" label="Project Name" defaultValue="API Gateway" />
          <Input id="slug" label="Slug" defaultValue="api-gateway" />
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">Stack</label>
            <Badge variant="info">monkeyslegion</Badge>
          </div>
          <Button size="sm">Save Changes</Button>
        </div>
      </Card>

      {/* Environment Variables */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <CardTitle>Environment Variables</CardTitle>
          <Button variant="secondary" size="sm">Add Variable</Button>
        </div>
        <div className="space-y-2">
          {["DATABASE_URL", "REDIS_URL", "JWT_SECRET", "S3_BUCKET"].map((key) => (
            <div key={key} className="flex items-center justify-between rounded-lg bg-surface-900/50 px-4 py-2.5 border border-surface-700/50">
              <div>
                <code className="text-sm text-surface-200">{key}</code>
                <span className="ml-2 text-xs text-surface-500">••••••••</span>
              </div>
              <Button variant="ghost" size="sm"><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          ))}
        </div>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-900/50">
        <CardTitle className="text-red-400">Danger Zone</CardTitle>
        <p className="text-sm text-surface-400 mt-2 mb-4">
          This action will permanently delete the project and all associated data.
        </p>
        <Button variant="danger" size="sm">
          <Trash2 className="h-4 w-4" /> Delete Project
        </Button>
      </Card>
    </div>
  );
}
