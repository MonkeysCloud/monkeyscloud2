"use client";

import { useState } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { ChevronDown, Plus } from "lucide-react";
import clsx from "clsx";

export function OrgSwitcher() {
  const { organizations, currentOrg, setCurrentOrg } = useAuthStore();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-3 rounded-lg bg-surface-800/50 px-3 py-2.5 hover:bg-surface-800 transition-colors"
      >
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-sm font-bold text-white shrink-0">
          {currentOrg?.name?.charAt(0) ?? "M"}
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-medium text-white truncate">
            {currentOrg?.name ?? "Select Org"}
          </p>
        </div>
        <ChevronDown className={clsx("h-4 w-4 text-surface-400 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl border border-surface-700 bg-surface-800 shadow-xl overflow-hidden">
          {organizations.map((org) => (
            <button
              key={org.id}
              onClick={() => { setCurrentOrg(org); setOpen(false); }}
              className={clsx(
                "flex w-full items-center gap-3 px-3 py-2.5 text-sm transition-colors",
                org.id === currentOrg?.id ? "bg-brand-600/20 text-brand-400" : "text-surface-300 hover:bg-surface-700"
              )}
            >
              <div className="h-6 w-6 rounded bg-surface-700 flex items-center justify-center text-xs font-bold">
                {org.name.charAt(0)}
              </div>
              <span className="truncate">{org.name}</span>
            </button>
          ))}
          <button className="flex w-full items-center gap-3 px-3 py-2.5 text-sm text-surface-400 hover:bg-surface-700 border-t border-surface-700">
            <Plus className="h-4 w-4" />
            <span>Create Organization</span>
          </button>
        </div>
      )}
    </div>
  );
}
