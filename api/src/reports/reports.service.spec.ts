import { ForbiddenException } from "@nestjs/common";
import { ReportsService } from "./reports.service";
import type { TraccarStop } from "../traccar/traccar.types";

// Device Traccar de test — uniqueId = IMEI utilisé par le contrôle d'accès.
const DEVICE = { id: 42, uniqueId: "868720065811725" };

function makeDeps(opts: { allowedImeis?: string[]; stops?: TraccarStop[] } = {}) {
  const traccar = {
    getDevices: jest.fn().mockResolvedValue([DEVICE]),
    getStops: jest.fn().mockResolvedValue(opts.stops ?? []),
  };
  const access = {
    allowed: jest.fn().mockResolvedValue({ imeis: new Set(opts.allowedImeis ?? [DEVICE.uniqueId]) }),
  };
  const service = new ReportsService(traccar as never, access as never);
  return { service, traccar, access };
}

const RANGE = { from: "2026-07-01T00:00:00.000Z", to: "2026-07-01T23:59:59.000Z" };

describe("ReportsService.stops", () => {
  it("retourne une liste cohérente (StopPoint normalisé) pour un device avec historique", async () => {
    const stops: TraccarStop[] = [
      {
        deviceId: 42,
        duration: 600_000, // 10 min
        startTime: "2026-07-01T08:00:00.000Z",
        endTime: "2026-07-01T08:10:00.000Z",
        latitude: 14.72,
        longitude: -17.46,
        address: "Dakar",
      },
      {
        deviceId: 42,
        duration: 180_000, // 3 min — pas d'adresse ni endTime remontés
        startTime: "2026-07-01T09:00:00.000Z",
      },
    ];
    const { service, traccar } = makeDeps({ stops });

    const res = await service.stops(42, RANGE, "user-1");

    expect(traccar.getStops).toHaveBeenCalledWith(42, RANGE.from, RANGE.to);
    expect(res).toEqual([
      {
        latitude: 14.72,
        longitude: -17.46,
        address: "Dakar",
        startTime: "2026-07-01T08:00:00.000Z",
        endTime: "2026-07-01T08:10:00.000Z",
        duration: 600_000,
      },
      {
        latitude: 0,
        longitude: 0,
        address: null,
        startTime: "2026-07-01T09:00:00.000Z",
        endTime: null,
        duration: 180_000,
      },
    ]);
  });

  it("écarte les arrêts < 2 min (plancher MIN_STOP_MS)", async () => {
    const stops: TraccarStop[] = [
      { deviceId: 42, duration: 60_000, startTime: "2026-07-01T08:00:00.000Z" }, // 1 min → exclu
      { deviceId: 42, duration: 120_000, startTime: "2026-07-01T09:00:00.000Z" }, // 2 min pile → gardé
    ];
    const { service } = makeDeps({ stops });
    const res = await service.stops(42, RANGE, "user-1");
    expect(res).toHaveLength(1);
    expect(res[0].startTime).toBe("2026-07-01T09:00:00.000Z");
  });

  it("transmet la période from/to au rapport Traccar", async () => {
    const custom = { from: "2026-06-01T00:00:00.000Z", to: "2026-06-30T23:59:59.000Z" };
    const { service, traccar } = makeDeps();
    await service.stops(42, custom, "user-1");
    expect(traccar.getStops).toHaveBeenCalledWith(42, custom.from, custom.to);
  });

  it("refuse l'accès (403) si le device n'est pas dans le périmètre du client", async () => {
    const { service, traccar } = makeDeps({ allowedImeis: [] });
    await expect(service.stops(42, RANGE, "user-1")).rejects.toBeInstanceOf(ForbiddenException);
    expect(traccar.getStops).not.toHaveBeenCalled();
  });
});
