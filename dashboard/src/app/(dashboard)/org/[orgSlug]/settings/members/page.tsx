"use client";

import { Card, CardTitle, Button, Badge, Table } from "@/components/ui";
import { Users, Plus, Mail, Trash2 } from "lucide-react";

const members = [
  { id: 1, name: "Jorge Peraz", email: "jorge@monkeys.cloud", role: "owner", joinedAt: "Jan 2024" },
  { id: 2, name: "Maria Garcia", email: "maria@monkeys.cloud", role: "admin", joinedAt: "Jan 2024" },
  { id: 3, name: "David Chen", email: "david@monkeys.cloud", role: "developer", joinedAt: "Feb 2024" },
  { id: 4, name: "Sarah Williams", email: "sarah@monkeys.cloud", role: "viewer", joinedAt: "Feb 2024" },
];

const roleColors: Record<string, "success" | "info" | "warning" | "default"> = {
  owner: "success", admin: "info", developer: "warning", viewer: "default",
};

const pendingInvites = [
  { email: "alex@company.com", role: "developer", sentAt: "Feb 27" },
];

export default function MembersPage() {
  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Members</h1>
          <p className="text-sm text-surface-400 mt-1">{members.length} members in your organization</p>
        </div>
        <Button size="sm"><Plus className="h-4 w-4" /> Invite Member</Button>
      </div>

      {/* Members Table */}
      <Card>
        <Table
          columns={[
            {
              key: "name", header: "Member",
              render: (m: any) => (
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-xs font-bold text-white">
                    {m.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{m.name}</p>
                    <p className="text-xs text-surface-500">{m.email}</p>
                  </div>
                </div>
              ),
            },
            {
              key: "role", header: "Role",
              render: (m: any) => <Badge variant={roleColors[m.role]}>{m.role}</Badge>,
            },
            { key: "joinedAt", header: "Joined" },
            {
              key: "actions", header: "",
              render: (m: any) => m.role !== "owner" ? (
                <Button variant="ghost" size="sm"><Trash2 className="h-3.5 w-3.5" /></Button>
              ) : null,
            },
          ]}
          data={members}
        />
      </Card>

      {/* Pending Invitations */}
      {pendingInvites.length > 0 && (
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <Mail className="h-5 w-5 text-surface-400" />
            <CardTitle>Pending Invitations</CardTitle>
          </div>
          {pendingInvites.map((invite) => (
            <div key={invite.email} className="flex items-center justify-between rounded-lg bg-surface-900/30 px-4 py-3 border border-surface-700/50">
              <div>
                <p className="text-sm text-surface-200">{invite.email}</p>
                <p className="text-xs text-surface-500">Invited as {invite.role} · Sent {invite.sentAt}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm">Resend</Button>
                <Button variant="ghost" size="sm"><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
