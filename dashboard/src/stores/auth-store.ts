import { create } from "zustand";

interface User {
  id: number;
  email: string;
  name: string;
  avatar_url?: string;
  timezone?: string;
  locale?: string;
  is_admin?: boolean;
}

interface Organization {
  id: number;
  name: string;
  slug: string;
  avatar_url?: string;
}

interface AuthState {
  user: User | null;
  organizations: Organization[];
  currentOrg: Organization | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setOrganizations: (orgs: Organization[]) => void;
  setCurrentOrg: (org: Organization | null) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  organizations: [],
  currentOrg: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setOrganizations: (organizations) =>
    set({ organizations, currentOrg: organizations[0] ?? null }),
  setCurrentOrg: (currentOrg) => set({ currentOrg }),
  setLoading: (isLoading) => set({ isLoading }),
  reset: () =>
    set({ user: null, organizations: [], currentOrg: null, isLoading: false }),
}));
