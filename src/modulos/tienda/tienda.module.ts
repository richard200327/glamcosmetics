import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Categoria, ConfiguracionDeTienda, DetallePedidoWeb, FamiliaDeColor, ImagenDeCatalogo, Marca, PedidoWeb, ProductoDeCatalogo } from '../../comun/entidades';
import { ProductosModule } from '../productos/productos.module';
import { PedidosModule } from '../pedidos/pedidos.module';
import { ReservasModule } from '../reservas/reservas.module';
import { TiendaService } from './tienda.service';
import { ProductosDeCatalogoService } from './productos-de-catalogo.service';
import { CatalogoPublicoService } from './catalogo-publico.service';
import { PedidosWebService } from './pedidos-web.service';
import { TiendaController } from './tienda.controller';
import { CatalogoPublicoController } from './catalogo-publico.controller';
import { LimitadorDePedidosGuard } from './limitador.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Marca, Categoria, FamiliaDeColor, ProductoDeCatalogo, ImagenDeCatalogo, ConfiguracionDeTienda, PedidoWeb, DetallePedidoWeb]),
    ProductosModule,
    PedidosModule,
    ReservasModule
  ],
  controllers: [TiendaController, CatalogoPublicoController],
  providers: [TiendaService, ProductosDeCatalogoService, CatalogoPublicoService, PedidosWebService, LimitadorDePedidosGuard]
})
export class TiendaModule {}
