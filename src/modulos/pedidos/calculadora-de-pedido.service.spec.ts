import { BadRequestException } from '@nestjs/common';
import { CalculadoraDePedidoService } from './calculadora-de-pedido.service';
import { Producto } from '../../comun/entidades';

function crearProducto(datos: Partial<Producto>): Producto {
  return {
    idProducto: 1,
    codigo: 'P1',
    codigoDeBarras: null,
    descripcion: 'Producto 1',
    existencia: 100,
    precioUnitario: 10,
    costoPromedio: 6,
    precioAlMayor: null,
    cantidadMinimaParaPrecioAlMayor: 0,
    existenciaMinima: 5,
    activo: true,
    ...datos
  } as Producto;
}

describe('CalculadoraDePedidoService', () => {
  const productoA = crearProducto({ idProducto: 1, descripcion: 'Harina', precioUnitario: 10, costoPromedio: 6 });
  const productoB = crearProducto({ idProducto: 2, descripcion: 'Aceite', precioUnitario: 5, costoPromedio: 3, existencia: 2 });

  const repositorio = { find: jest.fn().mockResolvedValue([productoA, productoB]), findOne: jest.fn() };
  const motor = {
    evaluarLineasDelPedido: jest.fn(async (lineas: { producto: Producto; cantidad: number }[]) => {
      const lineasEvaluadas = lineas.map((linea) => ({
        idProducto: linea.producto.idProducto,
        descripcionDelProducto: linea.producto.descripcion,
        cantidad: linea.cantidad,
        precioDeLista: linea.producto.precioUnitario,
        precioUnitarioAplicado: linea.producto.precioUnitario,
        subtotalDeLaLinea: linea.producto.precioUnitario * linea.cantidad,
        costoUnitarioAplicado: linea.producto.costoPromedio,
        nombreDePromocionAplicadaEnLinea: null,
        seUsoPrecioAlMayorEnEstaLinea: false
      }));
      const subtotal = lineasEvaluadas.reduce((suma, linea) => suma + linea.subtotalDeLaLinea, 0);
      return {
        lineas: lineasEvaluadas,
        subtotalAntesDelDescuentoPorMonto: subtotal,
        nombreDePromocionAplicadaPorMonto: null,
        montoDescontadoPorMonto: 0,
        productoDeRegaloAgregado: null,
        montoTotalDescontado: 0,
        totalFinal: subtotal,
        resumenDePromocionesAplicadas: []
      };
    })
  };

  const calculadora = new CalculadoraDePedidoService(repositorio as never, motor as never);

  it('aplica descuento manual por linea y descuento global', async () => {
    const resultado = await calculadora.calcular({
      detalles: [{ idProducto: 1, cantidad: 3, tipoDescuentoManual: 'Porcentaje', valorDescuentoManual: 10 }],
      descuentoGlobal: { tipo: 'Monto', valor: 2 }
    });

    expect(resultado.lineas[0].descuentoManual).toBe(3);
    expect(resultado.descuentoManualGlobal).toBe(2);
    expect(resultado.totalFinal).toBe(25);
    expect(resultado.montoTotalDescuentoManual).toBe(5);
    expect(resultado.costoTotal).toBe(18);
    expect(resultado.gananciaEstimada).toBe(7);
  });

  it('un regalo no suma al total pero si al costo', async () => {
    const resultado = await calculadora.calcular({
      detalles: [
        { idProducto: 1, cantidad: 1 },
        { idProducto: 2, cantidad: 1, esRegalo: true }
      ]
    });

    expect(resultado.totalFinal).toBe(10);
    expect(resultado.costoDeRegalos).toBe(3);
    expect(resultado.valorDeRegalosAPrecioDeLista).toBe(5);
    expect(resultado.costoTotal).toBe(9);
    expect(resultado.lineas[1].esRegalo).toBe(true);
  });

  it('valida la existencia sumando las lineas normales y de regalo del mismo producto', async () => {
    await expect(
      calculadora.calcular({
        detalles: [
          { idProducto: 2, cantidad: 2 },
          { idProducto: 2, cantidad: 1, esRegalo: true }
        ]
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('marca la venta por debajo del costo', async () => {
    const resultado = await calculadora.calcular({
      detalles: [{ idProducto: 1, cantidad: 1, tipoDescuentoManual: 'Monto', valorDescuentoManual: 5 }]
    });

    expect(resultado.lineas[0].quedaPorDebajoDelCosto).toBe(true);
    expect(resultado.ventaPorDebajoDelCosto).toBe(true);
  });

  it('no permite porcentajes mayores a 100', async () => {
    await expect(
      calculadora.calcular({ detalles: [{ idProducto: 1, cantidad: 1, tipoDescuentoManual: 'Porcentaje', valorDescuentoManual: 150 }] })
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
