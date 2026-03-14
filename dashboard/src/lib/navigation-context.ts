// localStorage keys for remembering last navigation context
const LAST_ORG_KEY = "mc_last_org_slug";
const LAST_PROJECT_KEY = "mc_last_project_slug";

export function saveLastOrg(slug: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem(LAST_ORG_KEY, slug);
  }
}

export function saveLastProject(slug: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem(LAST_PROJECT_KEY, slug);
  }
}

export function getLastOrg(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LAST_ORG_KEY);
}

export function getLastProject(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LAST_PROJECT_KEY);
}

export function clearLastContext() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(LAST_ORG_KEY);
    localStorage.removeItem(LAST_PROJECT_KEY);
  }
}
