import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CuentaPorCobrarPagar, Proveedor } from '../../comun/entidades';
import { ProveedoresService } from './proveedores.service';
import { ProveedoresController } from './proveedores.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Proveedor, CuentaPorCobrarPagar])],
  controllers: [ProveedoresController],
  providers: [ProveedoresService],
  exports: [ProveedoresService]
})
export class ProveedoresModule {}
