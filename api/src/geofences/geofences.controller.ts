import { Body, Controller, Delete, Get, HttpException, HttpStatus, Param, ParseIntPipe, Patch, Post, UseGuards } from "@nestjs/common";
import { GeofencesService } from "./geofences.service";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser, type AuthUser } from "../auth/current-user";
import type { CreateGeofenceBody, GeofenceVM } from "./geofences.types";

@Controller()
@UseGuards(AuthGuard)
export class GeofencesController {
  constructor(private readonly geofences: GeofencesService) {}

  @Get("vehicles/:id/geofences")
  async list(@Param("id", ParseIntPipe) id: number, @CurrentUser() user: AuthUser): Promise<GeofenceVM[]> {
    try {
      return await this.geofences.list(id, user.id);
    } catch (e) {
      throw this.wrap(e);
    }
  }

  @Post("vehicles/:id/geofences")
  async create(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: CreateGeofenceBody,
    @CurrentUser() user: AuthUser,
  ): Promise<GeofenceVM> {
    if (!body?.name || (body.kind !== "circle" && body.kind !== "polygon") || !body.area) {
      throw new HttpException("name/kind/area requis", HttpStatus.BAD_REQUEST);
    }
    try {
      return await this.geofences.create(id, body, user.id);
    } catch (e) {
      throw this.wrap(e);
    }
  }

  @Patch("geofences/:gid")
  async patch(
    @Param("gid") gid: string,
    @Body() body: { enabled?: boolean; name?: string },
    @CurrentUser() user: AuthUser,
  ): Promise<GeofenceVM> {
    try {
      return await this.geofences.patch(gid, body, user.id);
    } catch (e) {
      throw this.wrap(e);
    }
  }

  @Delete("geofences/:gid")
  async remove(@Param("gid") gid: string, @CurrentUser() user: AuthUser) {
    try {
      return await this.geofences.remove(gid, user.id);
    } catch (e) {
      throw this.wrap(e);
    }
  }

  private wrap(e: unknown): HttpException {
    if (e instanceof HttpException) return e;
    return new HttpException("Cœur GPS injoignable", HttpStatus.BAD_GATEWAY);
  }
}
