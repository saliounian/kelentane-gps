import { Body, Controller, Get, HttpException, HttpStatus, Patch, Post, UseGuards } from "@nestjs/common";
import { NotificationsService, type NotificationPrefs } from "./notifications.service";
import { PushService } from "./push.service";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser, type AuthUser } from "../auth/current-user";

interface PrefsBody {
  armed?: boolean;
  types?: Record<string, boolean>;
}
interface RegisterBody {
  token?: string;
  platform?: string;
}

@Controller()
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(
    private readonly notifs: NotificationsService,
    private readonly push: PushService,
  ) {}

  @Get("notification-prefs")
  getPrefs(@CurrentUser() user: AuthUser): Promise<NotificationPrefs> {
    return this.notifs.getPrefs(user.id);
  }

  @Patch("notification-prefs")
  patchPrefs(@Body() body: PrefsBody, @CurrentUser() user: AuthUser): Promise<NotificationPrefs> {
    return this.notifs.patchPrefs(user.id, body);
  }

  /** POST /push/register → stocke le jeton du compte. */
  @Post("push/register")
  register(@Body() body: RegisterBody, @CurrentUser() user: AuthUser) {
    const platform = body.platform ?? "";
    if (!body.token || !["ios", "android", "web"].includes(platform)) {
      throw new HttpException("token/platform requis", HttpStatus.BAD_REQUEST);
    }
    return this.notifs.registerToken(user.id, body.token, platform);
  }

  /** POST /push/test → s'envoie une notif de test (no-op si PUSH_ENABLED != true). */
  @Post("push/test")
  test(@CurrentUser() user: AuthUser) {
    return this.push.sendToUser(user.id, {
      title: "Kelentane GPS",
      body: "Notification de test ✅",
      data: { kind: "test" },
    });
  }
}

