import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from "react";

type Store = {
  /** clé d'icône choisie par véhicule (id → clé). */
  overrides: Record<number, string>;
  setIcon: (vehicleId: number, key: string) => void;
};

const Ctx = createContext<Store | null>(null);

/**
 * Choix d'icône par véhicule, en mémoire.
 * TODO [étape 5] Persister via PATCH /vehicles/:id (base app), remplacer ce store.
 */
export function IconOverridesProvider({ children }: { children: ReactNode }) {
  const [overrides, setOverrides] = useState<Record<number, string>>({});
  const setIcon = useCallback((vehicleId: number, key: string) => {
    setOverrides((m) => ({ ...m, [vehicleId]: key }));
  }, []);
  const value = useMemo(() => ({ overrides, setIcon }), [overrides, setIcon]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useIconOverrides(): Store {
  const v = useContext(Ctx);
  if (!v) throw new Error("useIconOverrides doit être utilisé dans <IconOverridesProvider>");
  return v;
}
