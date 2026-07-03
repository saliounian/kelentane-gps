import { Controller, Get, HttpException, HttpStatus, Param, ParseIntPipe, Query, UseGuards } from "@nestjs/common";
import { ReportsService } from "./reports.service";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser, type AuthUser } from "../auth/current-user";
import type { KmReport, RoutePoint, StatsReport } from "./reports.types";

@Controller("vehicles")
@UseGuards(AuthGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get(":id/km")
  async km(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
    @Query("range") range?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ): Promise<KmReport> {
    try {
      return await this.reports.km(id, this.reports.resolveRange(range, from, to), user.id);
    } catch (e) {
      throw this.wrap(e);
    }
  }

  @Get(":id/stats")
  async stats(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
    @Query("range") range?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ): Promise<StatsReport> {
    try {
      return await this.reports.stats(id, this.reports.resolveRange(range, from, to), user.id);
    } catch (e) {
      throw this.wrap(e);
    }
  }

  @Get(":id/route")
  async route(
    @Param("id", ParseIntPipe) id: number,
    @CurrentUser() user: AuthUser,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ): Promise<RoutePoint[]> {
    const day = from && to ? { from, to } : this.today();
    try {
      return await this.reports.route(id, day.from, day.to, user.id);
    } catch (e) {
      throw this.wrap(e);
    }
  }

  private today(): { from: string; to: string } {
    const s = new Date();
    s.setHours(0, 0, 0, 0);
    return { from: s.toISOString(), to: new Date().toISOString() };
  }

  private wrap(e: unknown): HttpException {
    if (e instanceof HttpException) return e;
    return new HttpException("Cœur GPS injoignable", HttpStatus.BAD_GATEWAY);
  }
}
