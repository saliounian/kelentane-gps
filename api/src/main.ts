import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { corsOrigin, parseCorsOrigins } from "./cors-origin";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Derrière Caddy (reverse proxy) : sans ça, Express ignore X-Forwarded-For et
  // le rate-limiting par IP (ThrottlerGuard) verrait l'IP du proxy pour tout le monde.
  app.set("trust proxy", 1);

  // CORS : voir cors-origin.ts (liste CORS_ORIGINS si définie, Origin absent admis,
  // origine refusée → aucun en-tête CORS, pas d'erreur 500). Absente → ouvert.
  if (parseCorsOrigins().length > 0) {
    app.enableCors({ origin: corsOrigin });
  } else {
    app.enableCors();
  }
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
