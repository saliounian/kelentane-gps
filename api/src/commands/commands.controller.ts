import { Body, Controller, Get, HttpException, HttpStatus, Param, ParseIntPipe, Post } from "@nestjs/common";
import { CommandsService, type CommandType } from "./commands.service";

const ALLOWED: CommandType[] = ["engineStop", "engineResume", "gpsReboot"];

interface CommandBody {
  type?: string;
  password?: string;
}

@Controller()
export class CommandsController {
  constructor(private readonly commands: CommandsService) {}

  /** POST /vehicles/:id/commands → { ackId, state }. */
  @Post("vehicles/:id/commands")
  async send(@Param("id", ParseIntPipe) id: number, @Body() body: CommandBody) {
    const type = body.type as CommandType;
    if (!type || !ALLOWED.includes(type)) {
      throw new HttpException("Type de commande invalide", HttpStatus.BAD_REQUEST);
    }
    return this.commands.dispatch(id, type, body.password);
  }

  /** GET /commands/:ackId → { state }. */
  @Get("commands/:ackId")
  status(@Param("ackId") ackId: string) {
    const s = this.commands.status(ackId);
    if (!s) throw new HttpException("ACK introuvable", HttpStatus.NOT_FOUND);
    return s;
  }
}
