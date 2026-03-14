"use client";

import { useState } from "react";
import { useNavStore } from "@/stores/nav-store";
import { X, Bot, Send } from "lucide-react";
import clsx from "clsx";

interface Message {
  role: "user" | "ai";
  text: string;
}

const INITIAL_MESSAGES: Message[] = [
  { role: "user", text: "What failed in the last deploy?" },
  {
    role: "ai",
    text: "Deploy #91 to production failed at 2:34 PM. Root cause: npm run build exited with code 1 — TypeScript type mismatch in src/components/Auth.tsx:42. Suggested fix: Change the prop type from `string` to `string | undefined`.",
  },
];

const SUGGESTIONS = ["Summarize sprint", "Create task", "Release notes", "Compare envs"];

export function AiChat() {
  const { showAiChat, setShowAiChat } = useNavStore();
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");

  if (!showAiChat) return null;

  function handleSend() {
    if (!input.trim()) return;
    setMessages([
      ...messages,
      { role: "user", text: input },
      { role: "ai", text: "I'll look into that for you. Analyzing project data..." },
    ]);
    setInput("");
  }

  return (
    <div className={clsx(
      "border-l border-surface-800 bg-[#0b1121] flex flex-col animate-slide-left",
      // Mobile: full-screen fixed overlay
      "fixed inset-0 z-50 md:relative md:inset-auto md:z-auto",
      // Desktop: 380px side panel
      "md:w-[380px] md:min-w-[380px]"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-800">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary-400" />
          <span className="text-[13px] font-semibold text-surface-100">MonkeysAI</span>
        </div>
        <button
          onClick={() => setShowAiChat(false)}
          className="text-surface-500 hover:text-surface-300 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-surface-700">
        {messages.map((msg, i) => (
          <div key={i} className={clsx("flex flex-col", msg.role === "user" ? "items-end" : "items-start")}>
            <div
              className={clsx(
                "max-w-[90%] px-3.5 py-2.5 text-sm leading-relaxed",
                msg.role === "user"
                  ? "rounded-2xl rounded-br-sm bg-primary-500/15 border border-primary-500/20 text-surface-200"
                  : "rounded-2xl rounded-bl-sm bg-surface-800/60 border border-surface-800 text-surface-300"
              )}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {/* Suggestions */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => {
                setMessages([
                  ...messages,
                  { role: "user", text: s },
                  { role: "ai", text: `Working on "${s}"...` },
                ]);
              }}
              className="px-3 py-1.5 rounded-full bg-surface-800/60 border border-surface-800 text-[13px] text-surface-400 hover:border-primary-500/40 hover:text-primary-400 transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="flex gap-2 px-4 py-3 border-t border-surface-800">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Ask MonkeysAI..."
          className="flex-1 bg-[#111827] border border-surface-800 rounded-lg px-3 py-2 text-sm text-surface-200 placeholder:text-surface-500 outline-none focus:border-primary-500/50 transition-colors"
        />
        <button
          onClick={handleSend}
          className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary-500 hover:bg-primary-600 text-white transition-colors shrink-0"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
