import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CuentaPorCobrarPagar, Pedido } from '../../comun/entidades';
import { CuentasModule } from '../cuentas/cuentas.module';
import { ReportesService } from './reportes.service';
import { ReportesController } from './reportes.controller';
import { TableroController } from './tablero.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Pedido, CuentaPorCobrarPagar]), CuentasModule],
  controllers: [ReportesController, TableroController],
  providers: [ReportesService]
})
export class ReportesModule {}
