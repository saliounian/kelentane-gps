import { Controller, Get, HttpException, HttpStatus, Param, ParseIntPipe, Query } from "@nestjs/common";
import { ReportsService } from "./reports.service";
import type { KmReport, RoutePoint, StatsReport } from "./reports.types";

@Controller("vehicles")
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  /** GET /vehicles/:id/km?range=7d|30d|custom&from&to */
  @Get(":id/km")
  async km(
    @Param("id", ParseIntPipe) id: number,
    @Query("range") range?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ): Promise<KmReport> {
    try {
      return await this.reports.km(id, this.reports.resolveRange(range, from, to));
    } catch (e) {
      throw this.wrap(e);
    }
  }

  /** GET /vehicles/:id/stats?range=7d|30d|custom&from&to */
  @Get(":id/stats")
  async stats(
    @Param("id", ParseIntPipe) id: number,
    @Query("range") range?: string,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ): Promise<StatsReport> {
    try {
      return await this.reports.stats(id, this.reports.resolveRange(range, from, to));
    } catch (e) {
      throw this.wrap(e);
    }
  }

  /** GET /vehicles/:id/route?from&to (défaut : aujourd'hui). */
  @Get(":id/route")
  async route(
    @Param("id", ParseIntPipe) id: number,
    @Query("from") from?: string,
    @Query("to") to?: string,
  ): Promise<RoutePoint[]> {
    const r = this.reports.resolveRange(from && to ? "custom" : "7d", from, to);
    const day = from && to ? { from, to } : this.today();
    try {
      return await this.reports.route(id, day.from, day.to);
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
