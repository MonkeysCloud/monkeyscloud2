"use client";

import { Construction } from "lucide-react";

export function ComingSoon({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-800/60 border border-surface-800">
        <Construction className="h-8 w-8 text-surface-500" />
      </div>
      <h1 className="text-xl font-bold text-white mb-2">{title}</h1>
      <p className="text-sm text-surface-400 max-w-md">
        {description || "This page is under construction. Check back soon!"}
      </p>
    </div>
  );
}
