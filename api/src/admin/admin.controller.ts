import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { AdminGuard } from "../auth/admin.guard";
import { CurrentUser, type AuthUser } from "../auth/current-user";
import { AdminService } from "./admin.service";

interface ResetBody {
  newPassword?: string;
}
interface BulkBody {
  imeis?: unknown;
}
interface TransferBody {
  imei?: string;
  fromUsername?: string;
  toUsername?: string;
}
interface PromoteBody {
  isAdmin?: boolean;
}
interface PurgeBody {
  confirm?: boolean;
}

/** Routes d'administration plateforme — AuthGuard (JWT) + AdminGuard (is_admin). */
@Controller("admin")
@UseGuards(AuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  /** GET /admin/devices — tous les devices + compteurs d'accès. */
  @Get("devices")
  listDevices() {
    return this.admin.listDevices();
  }

  /** POST /admin/devices/:id/reset-password — :id = traccar_id. */
  @Post("devices/:id/reset-password")
  async resetPassword(
    @Param("id", ParseIntPipe) traccarId: number,
    @Body() body: ResetBody,
    @CurrentUser() user: AuthUser,
  ): Promise<{ ok: true }> {
    const pw = body?.newPassword?.trim();
    if (!pw || pw.length < 4) {
      throw new HttpException("Mot de passe du dispositif trop court (min. 4).", HttpStatus.BAD_REQUEST);
    }
    const ok = await this.admin.adminResetPassword(traccarId, user.id, pw);
    if (!ok) throw new NotFoundException("Device introuvable pour ce traccar_id.");
    return { ok: true };
  }

  /** POST /admin/devices/bulk-enroll — { imeis: string[] } (≤ 200). */
  @Post("devices/bulk-enroll")
  bulkEnroll(@Body() body: BulkBody, @CurrentUser() user: AuthUser) {
    const imeis = AdminService.validateBulk(body?.imeis);
    return this.admin.bulkEnroll(imeis, user.id);
  }

  /** POST /admin/devices/transfer — { imei, fromUsername, toUsername }. */
  @Post("devices/transfer")
  transfer(@Body() body: TransferBody) {
    const imei = body?.imei?.replace(/\s/g, "");
    const from = body?.fromUsername?.trim();
    const to = body?.toUsername?.trim();
    if (!imei || !from || !to) {
      throw new HttpException("imei, fromUsername et toUsername requis.", HttpStatus.BAD_REQUEST);
    }
    return this.admin.transfer(imei, from, to);
  }

  /** DELETE /admin/devices/purge-test — dry run par défaut ; { confirm: true } supprime. */
  @Delete("devices/purge-test")
  purgeTest(@Body() body: PurgeBody) {
    return this.admin.purgeTest(body?.confirm === true);
  }

  /** GET /admin/clients/:username — consultation d'un compte client. */
  @Get("clients/:username")
  getClient(@Param("username") username: string) {
    return this.admin.getClient(username);
  }

  /** PATCH /admin/clients/:username/promote — { isAdmin: boolean }. */
  @Patch("clients/:username/promote")
  promote(@Param("username") username: string, @Body() body: PromoteBody, @CurrentUser() user: AuthUser) {
    if (typeof body?.isAdmin !== "boolean") {
      throw new HttpException("Body attendu : { isAdmin: boolean }", HttpStatus.BAD_REQUEST);
    }
    return this.admin.promote(username, body.isAdmin, user.id);
  }
}
