import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Derrière Caddy (reverse proxy) : sans ça, Express ignore X-Forwarded-For et
  // le rate-limiting par IP (ThrottlerGuard) verrait l'IP du proxy pour tout le monde.
  app.set("trust proxy", 1);

  // CORS_ORIGINS (liste séparée par virgules) restreint les origines web si définie ;
  // les requêtes SANS en-tête Origin (apps mobiles natives) restent toujours admises.
  // Absente → comportement historique inchangé (ouvert).
  const corsOrigins = (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  if (corsOrigins.length > 0) {
    app.enableCors({
      origin: (origin, callback) => {
        if (!origin || corsOrigins.includes(origin)) return callback(null, true);
        callback(new Error("Origin non autorisée"), false);
      },
    });
  } else {
    app.enableCors();
  }
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
