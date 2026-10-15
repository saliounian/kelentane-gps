import { Controller, Get, type INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { corsOrigin, parseCorsOrigins } from "./cors-origin";

@Controller()
class PingController {
  @Get("ping")
  ping() {
    return "pong";
  }
}

function decide(origin: string | undefined) {
  let result: { err: Error | null; allow?: boolean } | undefined;
  corsOrigin(origin, (err, allow) => (result = { err, allow }));
  return result;
}

describe("corsOrigin", () => {
  const saved = process.env.CORS_ORIGINS;
  afterEach(() => {
    if (saved === undefined) delete process.env.CORS_ORIGINS;
    else process.env.CORS_ORIGINS = saved;
  });

  it("parse la liste en ignorant espaces et entrées vides", () => {
    expect(parseCorsOrigins(" https://a.test , ,https://b.test")).toEqual(["https://a.test", "https://b.test"]);
    expect(parseCorsOrigins(undefined)).toEqual([]);
  });

  describe("CORS_ORIGINS définie", () => {
    beforeEach(() => (process.env.CORS_ORIGINS = "https://app.test,https://admin.test"));

    it("admet une origine autorisée", () => {
      expect(decide("https://admin.test")).toEqual({ err: null, allow: true });
    });

    it("refuse une origine non autorisée SANS erreur", () => {
      expect(decide("https://evil.test")).toEqual({ err: null, allow: false });
    });

    it("admet les requêtes sans en-tête Origin (apps natives)", () => {
      expect(decide(undefined)).toEqual({ err: null, allow: true });
    });
  });

  it("CORS_ORIGINS absente → ouvert", () => {
    delete process.env.CORS_ORIGINS;
    expect(decide("https://n-importe.test")).toEqual({ err: null, allow: true });
  });

  describe("intégration HTTP (Express)", () => {
    let app: INestApplication;

    beforeAll(async () => {
      const mod = await Test.createTestingModule({ controllers: [PingController] }).compile();
      app = mod.createNestApplication();
      app.enableCors({ origin: corsOrigin });
      await app.init();
    });
    afterAll(() => app.close());
    beforeEach(() => (process.env.CORS_ORIGINS = "https://app.test"));

    it("origine non autorisée → 200, aucun en-tête CORS (plus de 500)", async () => {
      const res = await request(app.getHttpServer()).get("/ping").set("Origin", "https://evil.test");
      expect(res.status).toBe(200);
      expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    });

    it("preflight d'une origine non autorisée → pas de 500, aucun en-tête CORS", async () => {
      const res = await request(app.getHttpServer())
        .options("/ping")
        .set("Origin", "https://evil.test")
        .set("Access-Control-Request-Method", "GET");
      expect(res.status).toBeLessThan(500);
      expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    });

    it("origine autorisée → en-tête CORS renvoyé", async () => {
      const res = await request(app.getHttpServer()).get("/ping").set("Origin", "https://app.test");
      expect(res.status).toBe(200);
      expect(res.headers["access-control-allow-origin"]).toBe("https://app.test");
    });

    it("sans Origin → 200", async () => {
      const res = await request(app.getHttpServer()).get("/ping");
      expect(res.status).toBe(200);
    });
  });
});
