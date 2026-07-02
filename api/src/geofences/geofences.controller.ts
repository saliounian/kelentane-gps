import { Body, Controller, Delete, Get, HttpException, HttpStatus, Param, ParseIntPipe, Patch, Post } from "@nestjs/common";
import { GeofencesService } from "./geofences.service";
import type { CreateGeofenceBody, GeofenceVM } from "./geofences.types";

@Controller()
export class GeofencesController {
  constructor(private readonly geofences: GeofencesService) {}

  @Get("vehicles/:id/geofences")
  async list(@Param("id", ParseIntPipe) id: number): Promise<GeofenceVM[]> {
    try {
      return await this.geofences.list(id);
    } catch (e) {
      throw this.wrap(e);
    }
  }

  @Post("vehicles/:id/geofences")
  async create(@Param("id", ParseIntPipe) id: number, @Body() body: CreateGeofenceBody): Promise<GeofenceVM> {
    if (!body?.name || (body.kind !== "circle" && body.kind !== "polygon") || !body.area) {
      throw new HttpException("name/kind/area requis", HttpStatus.BAD_REQUEST);
    }
    try {
      return await this.geofences.create(id, body);
    } catch (e) {
      throw this.wrap(e);
    }
  }

  @Patch("geofences/:gid")
  async patch(@Param("gid") gid: string, @Body() body: { enabled?: boolean; name?: string }): Promise<GeofenceVM> {
    try {
      return await this.geofences.patch(gid, body);
    } catch (e) {
      throw this.wrap(e);
    }
  }

  @Delete("geofences/:gid")
  async remove(@Param("gid") gid: string) {
    try {
      return await this.geofences.remove(gid);
    } catch (e) {
      throw this.wrap(e);
    }
  }

  private wrap(e: unknown): HttpException {
    if (e instanceof HttpException) return e;
    return new HttpException("Cœur GPS injoignable", HttpStatus.BAD_GATEWAY);
  }
}
