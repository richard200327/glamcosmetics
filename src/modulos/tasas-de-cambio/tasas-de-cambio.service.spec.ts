import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TasasDeCambioService } from './tasas-de-cambio.service';
import { DolarApiClienteService, CotizacionDolarApi } from './dolar-api-cliente.service';
import { TasaDeCambio } from '../../comun/entidades';

// El cliente HTTP real (DolarApiClienteService) hace una llamada de red a
// ve.dolarapi.com, asi que aqui se mockea por completo: estos tests verifican la
// LOGICA de mapeo (oficial -> BCV, paralelo -> Binance) y el manejo de datos
// incompletos, no la conectividad de red en si.
describe('TasasDeCambioService - sincronizarTasaDelDiaDesdeDolarApi', () => {
  let servicio: TasasDeCambioService;
  let dolarApiCliente: { obtenerCotizacionesDeVenezuela: jest.Mock };
  let repositorioDeTasas: { findOne: jest.Mock; create: jest.Mock; save: jest.Mock };

  function crearCotizacion(datos: Partial<CotizacionDolarApi>): CotizacionDolarApi {
    return {
      moneda: 'USD',
      fuente: 'oficial',
      nombre: 'Dólar',
      compra: null,
      venta: null,
      promedio: 772.5441,
      fechaActualizacion: '2026-08-17T00:00:00-04:00',
      ...datos
    };
  }

  beforeEach(async () => {
    dolarApiCliente = { obtenerCotizacionesDeVenezuela: jest.fn() };
    repositorioDeTasas = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((datos) => datos),
      save: jest.fn((tasa) => Promise.resolve({ idTasa: 1, ...tasa }))
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasasDeCambioService,
        { provide: getRepositoryToken(TasaDeCambio), useValue: repositorioDeTasas },
        { provide: DolarApiClienteService, useValue: dolarApiCliente }
      ]
    }).compile();

    servicio = module.get(TasasDeCambioService);
  });

  it('mapea "oficial" a valorTasaBcv y "paralelo" a valorTasaBinance', async () => {
    dolarApiCliente.obtenerCotizacionesDeVenezuela.mockResolvedValue([
      crearCotizacion({ fuente: 'oficial', promedio: 772.5441 }),
      crearCotizacion({ fuente: 'paralelo', nombre: 'Paralelo', promedio: 852.156624 })
    ]);

    const tasa = await servicio.sincronizarTasaDelDiaDesdeDolarApi();

    expect(tasa.valorTasaBcv).toBeCloseTo(772.5441);
    expect(tasa.valorTasaBinance).toBeCloseTo(852.156624);
  });

  it('ignora cotizaciones de otras monedas (ej: EUR) al buscar oficial/paralelo de USD', async () => {
    dolarApiCliente.obtenerCotizacionesDeVenezuela.mockResolvedValue([
      crearCotizacion({ moneda: 'EUR', fuente: 'oficial', promedio: 894.49 }),
      crearCotizacion({ moneda: 'USD', fuente: 'oficial', promedio: 772.5441 }),
      crearCotizacion({ moneda: 'USD', fuente: 'paralelo', promedio: 852.156624 })
    ]);

    const tasa = await servicio.sincronizarTasaDelDiaDesdeDolarApi();

    expect(tasa.valorTasaBcv).toBeCloseTo(772.5441);
  });

  it('lanza NotFoundException si dolarapi.com no trae la fuente "paralelo" (no se guarda nada a medias)', async () => {
    dolarApiCliente.obtenerCotizacionesDeVenezuela.mockResolvedValue([crearCotizacion({ fuente: 'oficial' })]);

    await expect(servicio.sincronizarTasaDelDiaDesdeDolarApi()).rejects.toThrow(NotFoundException);
    expect(repositorioDeTasas.save).not.toHaveBeenCalled();
  });

  it('lanza NotFoundException si dolarapi.com no trae la fuente "oficial"', async () => {
    dolarApiCliente.obtenerCotizacionesDeVenezuela.mockResolvedValue([crearCotizacion({ fuente: 'paralelo' })]);

    await expect(servicio.sincronizarTasaDelDiaDesdeDolarApi()).rejects.toThrow(NotFoundException);
    expect(repositorioDeTasas.save).not.toHaveBeenCalled();
  });

  it('si ya existia una tasa hoy, la ACTUALIZA en vez de crear una segunda fila', async () => {
    repositorioDeTasas.findOne.mockResolvedValue({ idTasa: 5, fecha: new Date().toISOString().substring(0, 10), valorTasaBcv: 1, valorTasaBinance: 1 });

    dolarApiCliente.obtenerCotizacionesDeVenezuela.mockResolvedValue([
      crearCotizacion({ fuente: 'oficial', promedio: 772.5441 }),
      crearCotizacion({ fuente: 'paralelo', promedio: 852.156624 })
    ]);

    const tasa = await servicio.sincronizarTasaDelDiaDesdeDolarApi();

    expect(repositorioDeTasas.create).not.toHaveBeenCalled();
    expect(tasa.idTasa).toBe(5);
    expect(tasa.valorTasaBcv).toBeCloseTo(772.5441);
  });
});
