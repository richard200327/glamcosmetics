import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TasaDeCambio } from '../../comun/entidades';
import { TasasDeCambioService } from './tasas-de-cambio.service';
import { TasasDeCambioController } from './tasas-de-cambio.controller';
import { DolarApiClienteService } from './dolar-api-cliente.service';

@Module({
  imports: [TypeOrmModule.forFeature([TasaDeCambio])],
  controllers: [TasasDeCambioController],
  providers: [TasasDeCambioService, DolarApiClienteService],
  exports: [TasasDeCambioService]
})
export class TasasDeCambioModule {}
