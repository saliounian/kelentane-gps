import { Body, Controller, Headers, HttpException, HttpStatus, Param, ParseIntPipe, Post, UnauthorizedException } from "@nestjs/common";
import { SharesService } from "./shares.service";
import { SupabaseService } from "../supabase/supabase.service";

@Controller()
export class SharesController {
  constructor(
    private readonly shares: SharesService,
    private readonly supa: SupabaseService,
  ) {}

  /** POST /vehicles/:id/share (auth) → { token, scope }. */
  @Post("vehicles/:id/share")
  async create(@Param("id", ParseIntPipe) id: number, @Headers("authorization") auth?: string) {
    const user = await this.supa.getUserFromToken(auth);
    if (!user) throw new UnauthorizedException("Authentification requise");
    try {
      return await this.shares.create(id, user.id);
    } catch (e) {
      throw this.wrap(e);
    }
  }

  /** POST /shares/claim (auth) { token } → { ok }. */
  @Post("shares/claim")
  async claim(@Body() body: { token?: string }, @Headers("authorization") auth?: string) {
    const user = await this.supa.getUserFromToken(auth);
    if (!user) throw new UnauthorizedException("Authentification requise");
    if (!body?.token) throw new HttpException("token requis", HttpStatus.BAD_REQUEST);
    try {
      return await this.shares.claim(body.token, user.id);
    } catch (e) {
      throw this.wrap(e);
    }
  }

  private wrap(e: unknown): HttpException {
    if (e instanceof HttpException) return e;
    return new HttpException("Cœur GPS injoignable", HttpStatus.BAD_GATEWAY);
  }
}
