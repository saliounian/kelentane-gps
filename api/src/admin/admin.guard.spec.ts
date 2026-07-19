import { ForbiddenException } from "@nestjs/common";
import type { ExecutionContext } from "@nestjs/common";
import { AdminGuard } from "../auth/admin.guard";
import type { SupabaseService } from "../supabase/supabase.service";

function ctxWithUser(uid?: string): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user: uid ? { id: uid } : undefined }) }),
  } as unknown as ExecutionContext;
}

function supaWith(isAdmin: boolean | null): SupabaseService {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  Object.assign(chain, {
    select: self,
    eq: self,
    maybeSingle: async () => ({ data: isAdmin === null ? null : { is_admin: isAdmin } }),
  });
  return { client: { from: () => chain } } as unknown as SupabaseService;
}

describe("AdminGuard", () => {
  it("laisse passer un admin", async () => {
    const guard = new AdminGuard(supaWith(true));
    expect(await guard.canActivate(ctxWithUser("u1"))).toBe(true);
  });

  it("bloque un non-admin (403)", async () => {
    const guard = new AdminGuard(supaWith(false));
    await expect(guard.canActivate(ctxWithUser("u1"))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("bloque si le compte est introuvable (403)", async () => {
    const guard = new AdminGuard(supaWith(null));
    await expect(guard.canActivate(ctxWithUser("u1"))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("bloque si aucun utilisateur résolu (403)", async () => {
    const guard = new AdminGuard(supaWith(true));
    await expect(guard.canActivate(ctxWithUser(undefined))).rejects.toBeInstanceOf(ForbiddenException);
  });
});
