import { ReactNode } from "react";
import { Sidebar } from "@/components/shell/Sidebar";
import { Header } from "@/components/shell/Header";
import { CommandPalette } from "@/components/shell/CommandPalette";
import { AiChat } from "@/components/shell/AiChat";
import { AiChatFab } from "@/components/shell/AiChatFab";
import { AuthProvider } from "@/components/shell/AuthProvider";
import { Toaster } from "react-hot-toast";
import { SocketWrapper } from "@/components/shell/SocketWrapper";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <SocketWrapper>
    <AuthProvider>
      <div className="flex h-screen bg-[#0a0e17] text-surface-200 overflow-hidden font-sans">
        <Sidebar />

        <div className="flex flex-1 flex-col min-w-0">
          <Header />
          <div className="flex flex-1 overflow-hidden">
            <main className="flex-1 overflow-y-auto p-6">{children}</main>
            <AiChat />
          </div>
        </div>

        {/* Overlays */}
        <CommandPalette />
        <AiChatFab />

        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "#1e293b",
              color: "#f1f5f9",
              border: "1px solid #334155",
              borderRadius: "12px",
            },
          }}
        />
      </div>
    </AuthProvider>
    </SocketWrapper>
  );
}
