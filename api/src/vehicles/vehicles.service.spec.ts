import { HttpException } from "@nestjs/common";
import { VehiclesService } from "./vehicles.service";
import type { TraccarService } from "../traccar/traccar.service";
import type { DevicesService } from "../supabase/devices.service";
import type { AccessService } from "../supabase/access.service";

const IMEI = "868720065811725";

function tDevice(id: number, uniqueId: string) {
  return { id, name: `dev${id}`, uniqueId, status: "offline", lastUpdate: null };
}

describe("VehiclesService.enroll (enrôlement / transfert §transfert)", () => {
  let traccar: jest.Mocked<Pick<TraccarService, "getFleet" | "createDevice">>;
  let devices: jest.Mocked<Pick<DevicesService, "existsByImei" | "transferByImei" | "insertOwned" | "setPassword">>;
  let service: VehiclesService;

  beforeEach(() => {
    traccar = { getFleet: jest.fn(), createDevice: jest.fn() } as never;
    devices = {
      existsByImei: jest.fn(),
      transferByImei: jest.fn(),
      insertOwned: jest.fn().mockResolvedValue(null),
      setPassword: jest.fn(),
    } as never;
    service = new VehiclesService(traccar as never, devices as never, {} as AccessService);
  });

  const status = async (p: Promise<unknown>): Promise<number> => {
    try {
      await p;
      throw new Error("attendu: exception");
    } catch (e) {
      if (e instanceof HttpException) return e.getStatus();
      throw e;
    }
  };

  it("IMEI invalide → 400", async () => {
    expect(await status(service.enroll("u1", "abc"))).toBe(400);
  });

  it("IMEI déjà enregistré SANS mot de passe → 409 transfer_required", async () => {
    devices.existsByImei.mockResolvedValue(true);
    try {
      await service.enroll("u1", IMEI);
      fail("attendu 409");
    } catch (e) {
      expect(e).toBeInstanceOf(HttpException);
      const ex = e as HttpException;
      expect(ex.getStatus()).toBe(409);
      expect(ex.getResponse()).toMatchObject({ code: "transfer_required" });
    }
    expect(traccar.createDevice).not.toHaveBeenCalled();
  });

  it("IMEI déjà enregistré + mauvais mot de passe → 403 bad_device_password", async () => {
    devices.existsByImei.mockResolvedValue(true);
    devices.transferByImei.mockResolvedValue(false);
    try {
      await service.enroll("u1", IMEI, undefined, "wrong");
      fail("attendu 403");
    } catch (e) {
      const ex = e as HttpException;
      expect(ex.getStatus()).toBe(403);
      expect(ex.getResponse()).toMatchObject({ code: "bad_device_password" });
    }
  });

  it("IMEI déjà enregistré + bon mot de passe → transfert, renvoie le VM", async () => {
    devices.existsByImei.mockResolvedValue(true);
    devices.transferByImei.mockResolvedValue(true);
    jest.spyOn(service, "list").mockResolvedValue([{ imei: IMEI, id: 7 } as never]);
    const vm = await service.enroll("u1", IMEI, undefined, "123456");
    expect(vm.imei).toBe(IMEI);
    expect(devices.transferByImei).toHaveBeenCalledWith(IMEI, "123456", "u1");
  });

  it("IMEI absent en base mais présent sur Traccar → ADOPTION (pas de createDevice)", async () => {
    devices.existsByImei.mockResolvedValue(false);
    traccar.getFleet.mockResolvedValue({ devices: [tDevice(42, IMEI)] as never, positions: [] });
    const vm = await service.enroll("u1", IMEI);
    expect(traccar.createDevice).not.toHaveBeenCalled();
    expect(devices.insertOwned).toHaveBeenCalledWith("u1", IMEI, 42, expect.any(Object));
    expect(vm.id).toBe(42);
    expect(vm.imei).toBe(IMEI);
  });

  it("IMEI absent partout → création Traccar puis enrôlement", async () => {
    devices.existsByImei.mockResolvedValue(false);
    traccar.getFleet.mockResolvedValue({ devices: [], positions: [] });
    traccar.createDevice.mockResolvedValue({ id: 99, uniqueId: IMEI });
    const vm = await service.enroll("u1", IMEI, "Ma voiture");
    expect(traccar.createDevice).toHaveBeenCalled();
    expect(vm.id).toBe(99);
  });

  it("Traccar injoignable (getFleet rejette) → l'erreur remonte, PAS un faux 409", async () => {
    devices.existsByImei.mockResolvedValue(false);
    traccar.getFleet.mockRejectedValue(new Error("EAI_AGAIN traccar"));
    await expect(service.enroll("u1", IMEI)).rejects.toThrow("EAI_AGAIN");
    expect(traccar.createDevice).not.toHaveBeenCalled();
  });

  it("setDevicePassword délègue à devices.setPassword", async () => {
    devices.setPassword.mockResolvedValue(true);
    expect(await service.setDevicePassword(5, "u1", "secret")).toBe(true);
    expect(devices.setPassword).toHaveBeenCalledWith(5, "u1", "secret");
  });
});
