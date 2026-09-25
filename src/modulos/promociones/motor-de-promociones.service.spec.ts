import { Test, TestingModule } from '@nestjs/testing';
import { MotorDePromocionesService } from './motor-de-promociones.service';
import { PromocionesService } from './promociones.service';
import { Producto } from '../../comun/entidades';
import { Promocion } from '../../comun/entidades/promocion.entity';

function crearProducto(datos: Partial<Producto>): Producto {
  return {
    idProducto: 1,
    codigo: 'PRD-1',
    codigoDeBarras: null,
    descripcion: 'Producto de prueba',
    existencia: 100,
    precioUnitario: 20,
    costoPromedio: 12,
    precioAlMayor: null,
    cantidadMinimaParaPrecioAlMayor: 0,
    activo: true,
    ...datos
  } as Producto;
}

// El motor de promociones es la pieza mas critica del sistema en terminos de
// seguridad e integridad de datos: el backend confia en el, no en lo que manda el
// cliente, para determinar cuanto se le cobra a cada quien. Estos tests cubren cada
// una de las reglas de negocio descritas en las notas del codigo del servicio.
describe('MotorDePromocionesService', () => {
  let motor: MotorDePromocionesService;
  let promocionesService: { obtenerPromocionesVigentes: jest.Mock };

  beforeEach(async () => {
    promocionesService = { obtenerPromocionesVigentes: jest.fn().mockResolvedValue([]) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [MotorDePromocionesService, { provide: PromocionesService, useValue: promocionesService }]
    }).compile();

    motor = module.get(MotorDePromocionesService);
  });

  it('sin promociones vigentes, cobra el precio de lista', async () => {
    const producto = crearProducto({});
    const resultado = await motor.evaluarLineasDelPedido([{ producto, cantidad: 3 }], '2026-08-17');

    expect(resultado.lineas).toHaveLength(1);
    expect(resultado.lineas[0].precioUnitarioAplicado).toBe(20);
    expect(resultado.lineas[0].subtotalDeLaLinea).toBe(60);
    expect(resultado.lineas[0].costoUnitarioAplicado).toBe(12);
    expect(resultado.totalFinal).toBe(60);
    expect(resultado.montoTotalDescontado).toBe(0);
  });

  it('aplica precio al mayor cuando la cantidad alcanza el minimo, ignorando promociones', async () => {
    const producto = crearProducto({ precioAlMayor: 15, cantidadMinimaParaPrecioAlMayor: 10 });

    promocionesService.obtenerPromocionesVigentes.mockResolvedValue([
      {
        tipoPromocion: 'PrecioEspecial',
        nombre: 'Precio especial que NO deberia aplicar',
        acumulable: false,
        productos: [],
        reglasDeCantidad: [],
        reglasDePrecioEspecial: [{ idProducto: producto.idProducto, precioEspecial: 5 }],
        reglasDeMontoPedido: []
      } as unknown as Promocion
    ]);

    const resultado = await motor.evaluarLineasDelPedido([{ producto, cantidad: 10 }], '2026-08-17');

    expect(resultado.lineas[0].precioUnitarioAplicado).toBe(15);
    expect(resultado.lineas[0].seUsoPrecioAlMayorEnEstaLinea).toBe(true);
    expect(resultado.lineas[0].nombreDePromocionAplicadaEnLinea).toBe('Precio al mayor');
  });

  it('NO aplica precio al mayor si la cantidad no alcanza el minimo', async () => {
    const producto = crearProducto({ precioAlMayor: 15, cantidadMinimaParaPrecioAlMayor: 10 });
    const resultado = await motor.evaluarLineasDelPedido([{ producto, cantidad: 9 }], '2026-08-17');

    expect(resultado.lineas[0].precioUnitarioAplicado).toBe(20);
    expect(resultado.lineas[0].seUsoPrecioAlMayorEnEstaLinea).toBe(false);
  });

  it('aplica precio especial de una promocion vigente', async () => {
    const producto = crearProducto({});

    promocionesService.obtenerPromocionesVigentes.mockResolvedValue([
      {
        tipoPromocion: 'PrecioEspecial',
        nombre: 'Precio especial camisas',
        acumulable: false,
        productos: [],
        reglasDeCantidad: [],
        reglasDePrecioEspecial: [{ idProducto: producto.idProducto, precioEspecial: 15 }],
        reglasDeMontoPedido: []
      } as unknown as Promocion
    ]);

    const resultado = await motor.evaluarLineasDelPedido([{ producto, cantidad: 2 }], '2026-08-17');

    expect(resultado.lineas[0].precioUnitarioAplicado).toBe(15);
    expect(resultado.lineas[0].subtotalDeLaLinea).toBe(30);
    expect(resultado.lineas[0].nombreDePromocionAplicadaEnLinea).toBe('Precio especial camisas');
  });

  it('aplica descuento por cantidad minima alcanzada', async () => {
    const producto = crearProducto({});

    promocionesService.obtenerPromocionesVigentes.mockResolvedValue([
      {
        tipoPromocion: 'DescuentoPorCantidad',
        nombre: 'Lleva 2, 5% de descuento',
        acumulable: true,
        productos: [{ idProducto: producto.idProducto }],
        reglasDeCantidad: [{ cantidadMinima: 2, tipoDescuento: 'Porcentaje', valorDescuento: 5 }],
        reglasDePrecioEspecial: [],
        reglasDeMontoPedido: []
      } as unknown as Promocion
    ]);

    const resultado = await motor.evaluarLineasDelPedido([{ producto, cantidad: 2 }], '2026-08-17');

    // 2 * 20 = 40, menos 5% = 38
    expect(resultado.lineas[0].subtotalDeLaLinea).toBe(38);
  });

  it('aplica descuento por monto de pedido cuando se supera el minimo', async () => {
    const producto = crearProducto({ precioUnitario: 60 });

    promocionesService.obtenerPromocionesVigentes.mockResolvedValue([
      {
        tipoPromocion: 'DescuentoPorMontoPedido',
        nombre: 'Descuento por monto de pedido',
        acumulable: true,
        productos: [],
        reglasDeCantidad: [],
        reglasDePrecioEspecial: [],
        reglasDeMontoPedido: [
          { montoMinimoPedido: 100, tipoBeneficio: 'DescuentoPorcentaje', valorDescuento: 5, productoRegalo: null }
        ]
      } as unknown as Promocion
    ]);

    const resultado = await motor.evaluarLineasDelPedido([{ producto, cantidad: 2 }], '2026-08-17');

    // subtotal = 120, supera el minimo de 100 -> 5% de descuento = 6
    expect(resultado.subtotalAntesDelDescuentoPorMonto).toBe(120);
    expect(resultado.montoDescontadoPorMonto).toBe(6);
    expect(resultado.totalFinal).toBe(114);
  });

  it('NO aplica el beneficio por monto si ya se aplico una promocion no acumulable en una linea', async () => {
    const producto = crearProducto({ precioUnitario: 60 });

    promocionesService.obtenerPromocionesVigentes.mockResolvedValue([
      {
        tipoPromocion: 'PrecioEspecial',
        nombre: 'Precio especial no acumulable',
        acumulable: false,
        productos: [],
        reglasDeCantidad: [],
        reglasDePrecioEspecial: [{ idProducto: producto.idProducto, precioEspecial: 60 }],
        reglasDeMontoPedido: []
      } as unknown as Promocion,
      {
        tipoPromocion: 'DescuentoPorMontoPedido',
        nombre: 'Descuento por monto de pedido',
        acumulable: true,
        productos: [],
        reglasDeCantidad: [],
        reglasDePrecioEspecial: [],
        reglasDeMontoPedido: [
          { montoMinimoPedido: 100, tipoBeneficio: 'DescuentoPorcentaje', valorDescuento: 5, productoRegalo: null }
        ]
      } as unknown as Promocion
    ]);

    const resultado = await motor.evaluarLineasDelPedido([{ producto, cantidad: 2 }], '2026-08-17');

    expect(resultado.montoDescontadoPorMonto).toBe(0);
    expect(resultado.nombreDePromocionAplicadaPorMonto).toBeNull();
  });

  it('agrega un producto de regalo cuando la regla de monto lo especifica', async () => {
    const producto = crearProducto({ precioUnitario: 60 });
    const productoRegalo = crearProducto({ idProducto: 2, descripcion: 'Producto de regalo', costoPromedio: 3 });

    promocionesService.obtenerPromocionesVigentes.mockResolvedValue([
      {
        tipoPromocion: 'ProductoGratisPorMonto',
        nombre: 'Regalo por monto',
        acumulable: true,
        productos: [],
        reglasDeCantidad: [],
        reglasDePrecioEspecial: [],
        reglasDeMontoPedido: [
          { montoMinimoPedido: 100, tipoBeneficio: 'ProductoGratis', valorDescuento: null, productoRegalo }
        ]
      } as unknown as Promocion
    ]);

    const resultado = await motor.evaluarLineasDelPedido([{ producto, cantidad: 2 }], '2026-08-17');

    expect(resultado.productoDeRegaloAgregado).not.toBeNull();
    expect(resultado.productoDeRegaloAgregado?.idProducto).toBe(2);
    // El costo del regalo SI se propaga (a diferencia del bug original del frontend).
    expect(resultado.productoDeRegaloAgregado?.costoPromedio).toBe(3);
  });
});
