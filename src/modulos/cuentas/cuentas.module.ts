import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CuentaPorCobrarPagar, Pedido } from '../../comun/entidades';
import { CuentasService } from './cuentas.service';
import { CuentasController } from './cuentas.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CuentaPorCobrarPagar, Pedido])],
  controllers: [CuentasController],
  providers: [CuentasService],
  exports: [CuentasService]
})
export class CuentasModule {}
