import { HttpException } from "@nestjs/common";
import { GeofencesService } from "./geofences.service";
import { AccessService, type AccessRole, type AllowedSet } from "../supabase/access.service";
import type { CreateGeofenceBody } from "./geofences.types";

// H1 — les écritures de géofences (create/patch/remove) exigent le rôle 'action' ;
// la lecture (list) reste ouverte à la consultation.

const IMEI = "868720065811725";
const VID = 15; // id Traccar du véhicule
const ROW = "row-geo-1"; // device_id (uuid app) résolu

const BODY: CreateGeofenceBody = { name: "Zone", kind: "circle", area: { kind: "circle", lat: 14.7, lng: -17.4, radius: 120 } };
const geoRow = { id: "g1", device_id: ROW, traccar_geofence_id: 55, name: "Zone", kind: "circle", area: null, color: null, enabled: true };

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

// Chaîne Supabase minimale : thenable (await direct) + terminaux single/maybeSingle.
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
  const traccar = {
    getFleet: jest.fn().mockResolvedValue({ devices: [{ id: VID, uniqueId: IMEI }], positions: [] }),
    createGeofence: jest.fn().mockResolvedValue({ id: 55 }),
    linkGeofence: jest.fn().mockResolvedValue(undefined),
    unlinkGeofence: jest.fn().mockResolvedValue(undefined),
    deleteGeofence: jest.fn().mockResolvedValue(undefined),
  };
  const devices = { upsertByImei: jest.fn().mockResolvedValue({ id: ROW }) };
  const access = new AccessService({} as never);
  jest.spyOn(access, "allowed").mockResolvedValue(allowedSet(role));
  const supa = { client: { from: jest.fn() } };
  const service = new GeofencesService(traccar as never, devices as never, supa as never, access);
  return { traccar, devices, access, supa, service };
}

describe("GeofencesService — H1 gating écriture (rôle 'action')", () => {
  it("create() en consultation → 403 (avant tout write Traccar/DB)", async () => {
    const { service, traccar } = makeDeps("consultation");
    expect(await statusOf(service.create(VID, BODY, "u1"))).toBe(403);
    expect(traccar.createGeofence).not.toHaveBeenCalled();
  });

  it("create() en action → réussit", async () => {
    const { service, supa, traccar } = makeDeps("action");
    (supa.client.from as jest.Mock).mockReturnValueOnce(chain({ data: geoRow, error: null }));
    const vm = await service.create(VID, BODY, "u1");
    expect(vm.id).toBe("g1");
    expect(traccar.createGeofence).toHaveBeenCalled();
    expect(traccar.linkGeofence).toHaveBeenCalledWith(VID, 55);
  });

  it("patch() en consultation → 403", async () => {
    const { service, supa } = makeDeps("consultation");
    (supa.client.from as jest.Mock).mockReturnValueOnce(chain({ data: geoRow, error: null })); // getRow
    expect(await statusOf(service.patch("g1", { name: "X" }, "u1"))).toBe(403);
  });

  it("patch() en action → réussit", async () => {
    const { service, supa } = makeDeps("action");
    (supa.client.from as jest.Mock)
      .mockReturnValueOnce(chain({ data: geoRow, error: null })) // getRow
      .mockReturnValueOnce(chain({ data: { ...geoRow, name: "X" }, error: null })); // update
    const vm = await service.patch("g1", { name: "X" }, "u1");
    expect(vm.name).toBe("X");
  });

  it("remove() en consultation → 403", async () => {
    const { service, supa } = makeDeps("consultation");
    (supa.client.from as jest.Mock).mockReturnValueOnce(chain({ data: geoRow, error: null })); // getRow
    expect(await statusOf(service.remove("g1", "u1"))).toBe(403);
  });

  it("remove() en action → réussit", async () => {
    const { service, supa, traccar } = makeDeps("action");
    (supa.client.from as jest.Mock)
      .mockReturnValueOnce(chain({ data: geoRow, error: null })) // getRow
      .mockReturnValueOnce(chain({ error: null })); // delete
    const r = await service.remove("g1", "u1");
    expect(r).toEqual({ deleted: true });
    expect(traccar.deleteGeofence).toHaveBeenCalledWith(55);
  });

  it("list() reste accessible en consultation (lecture non cassée)", async () => {
    const { service, supa } = makeDeps("consultation");
    (supa.client.from as jest.Mock).mockReturnValueOnce(chain({ data: [geoRow], error: null }));
    const vms = await service.list(VID, "u1");
    expect(vms).toHaveLength(1);
    expect(vms[0].id).toBe("g1");
  });
});
