import 'reflect-metadata';
import { NestFactory, Reflector } from '@nestjs/core';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { existsSync } from 'fs';
import { join } from 'path';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const rutaDelEnv = join(__dirname, '..', '.env');
  if (existsSync(rutaDelEnv)) {
    new Logger('Configuracion').log(`Usando ${rutaDelEnv}`);
  } else {
    new Logger('Configuracion').warn(`No se encontro ${rutaDelEnv}. Crea el archivo .env (copia de .env.example); mientras tanto se usan valores por defecto.`);
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.enableCors();

  // Express genera un ETag automaticamente en cada respuesta y el navegador puede
  // reusarlo para devolver un 304 Not Modified desde su cache en vez de pedir datos
  // frescos. Para una API con datos que cambian todo el tiempo (inventario, clientes,
  // pedidos), esto puede hacer que el navegador muestre datos desactualizados o,
  // si su cache de disco quedo en un estado invalido, una respuesta vacia. Se
  // desactiva por completo: cada peticion siempre trae los datos reales del momento.
  app.getHttpAdapter().getInstance().set('etag', false);
  app.use((_req: unknown, res: { setHeader: (nombre: string, valor: string) => void }, next: () => void) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false
    })
  );

  // CRITICO: sin este interceptor global, @Exclude() en las entidades (ej: Usuario.clave)
  // no tiene ningun efecto, porque Nest devolveria las entidades de TypeORM tal cual
  // sin pasarlas por class-transformer. Con esto, el hash de la clave nunca sale en
  // ninguna respuesta JSON, sin importar en que endpoint o relacion anidada aparezca.
  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  app.setGlobalPrefix('api');

  const puerto = process.env.PORT ?? 3000;
  await app.listen(puerto);
  // eslint-disable-next-line no-console
  console.log(`Backend de Glam Cosmetics corriendo en http://localhost:${puerto}/api`);
}

bootstrap();
