import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { TasaDeCambio } from '../../comun/entidades';
import { DolarApiClienteService } from './dolar-api-cliente.service';
import { LoggerDeAplicacion } from '../../comun/logger/logger-de-aplicacion';
import { obtenerFechaLocalDeHoy } from '../../comun/utilidades/fechas';

@Injectable()
export class TasasDeCambioService {
  private readonly logger = new LoggerDeAplicacion('TasasDeCambioService');

  constructor(
    @InjectRepository(TasaDeCambio)
    private readonly repositorioDeTasas: Repository<TasaDeCambio>,
    private readonly dolarApiClienteService: DolarApiClienteService
  ) {}

  public async obtenerListaDeTasas(): Promise<TasaDeCambio[]> {
    return this.repositorioDeTasas.find({ order: { fecha: 'DESC' }, take: 365 });
  }

  // Tasa vigente para una fecha dada: la ultima registrada en o antes de esa fecha.
  // Se usa para tomar el "snapshot" que se guarda en Pedido y en RegistroPago.
  public async obtenerTasaVigenteParaFecha(fecha: string): Promise<TasaDeCambio> {
    const tasa = await this.repositorioDeTasas.findOne({
      where: { fecha: LessThanOrEqual(fecha) },
      order: { fecha: 'DESC' }
    });

    if (tasa === null) {
      throw new NotFoundException('No hay ninguna tasa de cambio registrada para esa fecha o antes.');
    }

    return tasa;
  }

  public async registrarOActualizarTasaDelDia(datos: {
    fecha: string;
    valorTasaBcv: number;
    valorTasaBinance: number;
  }): Promise<TasaDeCambio> {
    let tasa = await this.repositorioDeTasas.findOne({ where: { fecha: datos.fecha } });

    if (tasa === null) {
      tasa = this.repositorioDeTasas.create(datos);
    } else {
      tasa.valorTasaBcv = datos.valorTasaBcv;
      tasa.valorTasaBinance = datos.valorTasaBinance;
    }

    return this.repositorioDeTasas.save(tasa);
  }

  // Sincroniza la tasa del dia consultando dolarapi.com: 'oficial' (BCV) y 'paralelo'
  // (el equivalente que este sistema llama "Binance", segun la convencion usual en
  // Venezuela de aproximar la tasa Binance P2P con la tasa paralelo). Si dolarapi.com
  // no responde, se lanza un error claro y NO se toca la tasa ya registrada (para no
  // dejar el sistema con datos a medias).
  public async sincronizarTasaDelDiaDesdeDolarApi(): Promise<TasaDeCambio> {
    const cotizaciones = await this.dolarApiClienteService.obtenerCotizacionesDeVenezuela();

    const cotizacionOficial = cotizaciones.find((c) => c.moneda === 'USD' && c.fuente === 'oficial');
    const cotizacionParalelo = cotizaciones.find((c) => c.moneda === 'USD' && c.fuente === 'paralelo');

    if (cotizacionOficial === undefined || cotizacionParalelo === undefined) {
      throw new NotFoundException(
        'dolarapi.com no devolvio las cotizaciones "oficial" y "paralelo" de USD esperadas. Registra la tasa manualmente por ahora.'
      );
    }

    const fechaDeHoy = obtenerFechaLocalDeHoy();

    const tasaSincronizada = await this.registrarOActualizarTasaDelDia({
      fecha: fechaDeHoy,
      valorTasaBcv: cotizacionOficial.promedio,
      valorTasaBinance: cotizacionParalelo.promedio
    });

    this.logger.log('Tasa de cambio sincronizada desde dolarapi.com', {
      fecha: fechaDeHoy,
      valorTasaBcv: tasaSincronizada.valorTasaBcv,
      valorTasaBinance: tasaSincronizada.valorTasaBinance
    });

    return tasaSincronizada;
  }
}
