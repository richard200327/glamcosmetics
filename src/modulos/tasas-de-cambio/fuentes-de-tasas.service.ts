import { Injectable } from '@nestjs/common';
import { LoggerDeAplicacion } from '../../comun/logger/logger-de-aplicacion';

export interface ResultadoDeFuente {
  valor: number;
  fuente: string;
}

const TIEMPO_MAXIMO_EN_MS = 10000;

export function promedioRecortado(valores: number[]): number | null {
  const validos = valores.filter((valor) => Number.isFinite(valor) && valor > 0).sort((a, b) => a - b);
  if (validos.length === 0) {
    return null;
  }
  const recorte = validos.length >= 5 ? Math.floor(validos.length * 0.2) : 0;
  const centrales = validos.slice(recorte, validos.length - recorte);
  const suma = centrales.reduce((total, valor) => total + valor, 0);
  return Math.round((suma / centrales.length) * 10000) / 10000;
}

export function leerPreciosDeBinanceP2p(cuerpo: unknown): number[] {
  const datos = (cuerpo as { data?: { adv?: { price?: string | number } }[] })?.data;
  if (!Array.isArray(datos)) {
    return [];
  }
  return datos.map((anuncio) => Number(anuncio?.adv?.price)).filter((precio) => Number.isFinite(precio) && precio > 0);
}

export function leerTasaDeDolarApi(cuerpo: unknown, fuente: 'oficial' | 'paralelo'): number | null {
  if (!Array.isArray(cuerpo)) {
    return null;
  }
  const cotizacion = (cuerpo as { moneda?: string; fuente?: string; promedio?: number }[]).find(
    (elemento) => elemento?.moneda === 'USD' && elemento?.fuente === fuente
  );
  const valor = Number(cotizacion?.promedio);
  return Number.isFinite(valor) && valor > 0 ? valor : null;
}

export function leerTasaDeCriptoYa(cuerpo: unknown): number | null {
  const datos = cuerpo as { ask?: number; totalAsk?: number; bid?: number };
  const valor = Number(datos?.ask ?? datos?.totalAsk ?? datos?.bid);
  return Number.isFinite(valor) && valor > 0 ? valor : null;
}

@Injectable()
export class FuentesDeTasasService {
  private readonly logger = new LoggerDeAplicacion('FuentesDeTasasService');

  public async obtenerTasaBcv(): Promise<ResultadoDeFuente | null> {
    try {
      const cuerpo = await this.pedirJson('https://ve.dolarapi.com/v1/dolares');
      const valor = leerTasaDeDolarApi(cuerpo, 'oficial');
      if (valor !== null) {
        return { valor, fuente: 'dolarapi (oficial BCV)' };
      }
    } catch (error) {
      this.logger.warn('No se pudo leer la tasa BCV de dolarapi', { error: String(error) });
    }
    return null;
  }

  public async obtenerTasaBinance(): Promise<ResultadoDeFuente | null> {
    try {
      const cuerpo = await this.pedirJson('https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset: 'USDT', fiat: 'VES', tradeType: 'BUY', page: 1, rows: 10, payTypes: [], publisherType: null })
      });
      const valor = promedioRecortado(leerPreciosDeBinanceP2p(cuerpo));
      if (valor !== null) {
        return { valor, fuente: 'Binance P2P (USDT/VES)' };
      }
    } catch (error) {
      this.logger.warn('No se pudo leer Binance P2P', { error: String(error) });
    }
    try {
      const cuerpo = await this.pedirJson('https://criptoya.com/api/binancep2p/USDT/VES/1');
      const valor = leerTasaDeCriptoYa(cuerpo);
      if (valor !== null) {
        return { valor, fuente: 'CriptoYa (Binance P2P)' };
      }
    } catch (error) {
      this.logger.warn('No se pudo leer CriptoYa', { error: String(error) });
    }
    try {
      const cuerpo = await this.pedirJson('https://ve.dolarapi.com/v1/dolares');
      const valor = leerTasaDeDolarApi(cuerpo, 'paralelo');
      if (valor !== null) {
        return { valor, fuente: 'dolarapi (paralelo)' };
      }
    } catch (error) {
      this.logger.warn('No se pudo leer la tasa paralela de dolarapi', { error: String(error) });
    }
    return null;
  }

  private async pedirJson(url: string, opciones: RequestInit = {}): Promise<unknown> {
    const respuesta = await fetch(url, {
      ...opciones,
      headers: { Accept: 'application/json', 'User-Agent': 'GlamCosmetics/1.0', ...(opciones.headers ?? {}) },
      signal: AbortSignal.timeout(TIEMPO_MAXIMO_EN_MS)
    });
    if (!respuesta.ok) {
      throw new Error(`${url} respondio ${respuesta.status}`);
    }
    return respuesta.json();
  }
}
