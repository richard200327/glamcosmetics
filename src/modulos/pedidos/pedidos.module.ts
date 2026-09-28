import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DetallePedido, Pedido, Producto } from '../../comun/entidades';
import { CuentasModule } from '../cuentas/cuentas.module';
import { TasasDeCambioModule } from '../tasas-de-cambio/tasas-de-cambio.module';
import { PromocionesModule } from '../promociones/promociones.module';
import { ProductosModule } from '../productos/productos.module';
import { PagosModule } from '../pagos/pagos.module';
import { ReservasModule } from '../reservas/reservas.module';
import { PedidosService } from './pedidos.service';
import { PedidosController } from './pedidos.controller';
import { CalculadoraDePedidoService } from './calculadora-de-pedido.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Pedido, DetallePedido, Producto]),
    CuentasModule,
    TasasDeCambioModule,
    PromocionesModule,
    ProductosModule,
    PagosModule,
    ReservasModule
  ],
  controllers: [PedidosController],
  providers: [PedidosService, CalculadoraDePedidoService],
  exports: [PedidosService]
})
export class PedidosModule {}
