"use client";

import { useEffect, useRef, useState } from "react";
import { useNavStore } from "@/stores/nav-store";
import {
  Search,
  ListChecks,
  GitPullRequest,
  Rocket,
  Kanban,
  Settings,
  Plus,
  UserPlus,
  BookOpen,
  Keyboard,
  MessageSquare,
  FolderPlus,
} from "lucide-react";
import clsx from "clsx";

type PaletteItem = {
  icon: typeof Search;
  label: string;
  tag?: string;
  shortcut?: string;
};

const SECTIONS: { title: string; items: PaletteItem[] }[] = [
  {
    title: "RECENT",
    items: [
      { icon: ListChecks, label: "PROJ-42: Add user authentication", tag: "Task" },
      { icon: GitPullRequest, label: "PR #17: Feature auth module", tag: "PR" },
      { icon: Rocket, label: "Deploy #91 to production", tag: "Deploy" },
    ],
  },
  {
    title: "QUICK ACTIONS",
    items: [
      { icon: Plus, label: "Create new task", shortcut: "⌘N" },
      { icon: GitPullRequest, label: "Create pull request", shortcut: "⌘⇧P" },
      { icon: Rocket, label: "Trigger deploy", shortcut: "⌘⇧D" },
      { icon: FolderPlus, label: "Create new project" },
      { icon: UserPlus, label: "Invite team member" },
    ],
  },
  {
    title: "NAVIGATION",
    items: [
      { icon: Kanban, label: "Go to Board", shortcut: "⌘⇧B" },
      { icon: ListChecks, label: "Go to Tasks" },
      { icon: GitPullRequest, label: "Go to Pull Requests" },
      { icon: Settings, label: "Go to Settings" },
    ],
  },
  {
    title: "HELP",
    items: [
      { icon: BookOpen, label: "Documentation" },
      { icon: Keyboard, label: "Keyboard shortcuts", shortcut: "⌘/" },
      { icon: MessageSquare, label: "Send feedback" },
    ],
  },
];

export function CommandPalette() {
  const { showCommandPalette, setShowCommandPalette } = useNavStore();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  useEffect(() => {
    if (showCommandPalette) {
      setQuery("");
      setHighlightedIndex(0);
      // Small delay to let the modal render
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [showCommandPalette]);

  if (!showCommandPalette) return null;

  const filteredSections = SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) =>
      item.label.toLowerCase().includes(query.toLowerCase())
    ),
  })).filter((section) => section.items.length > 0);

  return (
    <div
      className="fixed inset-0 z-[1000] flex justify-center pt-[120px] bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={() => setShowCommandPalette(false)}
    >
      <div
        className="w-[560px] max-h-[440px] bg-[#111827] border border-surface-800 rounded-xl overflow-hidden shadow-2xl shadow-black/50 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-surface-800">
          <Search className="h-4 w-4 text-surface-500 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search or type a command..."
            className="flex-1 bg-transparent text-[14px] text-surface-100 placeholder:text-surface-500 outline-none"
          />
          <kbd className="text-xs text-surface-600 border border-surface-700 bg-surface-800/50 rounded px-1.5 py-0.5">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[360px] overflow-y-auto py-2 scrollbar-thin scrollbar-thumb-surface-700">
          {filteredSections.length === 0 && (
            <div className="px-4 py-8 text-center text-[13px] text-surface-500">
              No results for &ldquo;{query}&rdquo;
            </div>
          )}
          {filteredSections.map((section) => (
            <div key={section.title} className="mb-1">
              <div className="px-4 py-1.5 text-xs font-bold uppercase tracking-[1.5px] text-surface-600">
                {section.title}
              </div>
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.label}
                    className="flex w-full items-center gap-3 px-4 py-2 text-[13px] text-surface-300 hover:bg-primary-500/10 hover:text-white transition-colors group"
                    onClick={() => setShowCommandPalette(false)}
                  >
                    <Icon className="h-4 w-4 text-surface-500 group-hover:text-primary-400 shrink-0" />
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.tag && (
                      <span className="text-xs px-2 py-0.5 rounded bg-surface-800 text-surface-500">
                        {item.tag}
                      </span>
                    )}
                    {item.shortcut && (
                      <kbd className="text-xs text-surface-600 border border-surface-700 bg-surface-800/50 rounded px-1.5 py-0.5">
                        {item.shortcut}
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
