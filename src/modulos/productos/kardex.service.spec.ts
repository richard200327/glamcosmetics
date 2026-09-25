import { BadRequestException } from '@nestjs/common';
import { KardexService } from './kardex.service';

describe('KardexService', () => {
  function crearManager(existencia: number, costoPromedio: number) {
    return {
      query: jest.fn(async (sql: string) => {
        if (sql.startsWith('SELECT')) {
          return [{ IdProducto: 1, Descripcion: 'Harina', Existencia: existencia, CostoPromedio: costoPromedio }];
        }
        return { affectedRows: 1 };
      }),
      insert: jest.fn()
    };
  }

  const servicio = new KardexService({} as never, {} as never);

  it('calcula el costo promedio ponderado en una entrada', async () => {
    const manager = crearManager(20, 4);
    const resultado = await servicio.registrarEntrada(manager as never, { idProducto: 1, cantidad: 100, costoUnitario: 5, origen: 'Compra' });

    expect(resultado.existenciaResultante).toBe(120);
    expect(resultado.costoPromedioResultante).toBeCloseTo(4.8333, 4);
    expect(manager.insert).toHaveBeenCalled();
  });

  it('toma el costo de la entrada cuando no habia existencia', async () => {
    const manager = crearManager(0, 9);
    const resultado = await servicio.registrarEntrada(manager as never, { idProducto: 1, cantidad: 10, costoUnitario: 3, origen: 'Compra' });

    expect(resultado.costoPromedioResultante).toBe(3);
  });

  it('no permite dejar existencia negativa', async () => {
    const manager = crearManager(2, 4);
    await expect(servicio.registrarSalida(manager as never, { idProducto: 1, cantidad: 3, origen: 'Venta' })).rejects.toBeInstanceOf(
      BadRequestException
    );
  });

  it('revertir una compra deshace el promedio ponderado', async () => {
    const manager = crearManager(120, 4.8333);
    const resultado = await servicio.revertirEntrada(manager as never, { idProducto: 1, cantidad: 100, costoUnitario: 5, origen: 'AnulacionCompra' });

    expect(resultado.existenciaResultante).toBe(20);
    expect(resultado.costoPromedioResultante).toBeCloseTo(4, 2);
  });
});
