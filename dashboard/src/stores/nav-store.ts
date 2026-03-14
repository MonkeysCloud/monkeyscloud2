import { create } from "zustand";

/* ─── Cookie helpers ─── */
function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, days = 365) {
  if (typeof document === "undefined") return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)};expires=${expires};path=/;SameSite=Lax`;
}

/* ─── Store ─── */

interface NavState {
  /* Sidebar */
  sidebarCollapsed: boolean;
  mobileSidebarOpen: boolean;
  expandedSections: string[];
  activeProjectSlug: string | null;

  /* Panels */
  showCommandPalette: boolean;
  showNotifications: boolean;
  showAiChat: boolean;

  /* Actions */
  toggleSidebar: () => void;
  setSidebarCollapsed: (v: boolean) => void;
  setMobileSidebarOpen: (v: boolean) => void;
  toggleSection: (id: string) => void;
  setActiveProject: (slug: string | null) => void;
  setShowCommandPalette: (v: boolean) => void;
  setShowNotifications: (v: boolean) => void;
  setShowAiChat: (v: boolean) => void;
  closeAllPanels: () => void;
}

export const useNavStore = create<NavState>((set) => ({
  sidebarCollapsed: getCookie("sidebar_collapsed") === "true",
  mobileSidebarOpen: false,
  expandedSections: [],
  activeProjectSlug: null,

  showCommandPalette: false,
  showNotifications: false,
  showAiChat: false,

  toggleSidebar: () =>
    set((s) => {
      const next = !s.sidebarCollapsed;
      setCookie("sidebar_collapsed", String(next));
      return { sidebarCollapsed: next };
    }),
  setSidebarCollapsed: (v) => {
    setCookie("sidebar_collapsed", String(v));
    set({ sidebarCollapsed: v });
  },
  setMobileSidebarOpen: (v) => set({ mobileSidebarOpen: v }),
  toggleSection: (id) =>
    set((s) => ({
      expandedSections: s.expandedSections.includes(id)
        ? s.expandedSections.filter((x) => x !== id)
        : [...s.expandedSections, id],
    })),
  setActiveProject: (slug) => set({ activeProjectSlug: slug }),
  setShowCommandPalette: (v) => set({ showCommandPalette: v }),
  setShowNotifications: (v) =>
    set({ showNotifications: v, showAiChat: false }),
  setShowAiChat: (v) => set({ showAiChat: v }),
  closeAllPanels: () =>
    set({
      showCommandPalette: false,
      showNotifications: false,
      mobileSidebarOpen: false,
    }),
}));
