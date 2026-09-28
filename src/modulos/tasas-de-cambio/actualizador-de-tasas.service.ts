import { Injectable, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { TasaDeCambio } from '../../comun/entidades';
import { LoggerDeAplicacion } from '../../comun/logger/logger-de-aplicacion';
import { obtenerFechaLocalDeHoy } from '../../comun/utilidades/fechas';
import { FuentesDeTasasService } from './fuentes-de-tasas.service';

export interface EstadoDelActualizador {
  activo: boolean;
  intervaloEnHoras: number;
  ultimaEjecucion: string | null;
  proximaEjecucion: string | null;
  ultimoResultado: string | null;
}

export function esFinDeSemana(fecha: string): boolean {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const diaDeLaSemana = new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay();
  return diaDeLaSemana === 0 || diaDeLaSemana === 6;
}

@Injectable()
export class ActualizadorDeTasasService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new LoggerDeAplicacion('ActualizadorDeTasasService');
  private temporizador: ReturnType<typeof setInterval> | null = null;
  private primeraEjecucion: ReturnType<typeof setTimeout> | null = null;
  private ejecutando = false;
  private readonly estado: EstadoDelActualizador;

  constructor(
    @InjectRepository(TasaDeCambio)
    private readonly repositorioDeTasas: Repository<TasaDeCambio>,
    private readonly fuentesDeTasasService: FuentesDeTasasService,
    configService: ConfigService
  ) {
    const activo = (configService.get<string>('TASAS_AUTOMATICAS') ?? 'true').trim().toLowerCase() !== 'false';
    const horas = Number(configService.get<string>('TASAS_INTERVALO_HORAS') ?? 4);
    this.estado = {
      activo,
      intervaloEnHoras: Number.isFinite(horas) && horas >= 0.25 ? horas : 4,
      ultimaEjecucion: null,
      proximaEjecucion: null,
      ultimoResultado: null
    };
  }

  public onApplicationBootstrap(): void {
    if (!this.estado.activo || process.env.NODE_ENV === 'test') {
      return;
    }
    const intervalo = this.estado.intervaloEnHoras * 60 * 60 * 1000;
    this.primeraEjecucion = setTimeout(() => void this.ejecutar(), 15000);
    this.temporizador = setInterval(() => void this.ejecutar(), intervalo);
    this.estado.proximaEjecucion = new Date(Date.now() + 15000).toISOString();
    this.logger.log('Actualizacion automatica de tasas activada', { cadaHoras: this.estado.intervaloEnHoras });
  }

  public onModuleDestroy(): void {
    if (this.temporizador !== null) {
      clearInterval(this.temporizador);
    }
    if (this.primeraEjecucion !== null) {
      clearTimeout(this.primeraEjecucion);
    }
  }

  public obtenerEstado(): EstadoDelActualizador {
    return { ...this.estado };
  }

  public async ejecutar(): Promise<string> {
    if (this.ejecutando) {
      return 'Ya hay una actualizacion en curso.';
    }
    this.ejecutando = true;
    try {
      const resultado = await this.actualizarTasaDeHoy();
      this.estado.ultimoResultado = resultado;
      this.logger.log('Tasas automaticas', { resultado });
      return resultado;
    } catch (error) {
      const mensaje = `Error al actualizar: ${error instanceof Error ? error.message : String(error)}`;
      this.estado.ultimoResultado = mensaje;
      this.logger.error('Tasas automaticas', error);
      return mensaje;
    } finally {
      this.ejecutando = false;
      this.estado.ultimaEjecucion = new Date().toISOString();
      this.estado.proximaEjecucion = this.estado.activo ? new Date(Date.now() + this.estado.intervaloEnHoras * 3600000).toISOString() : null;
    }
  }

  private async actualizarTasaDeHoy(): Promise<string> {
    const fecha = obtenerFechaLocalDeHoy();
    const deHoy = await this.repositorioDeTasas.findOne({ where: { fecha } });
    const binance = await this.fuentesDeTasasService.obtenerTasaBinance();

    if (deHoy !== null) {
      if (binance === null) {
        return `La tasa de ${fecha} ya existe. No se pudo consultar Binance; se mantiene ${deHoy.valorTasaBinance}.`;
      }
      if (Math.abs(binance.valor - deHoy.valorTasaBinance) < 0.0001) {
        return `La tasa de ${fecha} ya existe y Binance no cambio (${binance.valor}).`;
      }
      await this.repositorioDeTasas.update({ idTasa: deHoy.idTasa }, { valorTasaBinance: binance.valor });
      return `La tasa de ${fecha} ya existe: BCV se mantiene en ${deHoy.valorTasaBcv}; Binance paso de ${deHoy.valorTasaBinance} a ${binance.valor} (${binance.fuente}).`;
    }

    const anterior = await this.repositorioDeTasas.findOne({ where: { fecha: LessThan(fecha) }, order: { fecha: 'DESC' } });
    let valorBcv: number | null = null;
    let origenBcv = '';
    if (esFinDeSemana(fecha) && anterior !== null) {
      valorBcv = anterior.valorTasaBcv;
      origenBcv = 'fin de semana: se mantiene la ultima tasa BCV';
    } else {
      const bcv = await this.fuentesDeTasasService.obtenerTasaBcv();
      if (bcv !== null) {
        valorBcv = bcv.valor;
        origenBcv = bcv.fuente;
      } else if (anterior !== null) {
        valorBcv = anterior.valorTasaBcv;
        origenBcv = 'sin respuesta del BCV: se mantiene la ultima tasa';
      }
    }

    const valorBinance = binance?.valor ?? anterior?.valorTasaBinance ?? null;
    if (valorBcv === null || valorBinance === null) {
      return `No se pudo registrar la tasa de ${fecha}: no hay datos de las fuentes ni tasas anteriores.`;
    }

    await this.repositorioDeTasas.save(this.repositorioDeTasas.create({ fecha, valorTasaBcv: valorBcv, valorTasaBinance: valorBinance }));
    return `Tasa de ${fecha} registrada: BCV ${valorBcv} (${origenBcv}); Binance ${valorBinance} (${binance?.fuente ?? 'se mantiene la ultima'}).`;
  }
}
