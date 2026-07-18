import { HttpException } from "@nestjs/common";
import { VehiclesService } from "./vehicles.service";
import { AccessService, type AccessRole, type AllowedSet } from "../supabase/access.service";

const IMEI = "868720065811725";

function tDevice(id: number, uniqueId: string) {
  return { id, name: `dev${id}`, uniqueId, status: "offline", lastUpdate: null };
}

const statusOf = async (p: Promise<unknown>): Promise<number> => {
  try {
    await p;
    throw new Error("attendu: exception");
  } catch (e) {
    if (e instanceof HttpException) return e.getStatus();
    throw e;
  }
};

describe("VehiclesService.enroll (device NEUF — plus de transfert)", () => {
  let traccar: { getFleet: jest.Mock; createDevice: jest.Mock };
  let devices: {
    existsByImei: jest.Mock;
    insertOwned: jest.Mock;
    insertAccess: jest.Mock;
  };
  let service: VehiclesService;

  beforeEach(() => {
    traccar = { getFleet: jest.fn(), createDevice: jest.fn() };
    devices = {
      existsByImei: jest.fn(),
      insertOwned: jest.fn().mockResolvedValue(null),
      insertAccess: jest.fn(),
    };
    service = new VehiclesService(traccar as never, devices as never, {} as AccessService);
  });

  it("IMEI invalide → 400", async () => {
    expect(await statusOf(service.enroll("u1", "abc"))).toBe(400);
  });

  it("IMEI déjà existant → 409 code 'exists' (aucun transfert)", async () => {
    devices.existsByImei.mockResolvedValue(true);
    try {
      await service.enroll("u1", IMEI);
      fail("attendu 409");
    } catch (e) {
      const ex = e as HttpException;
      expect(ex.getStatus()).toBe(409);
      expect(ex.getResponse()).toMatchObject({ code: "exists" });
    }
    expect(traccar.createDevice).not.toHaveBeenCalled();
  });

  it("device absent en base mais présent sur Traccar → ADOPTION + premier accès", async () => {
    devices.existsByImei.mockResolvedValue(false);
    traccar.getFleet.mockResolvedValue({ devices: [tDevice(42, IMEI)], positions: [] });
    devices.insertOwned.mockResolvedValue({ id: "row-1" });
    const vm = await service.enroll("u1", IMEI);
    expect(traccar.createDevice).not.toHaveBeenCalled();
    expect(devices.insertOwned).toHaveBeenCalledWith("u1", IMEI, 42, expect.any(Object));
    expect(devices.insertAccess).toHaveBeenCalledWith("row-1", "u1", "action");
    expect(vm.id).toBe(42);
    expect(vm.accessRole).toBe("action");
    expect(vm.accessStatus).toBe("active");
  });

  it("device absent partout → création Traccar", async () => {
    devices.existsByImei.mockResolvedValue(false);
    traccar.getFleet.mockResolvedValue({ devices: [], positions: [] });
    traccar.createDevice.mockResolvedValue({ id: 99, uniqueId: IMEI });
    const vm = await service.enroll("u1", IMEI, "Ma voiture");
    expect(traccar.createDevice).toHaveBeenCalled();
    expect(vm.id).toBe(99);
  });

  it("Traccar injoignable → l'erreur remonte (PAS un faux 409)", async () => {
    devices.existsByImei.mockResolvedValue(false);
    traccar.getFleet.mockRejectedValue(new Error("EAI_AGAIN traccar"));
    await expect(service.enroll("u1", IMEI)).rejects.toThrow("EAI_AGAIN");
    expect(traccar.createDevice).not.toHaveBeenCalled();
  });
});

describe("VehiclesService.addAccess (ajout coexistant §3)", () => {
  let devices: { addAccess: jest.Mock };
  let service: VehiclesService;

  beforeEach(() => {
    devices = { addAccess: jest.fn() };
    service = new VehiclesService({} as never, devices as never, {} as AccessService);
  });

  it("IMEI + mot de passe OK → renvoie le VM (coexistence)", async () => {
    devices.addAccess.mockResolvedValue("ok");
    jest.spyOn(service, "list").mockResolvedValue([{ imei: IMEI, id: 7 } as never]);
    const vm = await service.addAccess("u1", IMEI, "123456");
    expect(vm.imei).toBe(IMEI);
    expect(devices.addAccess).toHaveBeenCalledWith(IMEI, "123456", "u1");
  });

  it("mauvais mot de passe / IMEI inconnu → 403 générique 'bad_credentials'", async () => {
    devices.addAccess.mockResolvedValue("bad");
    try {
      await service.addAccess("u1", IMEI, "x");
      fail("attendu 403");
    } catch (e) {
      const ex = e as HttpException;
      expect(ex.getStatus()).toBe(403);
      expect(ex.getResponse()).toMatchObject({ code: "bad_credentials" });
    }
  });

  it("rate-limité → 429", async () => {
    devices.addAccess.mockResolvedValue("rate_limited");
    expect(await statusOf(service.addAccess("u1", IMEI, "x"))).toBe(429);
  });

  it("IMEI invalide ou mot de passe vide → 403 sans toucher la base", async () => {
    expect(await statusOf(service.addAccess("u1", "abc", "x"))).toBe(403);
    expect(await statusOf(service.addAccess("u1", IMEI, ""))).toBe(403);
    expect(devices.addAccess).not.toHaveBeenCalled();
  });
});

describe("VehiclesService.patch — écriture métadonnées gatée 'action' (H1)", () => {
  function makeAccess(role: AccessRole): AccessService {
    const access = new AccessService({} as never);
    const set: AllowedSet = {
      imeis: new Set([IMEI]),
      traccarIds: new Set([15]),
      rowIds: new Set(),
      role: new Map([[IMEI, role]]),
      roleByRowId: new Map(),
    };
    jest.spyOn(access, "allowed").mockResolvedValue(set);
    return access;
  }

  it("consultation → 403 (aucune écriture)", async () => {
    const traccar = { getFleet: jest.fn().mockResolvedValue({ devices: [tDevice(15, IMEI)], positions: [] }) };
    const devices = { upsertByImei: jest.fn() };
    const service = new VehiclesService(traccar as never, devices as never, makeAccess("consultation"));
    expect(await statusOf(service.patch(15, { name: "Young" }, "u1"))).toBe(403);
    expect(devices.upsertByImei).not.toHaveBeenCalled();
  });

  it("action → réussit et transmet le vrai userId authentifié à upsertByImei", async () => {
    const traccar = { getFleet: jest.fn().mockResolvedValue({ devices: [tDevice(15, IMEI)], positions: [] }) };
    const devices = { upsertByImei: jest.fn().mockResolvedValue({ owner_id: "real-user" }) };
    const service = new VehiclesService(traccar as never, devices as never, makeAccess("action"));

    await service.patch(15, { name: "Young" }, "real-user");

    expect(devices.upsertByImei).toHaveBeenCalledWith(IMEI, 15, "real-user", { name: "Young" });
  });
});

describe("VehiclesService.setDevicePassword", () => {
  it("délègue à devices.setPassword", async () => {
    const devices = { setPassword: jest.fn().mockResolvedValue(true) };
    const service = new VehiclesService({} as never, devices as never, {} as AccessService);
    expect(await service.setDevicePassword(5, "u1", "secret")).toBe(true);
    expect(devices.setPassword).toHaveBeenCalledWith(5, "u1", "secret");
  });
});
