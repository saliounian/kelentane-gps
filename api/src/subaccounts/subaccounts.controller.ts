import { Body, Controller, Delete, Get, HttpException, HttpStatus, Param, Post, UseGuards } from "@nestjs/common";
import { SubaccountsService, type SubRole } from "./subaccounts.service";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser, type AuthUser } from "../auth/current-user";

interface CreateBody {
  name?: string;
  username?: string;
  password?: string;
}
interface GrantBody {
  imei?: string;
  role?: SubRole;
}

/**
 * §4 — Gestion des sous-comptes (endpoints backend PARTAGÉS). L'UI de gestion vit
 * UNIQUEMENT sur le web ; le mobile n'expose aucun écran de gestion d'équipe.
 * Toutes les routes exigent un compte PRINCIPAL (vérifié dans le service).
 */
@Controller("subaccounts")
@UseGuards(AuthGuard)
export class SubaccountsController {
  constructor(private readonly subs: SubaccountsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.subs.list(user.id);
  }

  @Post()
  create(@Body() body: CreateBody, @CurrentUser() user: AuthUser) {
    const name = body?.name?.trim();
    const username = body?.username?.trim();
    const password = body?.password ?? "";
    if (!name || !username || password.length < 4) {
      throw new HttpException("Nom, identifiant et mot de passe (≥ 4) requis.", HttpStatus.BAD_REQUEST);
    }
    return this.subs.create(user.id, name, username, password);
  }

  @Post(":id/access")
  grant(@Param("id") id: string, @Body() body: GrantBody, @CurrentUser() user: AuthUser) {
    if (!body?.imei || (body.role !== "consultation" && body.role !== "action")) {
      throw new HttpException("IMEI et rôle (consultation|action) requis.", HttpStatus.BAD_REQUEST);
    }
    return this.subs.grant(user.id, id, body.imei.replace(/\s/g, ""), body.role);
  }

  @Delete(":id/access/:imei")
  revoke(@Param("id") id: string, @Param("imei") imei: string, @CurrentUser() user: AuthUser) {
    return this.subs.revoke(user.id, id, imei.replace(/\s/g, "")).then(() => ({ revoked: true }));
  }

  @Delete(":id")
  remove(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.subs.remove(user.id, id).then(() => ({ deleted: true }));
  }
}
