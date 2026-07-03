import { Body, Controller, Get, Headers, HttpException, HttpStatus, Param, ParseIntPipe, Post, UnauthorizedException } from "@nestjs/common";
import { CommandsService, type CommandType } from "./commands.service";
import { SupabaseService } from "../supabase/supabase.service";

const ALLOWED: CommandType[] = ["engineStop", "engineResume", "gpsReboot"];

interface CommandBody {
  type?: string;
  password?: string;
}

@Controller()
export class CommandsController {
  constructor(
    private readonly commands: CommandsService,
    private readonly supa: SupabaseService,
  ) {}

  /** POST /vehicles/:id/commands (auth requise) → { ackId, state }. */
  @Post("vehicles/:id/commands")
  async send(
    @Param("id", ParseIntPipe) id: number,
    @Body() body: CommandBody,
    @Headers("authorization") auth?: string,
  ) {
    const user = await this.supa.getUserFromToken(auth);
    if (!user) throw new UnauthorizedException("Authentification requise");

    const type = body.type as CommandType;
    if (!type || !ALLOWED.includes(type)) {
      throw new HttpException("Type de commande invalide", HttpStatus.BAD_REQUEST);
    }
    return this.commands.dispatch(id, type, { userId: user.id, email: user.email, password: body.password });
  }

  /** GET /commands/:ackId → { state }. */
  @Get("commands/:ackId")
  status(@Param("ackId") ackId: string) {
    const s = this.commands.status(ackId);
    if (!s) throw new HttpException("ACK introuvable", HttpStatus.NOT_FOUND);
    return s;
  }
}
