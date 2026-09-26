import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MetodoPago } from '../../comun/entidades';
import { MetodosPagoService } from './metodos-pago.service';
import { MetodosPagoController } from './metodos-pago.controller';

@Module({
  imports: [TypeOrmModule.forFeature([MetodoPago])],
  controllers: [MetodosPagoController],
  providers: [MetodosPagoService],
  exports: [MetodosPagoService]
})
export class MetodosPagoModule {}
