import { createContext, useContext } from "react";

import type { ThemePreference } from "@/lib/theme";

export interface ThemeContextValue {
  /** The resolved scheme currently applied to `<html>`. */
  theme: ThemePreference;
  /** Flips between light and dark and remembers the choice. */
  toggle: () => void;
}

/** Kept apart from the provider so that file only exports a component. */
export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
