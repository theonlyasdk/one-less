import { MoonIcon, SunIcon } from "lucide-react";

import { useTheme } from "@/components/life/themeContext";
import { Button } from "@/components/ui/button";
import { cn } from "cn";

/**
 * Light/dark switch.
 *
 * The two icons are stacked and cross-fade with a counter-rotation, so the sun
 * appears to set behind the moon and vice versa.
 */
export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-pressed={isDark}
      className="relative overflow-hidden"
    >
      <SunIcon
        aria-hidden
        className={cn(
          "absolute transition-all duration-300 ease-in-out motion-reduce:transition-none",
          isDark ? "scale-50 -rotate-90 opacity-0" : "scale-100 rotate-0 opacity-100",
        )}
      />
      <MoonIcon
        aria-hidden
        className={cn(
          "absolute transition-all duration-300 ease-in-out motion-reduce:transition-none",
          isDark ? "scale-100 rotate-0 opacity-100" : "scale-50 rotate-90 opacity-0",
        )}
      />
    </Button>
  );
}
