import { Body, Controller, Get, HttpException, HttpStatus, Patch, Post } from "@nestjs/common";
import { NotificationsService, type NotificationPrefs } from "./notifications.service";

interface PrefsBody {
  armed?: boolean;
  types?: Record<string, boolean>;
}
interface RegisterBody {
  token?: string;
  platform?: string;
}

@Controller()
export class NotificationsController {
  constructor(private readonly notifs: NotificationsService) {}

  @Get("notification-prefs")
  getPrefs(): Promise<NotificationPrefs> {
    return this.notifs.getPrefs();
  }

  @Patch("notification-prefs")
  patchPrefs(@Body() body: PrefsBody): Promise<NotificationPrefs> {
    return this.notifs.patchPrefs(body);
  }

  /** POST /push/register → stocke le jeton (envoi réel différé, credentials requis). */
  @Post("push/register")
  register(@Body() body: RegisterBody) {
    const platform = body.platform ?? "";
    if (!body.token || !["ios", "android", "web"].includes(platform)) {
      throw new HttpException("token/platform requis", HttpStatus.BAD_REQUEST);
    }
    return this.notifs.registerToken(body.token, platform);
  }
}
