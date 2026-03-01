"use client";

import { Card, CardTitle, Button, Input } from "@/components/ui";
import Link from "next/link";
import { Users, CreditCard, Key, Activity, Building } from "lucide-react";

const settingsNav = [
  { name: "General", href: "/settings", icon: Building },
  { name: "Members", href: "/settings/members", icon: Users },
  { name: "Billing", href: "/settings/billing", icon: CreditCard },
];

export default function SettingsPage() {
  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold text-white">Organization Settings</h1>

      {/* Settings Nav */}
      <div className="flex gap-2 border-b border-surface-700 pb-4">
        {settingsNav.map((item) => (
          <Link key={item.name} href={item.href}>
            <Button
              variant={item.href === "/settings" ? "primary" : "ghost"}
              size="sm"
            >
              <item.icon className="h-4 w-4" /> {item.name}
            </Button>
          </Link>
        ))}
      </div>

      {/* General Settings */}
      <Card>
        <CardTitle>General</CardTitle>
        <div className="mt-4 space-y-4 max-w-md">
          <Input id="orgName" label="Organization Name" defaultValue="MonkeysCloud Corp" />
          <Input id="orgSlug" label="Slug" defaultValue="monkeyscloud" />
          <Button size="sm">Save</Button>
        </div>
      </Card>

      {/* Quick links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/settings/members">
          <Card hover>
            <Users className="h-8 w-8 text-brand-400 mb-3" />
            <h3 className="text-base font-semibold text-white">Members</h3>
            <p className="text-xs text-surface-400 mt-1">Manage team members and roles</p>
          </Card>
        </Link>
        <Link href="/settings/billing">
          <Card hover>
            <CreditCard className="h-8 w-8 text-emerald-400 mb-3" />
            <h3 className="text-base font-semibold text-white">Billing</h3>
            <p className="text-xs text-surface-400 mt-1">Plans, usage, and invoices</p>
          </Card>
        </Link>
        <Card>
          <Activity className="h-8 w-8 text-amber-400 mb-3" />
          <h3 className="text-base font-semibold text-white">Activity Log</h3>
          <p className="text-xs text-surface-400 mt-1">Audit trail of all actions</p>
        </Card>
      </div>
    </div>
  );
}
