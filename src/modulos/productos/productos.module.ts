import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MovimientoDeInventario, Producto } from '../../comun/entidades';
import { ProductosService } from './productos.service';
import { ProductosController } from './productos.controller';
import { KardexService } from './kardex.service';

@Module({
  imports: [TypeOrmModule.forFeature([Producto, MovimientoDeInventario])],
  controllers: [ProductosController],
  providers: [ProductosService, KardexService],
  exports: [ProductosService, KardexService]
})
export class ProductosModule {}
