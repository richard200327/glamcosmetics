import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TasaDeCambio } from '../../comun/entidades';
import { TasasDeCambioService } from './tasas-de-cambio.service';
import { TasasDeCambioController } from './tasas-de-cambio.controller';
import { DolarApiClienteService } from './dolar-api-cliente.service';
import { FuentesDeTasasService } from './fuentes-de-tasas.service';
import { ActualizadorDeTasasService } from './actualizador-de-tasas.service';

@Module({
  imports: [TypeOrmModule.forFeature([TasaDeCambio])],
  controllers: [TasasDeCambioController],
  providers: [TasasDeCambioService, DolarApiClienteService, FuentesDeTasasService, ActualizadorDeTasasService],
  exports: [TasasDeCambioService]
})
export class TasasDeCambioModule {}
