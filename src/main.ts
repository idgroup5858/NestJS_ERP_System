import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Chrome ommaviy manzildagi sahifadan localhost ga so'rovni faqat shu sarlavha bilan o'tkazadi.
  // `enableCors` preflight javobini o'zi yakunlaydi, shuning uchun bu undan oldin turishi shart.
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.headers['access-control-request-private-network']) {
      res.setHeader('Access-Control-Allow-Private-Network', 'true');
    }
    next();
  });
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: false,
      forbidNonWhitelisted: true,
    }),
  );



  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
