"use client";

import { Card, CardTitle, Button, Badge } from "@/components/ui";
import { CreditCard, Check, Zap } from "lucide-react";

const currentPlan = { name: "Pro", price: "$49/mo", period: "monthly" };

const plans = [
  { name: "Free", price: "$0", projects: 3, members: 5, builds: 500, storage: 1, ai: false, domain: false, highlighted: false },
  { name: "Starter", price: "$19", projects: 10, members: 15, builds: 3000, storage: 10, ai: false, domain: true, highlighted: false },
  { name: "Pro", price: "$49", projects: 50, members: 50, builds: 10000, storage: 50, ai: true, domain: true, highlighted: true },
  { name: "Enterprise", price: "Custom", projects: -1, members: -1, builds: -1, storage: -1, ai: true, domain: true, highlighted: false },
];

const usageMeters = [
  { label: "Projects", used: 12, limit: 50, pct: 24 },
  { label: "Build Minutes", used: 4230, limit: 10000, pct: 42 },
  { label: "Storage", used: 18, limit: 50, pct: 36, unit: "GB" },
  { label: "Team Members", used: 4, limit: 50, pct: 8 },
];

export default function BillingPage() {
  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Billing</h1>
        <p className="text-sm text-surface-400 mt-1">Manage your plan and usage</p>
      </div>

      {/* Current Subscription */}
      <Card className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="rounded-xl bg-brand-600/20 p-3">
            <Zap className="h-6 w-6 text-brand-400" />
          </div>
          <div>
            <p className="text-lg font-semibold text-white">
              {currentPlan.name} Plan
            </p>
            <p className="text-sm text-surface-400">{currentPlan.price} billed {currentPlan.period}</p>
          </div>
        </div>
        <Button variant="secondary" size="sm">Manage Subscription</Button>
      </Card>

      {/* Usage Meters */}
      <Card>
        <CardTitle>Current Usage</CardTitle>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
          {usageMeters.map((m) => (
            <div key={m.label}>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-surface-300">{m.label}</span>
                <span className="text-white font-medium">
                  {m.used.toLocaleString()}{m.unit ? ` ${m.unit}` : ""} / {m.limit === -1 ? "∞" : m.limit.toLocaleString()}{m.unit ? ` ${m.unit}` : ""}
                </span>
              </div>
              <div className="h-2 rounded-full bg-surface-700 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${m.pct > 80 ? "bg-red-500" : m.pct > 60 ? "bg-amber-500" : "bg-brand-500"}`}
                  style={{ width: `${m.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Plan Comparison */}
      <Card>
        <CardTitle>Plans</CardTitle>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-4">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-xl border p-5 ${
                plan.highlighted
                  ? "border-brand-500 bg-brand-600/10"
                  : "border-surface-700 bg-surface-900/30"
              }`}
            >
              <h3 className="text-lg font-bold text-white">{plan.name}</h3>
              <p className="text-2xl font-bold text-white mt-1">
                {plan.price}<span className="text-sm text-surface-400 font-normal">{plan.price !== "Custom" ? "/mo" : ""}</span>
              </p>
              <ul className="mt-4 space-y-2 text-sm text-surface-400">
                <li><Check className="inline h-3.5 w-3.5 text-emerald-400 mr-1.5" />{plan.projects === -1 ? "Unlimited" : plan.projects} projects</li>
                <li><Check className="inline h-3.5 w-3.5 text-emerald-400 mr-1.5" />{plan.members === -1 ? "Unlimited" : plan.members} members</li>
                <li><Check className="inline h-3.5 w-3.5 text-emerald-400 mr-1.5" />{plan.builds === -1 ? "Unlimited" : plan.builds.toLocaleString()} build min</li>
                <li><Check className="inline h-3.5 w-3.5 text-emerald-400 mr-1.5" />{plan.storage === -1 ? "Unlimited" : plan.storage} GB storage</li>
                {plan.domain && <li><Check className="inline h-3.5 w-3.5 text-emerald-400 mr-1.5" />Custom domains</li>}
                {plan.ai && <li><Check className="inline h-3.5 w-3.5 text-emerald-400 mr-1.5" />AI features</li>}
              </ul>
              <Button
                variant={plan.highlighted ? "primary" : "secondary"}
                size="sm"
                className="w-full mt-4"
              >
                {plan.name === currentPlan.name ? "Current Plan" : plan.price === "Custom" ? "Contact Us" : "Upgrade"}
              </Button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
