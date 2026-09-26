import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { RegistroDeAuditoria } from '../../comun/entidades';
import { AuditoriaService } from './auditoria.service';
import { AuditoriaController } from './auditoria.controller';
import { AuditoriaInterceptor } from './auditoria.interceptor';

@Module({
  imports: [TypeOrmModule.forFeature([RegistroDeAuditoria])],
  controllers: [AuditoriaController],
  providers: [
    AuditoriaService,
    // Interceptor GLOBAL: se registra aqui (no en main.ts) para poder inyectarle
    // AuditoriaService via el sistema de DI de Nest.
    { provide: APP_INTERCEPTOR, useClass: AuditoriaInterceptor }
  ],
  exports: [AuditoriaService]
})
export class AuditoriaModule {}
