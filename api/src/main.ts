import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Derrière Caddy (reverse proxy) : sans ça, Express ignore X-Forwarded-For et
  // le rate-limiting par IP (ThrottlerGuard) verrait l'IP du proxy pour tout le monde.
  app.set("trust proxy", 1);

  // Le mobile consomme cette API ; CORS ouvert (restreindre en prod via env).
  app.enableCors();
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
