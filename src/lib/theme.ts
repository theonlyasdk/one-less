/**
 * Light/dark theme.
 *
 * The colour tokens live in CSS: light on `:root`, dark on `.dark`. This module
 * only decides which class is on `<html>` and remembers the choice. It also
 * stamps the class before React mounts (see `main.tsx`) so the first paint is
 * never the wrong scheme.
 */

const STORAGE_KEY = "oneless.theme.v1";

export type ThemePreference = "light" | "dark";

export function readStoredTheme(): ThemePreference | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === "light" || raw === "dark" ? raw : null;
  } catch {
    return null;
  }
}

export function systemTheme(): ThemePreference {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** The preference in force: the stored choice, else the system setting. */
export function resolveTheme(): ThemePreference {
  return readStoredTheme() ?? systemTheme();
}

export function applyTheme(theme: ThemePreference): void {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  // `light` pins the light tokens even when the OS asks for dark.
  root.classList.toggle("light", theme === "light");
  root.style.colorScheme = theme;
}

export function storeTheme(theme: ThemePreference): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Private-mode failures are non-fatal; the toggle still works this session.
  }
}

/** Runs before the React app mounts so there is no light/dark flash. */
export function initTheme(): void {
  applyTheme(resolveTheme());
}
