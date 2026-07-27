import { DevicesService } from "./devices.service";

// Mock Supabase minimal : la chaîne .from().update().eq().eq().select().maybeSingle()
// se replie sur elle-même ; maybeSingle rend le résultat injecté.
function makeService(result: { data: unknown; error?: { message: string } | null }) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  Object.assign(chain, {
    select: self,
    update: self,
    eq: self,
    maybeSingle: async () => result,
  });
  const supa = { client: { from: () => chain } };
  return new DevicesService(supa as never);
}

describe("DevicesService.markSoldOnConnect (auto-passage stock→sold)", () => {
  it("'flipped' quand une ligne stock bascule en sold", async () => {
    const svc = makeService({ data: { id: "row" }, error: null });
    expect(await svc.markSoldOnConnect("123456789012345")).toBe("flipped");
  });

  it("'already' quand aucune ligne n'est touchée (déjà sold ou IMEI inconnu)", async () => {
    const svc = makeService({ data: null, error: null });
    expect(await svc.markSoldOnConnect("123456789012345")).toBe("already");
  });

  it("'error' en cas d'échec base (pas de mise en cache côté appelant)", async () => {
    const svc = makeService({ data: null, error: { message: "boom" } });
    expect(await svc.markSoldOnConnect("123456789012345")).toBe("error");
  });

  it("'error' si Supabase est indisponible", async () => {
    const svc = new DevicesService({ client: null } as never);
    expect(await svc.markSoldOnConnect("123456789012345")).toBe("error");
  });
});
