import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Compra, CuentaPorCobrarPagar, DetalleCompra, Producto, Proveedor } from '../../comun/entidades';
import { ProductosModule } from '../productos/productos.module';
import { CuentasModule } from '../cuentas/cuentas.module';
import { PagosModule } from '../pagos/pagos.module';
import { TasasDeCambioModule } from '../tasas-de-cambio/tasas-de-cambio.module';
import { ComprasService } from './compras.service';
import { ComprasController } from './compras.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Compra, DetalleCompra, Producto, Proveedor, CuentaPorCobrarPagar]),
    ProductosModule,
    CuentasModule,
    PagosModule,
    TasasDeCambioModule
  ],
  controllers: [ComprasController],
  providers: [ComprasService]
})
export class ComprasModule {}
