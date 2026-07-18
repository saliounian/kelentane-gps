import { HttpException } from "@nestjs/common";
import { SharesService } from "./shares.service";
import { AccessService, type AccessRole, type AllowedSet } from "../supabase/access.service";

// H1 — émettre un jeton de partage (create) donne accès à un tiers → action, pas lecture.
// claim() est le bénéficiaire qui s'auto-rattache → aucune garde owner/action requise.

const IMEI = "868720065811725";
const VID = 15;
const ROW = "row-share-1";

const statusOf = async (p: Promise<unknown>): Promise<number> => {
  try {
    await p;
    throw new Error("attendu: exception");
  } catch (e) {
    if (e instanceof HttpException) return e.getStatus();
    throw e;
  }
};

function allowedSet(role: AccessRole): AllowedSet {
  return {
    imeis: new Set([IMEI]),
    traccarIds: new Set([VID]),
    rowIds: new Set([ROW]),
    role: new Map([[IMEI, role]]),
    roleByRowId: new Map([[ROW, role]]),
  };
}

function chain(result: unknown) {
  const c: Record<string, unknown> = {};
  const self = () => c;
  Object.assign(c, {
    select: self, insert: self, update: self, delete: self, eq: self, order: self,
    single: async () => result,
    maybeSingle: async () => result,
    then: (resolve: (v: unknown) => void) => resolve(result),
  });
  return c;
}

function makeDeps(role: AccessRole) {
  const traccar = { getFleet: jest.fn().mockResolvedValue({ devices: [{ id: VID, uniqueId: IMEI }], positions: [] }) };
  const devices = { upsertByImei: jest.fn().mockResolvedValue({ id: ROW }) };
  const access = new AccessService({} as never);
  jest.spyOn(access, "allowed").mockResolvedValue(allowedSet(role));
  const supa = { client: { from: jest.fn() } };
  const service = new SharesService(traccar as never, devices as never, supa as never, access);
  return { traccar, devices, access, supa, service };
}

describe("SharesService — H1 gating émission de partage (rôle 'action')", () => {
  it("create() en consultation → 403 (aucun jeton émis)", async () => {
    const { service, supa } = makeDeps("consultation");
    expect(await statusOf(service.create(VID, "u1"))).toBe(403);
    expect(supa.client.from).not.toHaveBeenCalled();
  });

  it("create() en action → émet un jeton scope 'read'", async () => {
    const { service, supa } = makeDeps("action");
    (supa.client.from as jest.Mock).mockReturnValueOnce(chain({ error: null })); // insert device_shares
    const r = await service.create(VID, "u1");
    expect(r.scope).toBe("read");
    expect(r.token).toMatch(/^KLN-/);
  });

  it("claim() ne passe pas les gardes owner/action (le bénéficiaire s'auto-rattache)", async () => {
    const { service, supa, access } = makeDeps("consultation");
    (supa.client.from as jest.Mock)
      .mockReturnValueOnce(chain({ data: { id: "s1", shared_with: null }, error: null })) // select token
      .mockReturnValueOnce(chain({ error: null })); // update shared_with
    const r = await service.claim("KLN-ABCD1234", "benef");
    expect(r).toEqual({ ok: true });
    expect(access.allowed).not.toHaveBeenCalled();
  });
});
