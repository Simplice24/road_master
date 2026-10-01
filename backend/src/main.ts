import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import type { ServerResponse } from 'http';
import { AppModule } from './app.module';
import { UPLOADS_ROOT } from './question/question-image.storage';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // Uploaded question/option images (public, like any exam content). Served by express before
  // Nest's guards run; file names are random UUIDs and only signature-checked images are stored.
  app.useStaticAssets(UPLOADS_ROOT, {
    prefix: '/uploads/',
    maxAge: '7d',
    setHeaders: (res: ServerResponse) =>
      res.setHeader('X-Content-Type-Options', 'nosniff'),
  });
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
