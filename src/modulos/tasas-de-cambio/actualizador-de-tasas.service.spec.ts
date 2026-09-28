import { ActualizadorDeTasasService, esFinDeSemana } from './actualizador-de-tasas.service';
import { leerPreciosDeBinanceP2p, leerTasaDeCriptoYa, leerTasaDeDolarApi, promedioRecortado } from './fuentes-de-tasas.service';
import * as fechas from '../../comun/utilidades/fechas';

interface FilaDeTasa {
  idTasa: number;
  fecha: string;
  valorTasaBcv: number;
  valorTasaBinance: number;
}

function crearActualizador(filas: FilaDeTasa[], bcv: number | null, binance: number | null) {
  const repositorio = {
    findOne: jest.fn(async ({ where }: { where: { fecha: unknown } }) => {
      if (typeof where.fecha === 'string') {
        return filas.find((fila) => fila.fecha === where.fecha) ?? null;
      }
      const ordenadas = [...filas].sort((a, b) => b.fecha.localeCompare(a.fecha));
      return ordenadas.find((fila) => fila.fecha < fechas.obtenerFechaLocalDeHoy()) ?? null;
    }),
    update: jest.fn(async ({ idTasa }: { idTasa: number }, cambios: Partial<FilaDeTasa>) => {
      Object.assign(filas.find((fila) => fila.idTasa === idTasa) as FilaDeTasa, cambios);
    }),
    create: jest.fn((datos: Omit<FilaDeTasa, 'idTasa'>) => ({ idTasa: filas.length + 1, ...datos })),
    save: jest.fn(async (fila: FilaDeTasa) => {
      filas.push(fila);
      return fila;
    })
  };
  const fuentes = {
    obtenerTasaBcv: jest.fn(async () => (bcv === null ? null : { valor: bcv, fuente: 'prueba' })),
    obtenerTasaBinance: jest.fn(async () => (binance === null ? null : { valor: binance, fuente: 'prueba' }))
  };
  const configuracion = { get: () => undefined };
  const servicio = new ActualizadorDeTasasService(repositorio as never, fuentes as never, configuracion as never);
  return { servicio, repositorio, fuentes, filas };
}

describe('lectura de fuentes de tasas', () => {
  it('promedia los anuncios de Binance P2P quitando extremos', () => {
    const precios = leerPreciosDeBinanceP2p({ data: [10, 50, 51, 52, 53, 200].map((precio) => ({ adv: { price: String(precio) } })) });
    expect(precios).toEqual([10, 50, 51, 52, 53, 200]);
    expect(promedioRecortado(precios)).toBe(51.5);
    expect(leerPreciosDeBinanceP2p({ code: 'error' })).toEqual([]);
  });

  it('lee la tasa oficial y paralela de dolarapi y la de CriptoYa', () => {
    const cuerpo = [
      { moneda: 'USD', fuente: 'oficial', promedio: 185.4 },
      { moneda: 'USD', fuente: 'paralelo', promedio: 210.1 }
    ];
    expect(leerTasaDeDolarApi(cuerpo, 'oficial')).toBe(185.4);
    expect(leerTasaDeDolarApi(cuerpo, 'paralelo')).toBe(210.1);
    expect(leerTasaDeDolarApi({}, 'oficial')).toBeNull();
    expect(leerTasaDeCriptoYa({ ask: 212.3 })).toBe(212.3);
  });

  it('reconoce los fines de semana', () => {
    expect(esFinDeSemana('2026-09-26')).toBe(true);
    expect(esFinDeSemana('2026-09-27')).toBe(true);
    expect(esFinDeSemana('2026-09-28')).toBe(false);
  });
});

describe('ActualizadorDeTasasService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('registra la tasa del dia en un dia habil con BCV y Binance', async () => {
    jest.spyOn(fechas, 'obtenerFechaLocalDeHoy').mockReturnValue('2026-09-28');
    const { servicio, filas } = crearActualizador([{ idTasa: 1, fecha: '2026-09-25', valorTasaBcv: 180, valorTasaBinance: 205 }], 185, 211);
    await servicio.ejecutar();
    expect(filas.find((fila) => fila.fecha === '2026-09-28')).toMatchObject({ valorTasaBcv: 185, valorTasaBinance: 211 });
  });

  it('en fin de semana mantiene el ultimo BCV y toma Binance nuevo', async () => {
    jest.spyOn(fechas, 'obtenerFechaLocalDeHoy').mockReturnValue('2026-09-26');
    const { servicio, filas, fuentes } = crearActualizador([{ idTasa: 1, fecha: '2026-09-25', valorTasaBcv: 180, valorTasaBinance: 205 }], 999, 212);
    await servicio.ejecutar();
    expect(fuentes.obtenerTasaBcv).not.toHaveBeenCalled();
    expect(filas.find((fila) => fila.fecha === '2026-09-26')).toMatchObject({ valorTasaBcv: 180, valorTasaBinance: 212 });
  });

  it('si la tasa del dia ya existe no la vuelve a registrar y solo actualiza Binance', async () => {
    jest.spyOn(fechas, 'obtenerFechaLocalDeHoy').mockReturnValue('2026-09-28');
    const { servicio, filas, repositorio } = crearActualizador([{ idTasa: 1, fecha: '2026-09-28', valorTasaBcv: 185, valorTasaBinance: 210 }], 190, 214);
    await servicio.ejecutar();
    expect(repositorio.save).not.toHaveBeenCalled();
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({ valorTasaBcv: 185, valorTasaBinance: 214 });
  });

  it('si ninguna fuente responde usa las ultimas tasas conocidas', async () => {
    jest.spyOn(fechas, 'obtenerFechaLocalDeHoy').mockReturnValue('2026-09-28');
    const { servicio, filas } = crearActualizador([{ idTasa: 1, fecha: '2026-09-25', valorTasaBcv: 180, valorTasaBinance: 205 }], null, null);
    await servicio.ejecutar();
    expect(filas.find((fila) => fila.fecha === '2026-09-28')).toMatchObject({ valorTasaBcv: 180, valorTasaBinance: 205 });
  });

  it('sin fuentes ni tasas anteriores no registra nada', async () => {
    jest.spyOn(fechas, 'obtenerFechaLocalDeHoy').mockReturnValue('2026-09-28');
    const { servicio, filas } = crearActualizador([], null, null);
    const resultado = await servicio.ejecutar();
    expect(filas).toHaveLength(0);
    expect(resultado).toContain('No se pudo registrar');
  });
});
