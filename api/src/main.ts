import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Le mobile consomme cette API ; CORS ouvert (restreindre en prod via env).
  app.enableCors();
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
