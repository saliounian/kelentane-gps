import { BadRequestException, NotFoundException } from "@nestjs/common";
import { AdminService } from "./admin.service";

// Mock Supabase : from() rend une chaîne fraîche ; les terminaux (maybeSingle/single/
// await direct via then) consomment une file de résultats dans l'ordre des appels.
function makeSupa(queue: unknown[]) {
  let i = 0;
  const next = () => queue[i++] ?? { data: null };
  const make = () => {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    Object.assign(chain, {
      select: self, eq: self, ilike: self, update: self, insert: self, delete: self, in: self, order: self,
      maybeSingle: async () => next(),
      single: async () => next(),
      then: (resolve: (v: unknown) => void) => resolve(next()),
    });
    return chain;
  };
  return { client: { from: () => make(), rpc: jest.fn() } };
}

function makeDeps(supaQueue: unknown[] = []) {
  const supa = makeSupa(supaQueue);
  const devices = {
    existsByImei: jest.fn(),
    upsertByImei: jest.fn().mockResolvedValue({ id: "row" }),
    getRowByImei: jest.fn(),
    insertAccess: jest.fn().mockResolvedValue(undefined),
    removeAccessByImei: jest.fn().mockResolvedValue(true),
    deleteByImei: jest.fn().mockResolvedValue(1),
  };
  const accounts = { ensureDeviceAccount: jest.fn().mockResolvedValue(undefined) };
  const traccar = {
    getFleet: jest.fn().mockResolvedValue({ devices: [], positions: [] }),
    createDevice: jest.fn(),
    deleteDevice: jest.fn().mockResolvedValue(undefined),
  };
  const service = new AdminService(supa as never, devices as never, accounts as never, traccar as never);
  return { service, devices, accounts, traccar };
}

describe("AdminService.validateBulk", () => {
  it("rejette > 200 IMEI", () => {
    expect(() => AdminService.validateBulk(Array(201).fill("123456789012"))).toThrow(BadRequestException);
  });
  it("rejette un body non-tableau", () => {
    expect(() => AdminService.validateBulk("nope")).toThrow(BadRequestException);
  });
});

describe("AdminService.bulkEnroll", () => {
  it("gère un IMEI déjà existant sans planter le batch", async () => {
    const { service, devices, traccar } = makeDeps();
    devices.existsByImei.mockImplementation(async (imei: string) => imei === "123456789012");
    traccar.createDevice.mockImplementation(async (_n: string, imei: string) => {
      if (imei === "999999999999") throw new Error("Traccar 500");
      return { id: 99, uniqueId: imei };
    });

    const res = await service.bulkEnroll(["123456789012", "868720065811725", "999999999999", "abc"], "admin1");

    expect(res).toEqual([
      { imei: "123456789012", status: "exists" },
      { imei: "868720065811725", status: "created" },
      { imei: "999999999999", status: "error", message: "Traccar 500" },
      { imei: "abc", status: "error", message: "IMEI invalide" },
    ]);
    // Le device existant n'est pas recréé ; l'IMEI invalide ne touche pas Traccar.
    expect(traccar.createDevice).toHaveBeenCalledTimes(2);
  });

  it("Traccar injoignable → tous en erreur, batch non planté", async () => {
    const { service, traccar } = makeDeps();
    traccar.getFleet.mockRejectedValue(new Error("EAI_AGAIN"));
    const res = await service.bulkEnroll(["123456789012"], "admin1");
    expect(res[0].status).toBe("error");
  });
});

describe("AdminService.transfer", () => {
  it("échoue proprement (404) si le compte source n'a pas d'accès actif", async () => {
    // resolveUser(from) → id ; resolveUser(to) → id ; device_access maybeSingle → null.
    const { service, devices } = makeDeps([
      { data: { id: "f1", username: "from" } },
      { data: { id: "t1", username: "to" } },
      { data: null },
    ]);
    devices.getRowByImei.mockResolvedValue({ id: "dev-row", traccar_id: 10 });

    await expect(service.transfer("868720065811725", "from", "to")).rejects.toBeInstanceOf(NotFoundException);
    expect(devices.insertAccess).not.toHaveBeenCalled();
    expect(devices.removeAccessByImei).not.toHaveBeenCalled();
  });

  it("transfère : accorde au destinataire puis retire la source", async () => {
    const { service, devices } = makeDeps([
      { data: { id: "f1", username: "from" } },
      { data: { id: "t1", username: "to" } },
      { data: { id: "acc-1" } }, // accès actif de la source
    ]);
    devices.getRowByImei.mockResolvedValue({ id: "dev-row", traccar_id: 10 });

    const res = await service.transfer("868720065811725", "from", "to");

    expect(res).toEqual({ transferred: true, imei: "868720065811725", from: "from", to: "to" });
    expect(devices.insertAccess).toHaveBeenCalledWith("dev-row", "t1", "action");
    expect(devices.removeAccessByImei).toHaveBeenCalledWith("868720065811725", "f1");
  });
});

describe("AdminService.promote", () => {
  it("empêche l'auto-rétrogradation (400)", async () => {
    const { service } = makeDeps([{ data: { id: "me", username: "me" } }]);
    await expect(service.promote("me", false, "me")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("promeut un autre compte", async () => {
    const { service } = makeDeps([
      { data: { id: "other", username: "bob" } }, // resolveUser
      { data: { id: "other", username: "bob", is_admin: true } }, // update ... single
    ]);
    const res = await service.promote("bob", true, "me");
    expect(res).toEqual({ id: "other", username: "bob", is_admin: true });
  });
});

describe("AdminService.purgeTest", () => {
  const testList = {
    data: [
      { id: "d1", imei: "1234567890", name: "Chr", traccar_id: 6 },
      { id: "d2", imei: "868000000000101", name: "Démo", traccar_id: 1 },
      { id: "d3", imei: "868720065811725", name: "Réel", traccar_id: 15 },
    ],
    error: null,
  };

  it("dry run : liste les candidats sans rien supprimer", async () => {
    const { service, devices, traccar } = makeDeps([testList]);
    const res = await service.purgeTest(false);
    expect(res.dryRun).toBe(true);
    expect(res.count).toBe(2); // le vrai IMEI 15 chiffres est exclu
    expect(res.devices.map((d) => d.imei)).toEqual(["1234567890", "868000000000101"]);
    expect(devices.deleteByImei).not.toHaveBeenCalled();
    expect(traccar.deleteDevice).not.toHaveBeenCalled();
  });

  it("confirm=true : supprime réellement les candidats", async () => {
    const { service, devices, traccar } = makeDeps([testList]);
    const res = await service.purgeTest(true);
    expect(res.dryRun).toBe(false);
    expect(res.count).toBe(2);
    expect(devices.deleteByImei).toHaveBeenCalledTimes(2);
    expect(traccar.deleteDevice).toHaveBeenCalledTimes(2);
  });
});
