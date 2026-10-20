import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";
const KEY = "aidlc-theme";

interface ThemeState {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeState>({ theme: "system", setTheme: () => {} });

function apply(theme: Theme) {
  const dark =
    theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

/** Light / dark / follow-OS. The choice is local to this browser (localStorage). */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, set] = useState<Theme>(
    () => (localStorage.getItem(KEY) as Theme | null) ?? "system",
  );
  useEffect(() => {
    apply(theme);
    if (theme !== "system") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const on = () => apply("system");
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [theme]);
  const setTheme = useCallback((t: Theme) => {
    if (t === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, t);
    set(t);
  }, []);
  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
