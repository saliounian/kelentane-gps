import { TraccarRealtimeService } from "./traccar-realtime.service";
import type { MarkSoldResult } from "../supabase/devices.service";

function makeService(markImpl: (imei: string) => Promise<MarkSoldResult>, enabled = true) {
  const devices = { enabled, markSoldOnConnect: jest.fn(markImpl) };
  const config = { get: () => undefined };
  const svc = new TraccarRealtimeService({} as never, devices as never, config as never);
  return { svc, devices };
}

describe("TraccarRealtimeService.markConnected (auto-passage + cache)", () => {
  it("dé-doublonne les IMEI d'un même lot (1 écriture par IMEI)", async () => {
    const { svc, devices } = makeService(async () => "flipped");
    await svc.markConnected(["a", "a", "b", "a"]);
    expect(devices.markSoldOnConnect).toHaveBeenCalledTimes(2);
    expect(devices.markSoldOnConnect).toHaveBeenCalledWith("a");
    expect(devices.markSoldOnConnect).toHaveBeenCalledWith("b");
  });

  it("ne ré-écrit plus un IMEI déjà réglé aux ticks suivants (idempotent)", async () => {
    const { svc, devices } = makeService(async () => "flipped");
    await svc.markConnected(["a"]); // flippe
    await svc.markConnected(["a"]); // caché → aucune nouvelle écriture
    expect(devices.markSoldOnConnect).toHaveBeenCalledTimes(1);
  });

  it("met aussi en cache les 'already' (déjà sold) — pas de martèlement DB", async () => {
    const { svc, devices } = makeService(async () => "already");
    await svc.markConnected(["a"]);
    await svc.markConnected(["a"]);
    expect(devices.markSoldOnConnect).toHaveBeenCalledTimes(1);
  });

  it("ne met PAS en cache sur 'error' → nouvelle tentative au tick suivant", async () => {
    const { svc, devices } = makeService(async () => "error");
    await svc.markConnected(["a"]);
    await svc.markConnected(["a"]);
    expect(devices.markSoldOnConnect).toHaveBeenCalledTimes(2);
  });

  it("no-op si la base est désactivée (aucun appel)", async () => {
    const { svc, devices } = makeService(async () => "flipped", false);
    await svc.markConnected(["a", "b"]);
    expect(devices.markSoldOnConnect).not.toHaveBeenCalled();
  });
});
