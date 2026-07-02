import { useCallback, useEffect, useRef, useState } from "react";
import { fetchVehicles } from "./api";
import type { VehicleVM } from "../types/vehicle";

const POLL_MS = 10000;

// TODO [BLOQUANT avant prod] Remplacer ce polling par le WebSocket Traccar
// relayé par la façade (positions + événements). Voir docs/PLAN.md §"Dette
// technique BLOQUANTE". Le polling est un provisoire d'étape 3, pas la cible.

type State = {
  vehicles: VehicleVM[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
};

/**
 * Positions réelles via l'API façade, en polling.
 * Le passage au WebSocket relayé (§10) se branchera ici sans changer l'API du hook.
 */
export function useVehicles(): State {
  const [vehicles, setVehicles] = useState<VehicleVM[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    abort.current?.abort();
    const ac = new AbortController();
    abort.current = ac;
    try {
      const data = await fetchVehicles(ac.signal);
      setVehicles(data);
      setError(null);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => {
      clearInterval(id);
      abort.current?.abort();
    };
  }, [load]);

  return { vehicles, loading, error, refresh: load };
}
