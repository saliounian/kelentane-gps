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

// H2 — révoquer un partage (DELETE /shares/:id) exige le rôle 'action' sur le
// véhicule concerné ; 404 si le partage n'existe pas, 403 sinon.
describe("SharesService — H2 gating révocation de partage (rôle 'action')", () => {
  it("revoke() partage introuvable → 404 (aucune garde d'accès évaluée)", async () => {
    const { service, supa, access } = makeDeps("action");
    (supa.client.from as jest.Mock).mockReturnValueOnce(chain({ data: null, error: null })); // select share
    expect(await statusOf(service.revoke("missing", "u1"))).toBe(404);
    expect(access.allowed).not.toHaveBeenCalled();
  });

  it("revoke() en consultation → 403 (partage NON supprimé)", async () => {
    const { service, supa } = makeDeps("consultation");
    (supa.client.from as jest.Mock)
      .mockReturnValueOnce(chain({ data: { id: "s1", device_id: ROW }, error: null })) // select share
      .mockReturnValueOnce(chain({ data: { imei: IMEI }, error: null })); // select device (imei)
    expect(await statusOf(service.revoke("s1", "u1"))).toBe(403);
    expect(supa.client.from).toHaveBeenCalledTimes(2); // pas de 3e appel = pas de delete
  });

  it("revoke() en action → supprime le partage", async () => {
    const { service, supa } = makeDeps("action");
    (supa.client.from as jest.Mock)
      .mockReturnValueOnce(chain({ data: { id: "s1", device_id: ROW }, error: null })) // select share
      .mockReturnValueOnce(chain({ data: { imei: IMEI }, error: null })) // select device (imei)
      .mockReturnValueOnce(chain({ error: null })); // delete
    const r = await service.revoke("s1", "u1");
    expect(r).toEqual({ revoked: true });
  });
});
