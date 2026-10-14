import { SupabaseService } from "./supabase.service";

// getMustChangePassword doit être fail-closed côté appelant : null = indéterminable,
// jamais confondu avec false. Pas de tests existants pour ce fichier avant ce lot.

function chain(result: unknown) {
  const c: Record<string, unknown> = {};
  const self = () => c;
  Object.assign(c, { select: self, eq: self, maybeSingle: async () => result });
  return c;
}

/** Instancie SupabaseService sans passer par le constructeur (évite ConfigService/createClient réel). */
function makeService(client: unknown): SupabaseService {
  const svc = Object.create(SupabaseService.prototype) as SupabaseService;
  (svc as unknown as { client: unknown; log: unknown }).client = client;
  (svc as unknown as { client: unknown; log: unknown }).log = { error: jest.fn(), warn: jest.fn(), log: jest.fn() };
  return svc;
}

describe("SupabaseService.getMustChangePassword — fail-closed (null = indéterminable)", () => {
  it("client Supabase indisponible → null", async () => {
    const svc = makeService(null);
    expect(await svc.getMustChangePassword("u1")).toBeNull();
  });

  it("erreur SQL → null (PAS false)", async () => {
    const from = jest.fn().mockReturnValue(chain({ data: null, error: { message: "boom" } }));
    const svc = makeService({ from });
    expect(await svc.getMustChangePassword("u1")).toBeNull();
  });

  it("ligne clients absente → null (PAS false)", async () => {
    const from = jest.fn().mockReturnValue(chain({ data: null, error: null }));
    const svc = makeService({ from });
    expect(await svc.getMustChangePassword("u1")).toBeNull();
  });

  it("valeur colonne inattendue (null en base) → null (PAS false)", async () => {
    const from = jest.fn().mockReturnValue(chain({ data: { must_change_password: null }, error: null }));
    const svc = makeService({ from });
    expect(await svc.getMustChangePassword("u1")).toBeNull();
  });

  it("must_change_password = true → true", async () => {
    const from = jest.fn().mockReturnValue(chain({ data: { must_change_password: true }, error: null }));
    const svc = makeService({ from });
    expect(await svc.getMustChangePassword("u1")).toBe(true);
  });

  it("must_change_password = false (explicite) → false", async () => {
    const from = jest.fn().mockReturnValue(chain({ data: { must_change_password: false }, error: null }));
    const svc = makeService({ from });
    expect(await svc.getMustChangePassword("u1")).toBe(false);
  });
});
