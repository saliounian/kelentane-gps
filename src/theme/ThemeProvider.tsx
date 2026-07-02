import { createContext, ReactNode, useContext, useMemo, useState } from "react";
import { theme, Theme } from "./tokens";

type ThemeCtx = { t: Theme; dark: boolean; toggle: () => void };

const Ctx = createContext<ThemeCtx | null>(null);

/** Fournit le thème + bascule dark/light à toute l'app. */
export function ThemeProvider({ children, initialDark = true }: { children: ReactNode; initialDark?: boolean }) {
  const [dark, setDark] = useState(initialDark);
  const value = useMemo<ThemeCtx>(
    () => ({ t: theme(dark), dark, toggle: () => setDark((d) => !d) }),
    [dark],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useTheme doit être utilisé dans <ThemeProvider>");
  return v;
}
