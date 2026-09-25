import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DetallePago, RegistroPago } from '../../comun/entidades';
import { CuentasModule } from '../cuentas/cuentas.module';
import { TasasDeCambioModule } from '../tasas-de-cambio/tasas-de-cambio.module';
import { PagosService } from './pagos.service';
import { PagosController } from './pagos.controller';

@Module({
  imports: [TypeOrmModule.forFeature([RegistroPago, DetallePago]), CuentasModule, TasasDeCambioModule],
  controllers: [PagosController],
  providers: [PagosService],
  exports: [PagosService]
})
export class PagosModule {}
