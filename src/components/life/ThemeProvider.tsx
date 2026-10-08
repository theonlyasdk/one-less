import { useCallback, useEffect, useMemo, useState } from "react";

import { ThemeContext, type ThemeContextValue } from "@/components/life/themeContext";
import { applyTheme, resolveTheme, storeTheme, type ThemePreference } from "@/lib/theme";

/**
 * Shares one resolved theme between the toggle and the toaster.
 *
 * Previously each component kept its own state, which meant a toast could
 * render in the wrong scheme after the toggle changed it.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemePreference>(() => resolveTheme());

  // Re-resolve when the OS setting changes, but only while the user has not
  // made an explicit choice.
  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    function onChange() {
      setTheme(resolveTheme());
      applyTheme(resolveTheme());
    }
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: ThemePreference = prev === "dark" ? "light" : "dark";
      applyTheme(next);
      storeTheme(next);
      return next;
    });
  }, []);

  const value = useMemo<ThemeContextValue>(() => ({ theme, toggle }), [theme, toggle]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
