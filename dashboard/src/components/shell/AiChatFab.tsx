"use client";

import { useNavStore } from "@/stores/nav-store";
import { Bot } from "lucide-react";

export function AiChatFab() {
  const { showAiChat, setShowAiChat } = useNavStore();

  if (showAiChat) return null;

  return (
    <button
      onClick={() => setShowAiChat(true)}
      className="fixed bottom-5 right-5 z-50 flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-violet-600 text-white shadow-lg shadow-primary-500/30 hover:shadow-xl hover:shadow-primary-500/40 hover:scale-110 transition-all"
      title="Open MonkeysAI"
    >
      <Bot className="h-5 w-5" />
    </button>
  );
}
