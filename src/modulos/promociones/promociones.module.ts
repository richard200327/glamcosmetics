import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Promocion, PromocionProducto, ReglaCantidad, ReglaMontoPedido, ReglaPrecioEspecial } from '../../comun/entidades/promocion.entity';
import { PromocionesService } from './promociones.service';
import { PromocionesController } from './promociones.controller';
import { MotorDePromocionesService } from './motor-de-promociones.service';

@Module({
  imports: [TypeOrmModule.forFeature([Promocion, PromocionProducto, ReglaCantidad, ReglaPrecioEspecial, ReglaMontoPedido])],
  controllers: [PromocionesController],
  providers: [PromocionesService, MotorDePromocionesService],
  exports: [PromocionesService, MotorDePromocionesService]
})
export class PromocionesModule {}
