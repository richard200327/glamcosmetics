import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CuentasService } from './cuentas.service';
import { CuentaPorCobrarPagar, Pedido } from '../../comun/entidades';

describe('CuentasService', () => {
  let servicio: CuentasService;
  let manager: { query: jest.Mock; findOne: jest.Mock };

  function crearCuenta(datos: Partial<CuentaPorCobrarPagar>): CuentaPorCobrarPagar {
    return {
      idCuenta: 1,
      idPedido: 10,
      idCompra: null,
      idCliente: 1,
      idProveedor: null,
      tipoCuenta: 'CXC',
      montoOriginal: 60,
      saldoPendiente: 60,
      fechaEmision: new Date(),
      fechaVencimiento: null,
      estado: 'Pendiente',
      ...datos
    } as CuentaPorCobrarPagar;
  }

  beforeEach(async () => {
    manager = {
      query: jest.fn().mockResolvedValue({ affectedRows: 1 }),
      findOne: jest.fn()
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CuentasService,
        { provide: getRepositoryToken(CuentaPorCobrarPagar), useValue: { manager } },
        { provide: getRepositoryToken(Pedido), useValue: {} }
      ]
    }).compile();

    servicio = module.get(CuentasService);
  });

  it('calcula el estado ANTES de modificar el saldo en el mismo UPDATE', async () => {
    manager.findOne.mockResolvedValue(crearCuenta({ saldoPendiente: 20, estado: 'Parcial' }));

    await servicio.aplicarAbonoACuenta(1, 40, manager as never);

    const sql: string = manager.query.mock.calls[0][0];
    expect(sql.indexOf('SET Estado')).toBeLessThan(sql.indexOf('SaldoPendiente = GREATEST'));
    expect(manager.query.mock.calls[0][1]).toEqual([40, 40, 1, 40]);
  });

  it('lanza conflicto si el UPDATE no afecta filas', async () => {
    manager.query.mockResolvedValueOnce({ affectedRows: 0 });

    await expect(servicio.aplicarAbonoACuenta(1, 100, manager as never)).rejects.toBeInstanceOf(ConflictException);
  });

  it('sincroniza el pedido como Parcial despues de un abono parcial', async () => {
    manager.findOne.mockResolvedValue(crearCuenta({ saldoPendiente: 20, estado: 'Parcial' }));

    await servicio.aplicarAbonoACuenta(1, 40, manager as never);

    const llamadaAlPedido = manager.query.mock.calls.find((llamada) => String(llamada[0]).includes('UPDATE Pedido'));
    expect(llamadaAlPedido?.[1]).toEqual(['Parcial', 10]);
  });

  it('sincroniza la compra como Pagada cuando la CXP queda saldada', async () => {
    manager.findOne.mockResolvedValue(
      crearCuenta({ idPedido: null, idCompra: 7, tipoCuenta: 'CXP', saldoPendiente: 0, estado: 'Pagada' })
    );

    await servicio.aplicarAbonoACuenta(1, 60, manager as never);

    const llamadaALaCompra = manager.query.mock.calls.find((llamada) => String(llamada[0]).includes('UPDATE Compra'));
    expect(llamadaALaCompra?.[1]).toEqual(['Pagada', 7]);
  });

  it('al revertir vuelve a Pendiente cuando se recupera todo el monto', async () => {
    manager.findOne.mockResolvedValue(crearCuenta({ saldoPendiente: 60, estado: 'Pendiente' }));

    await servicio.revertirAbonoACuenta(1, 60, manager as never);

    const llamadaAlPedido = manager.query.mock.calls.find((llamada) => String(llamada[0]).includes('UPDATE Pedido'));
    expect(llamadaAlPedido?.[1]).toEqual(['Pendiente', 10]);
  });
});
