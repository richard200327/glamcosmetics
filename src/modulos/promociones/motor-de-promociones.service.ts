import { Injectable } from '@nestjs/common';
import { Producto } from '../../comun/entidades';
import { Promocion } from '../../comun/entidades/promocion.entity';
import { PromocionesService } from './promociones.service';

// Este servicio es el PUERTO A BACKEND del motor de promociones que antes vivia
// solo en el frontend Angular (motor-de-promociones.service.ts). La razon de moverlo
// aqui: el backend NO debe confiar en el precioUnitario que manda el cliente al crear
// un pedido, porque cualquiera con acceso al endpoint podria mandar precios arbitrarios.
// Ahora el backend recalcula el precio real a partir de las promociones vigentes y el
// precio al mayor, exactamente con las mismas reglas de negocio que el frontend.

export interface LineaSeleccionadaParaEvaluar {
  producto: Producto;
  cantidad: number;
}

export interface LineaDePedidoEvaluada {
  idProducto: number;
  descripcionDelProducto: string;
  cantidad: number;
  precioDeLista: number;
  precioUnitarioAplicado: number;
  subtotalDeLaLinea: number;
  costoUnitarioAplicado: number;
  nombreDePromocionAplicadaEnLinea: string | null;
  seUsoPrecioAlMayorEnEstaLinea: boolean;
}

export interface ResultadoDeEvaluacionDePromociones {
  lineas: LineaDePedidoEvaluada[];
  subtotalAntesDelDescuentoPorMonto: number;
  nombreDePromocionAplicadaPorMonto: string | null;
  montoDescontadoPorMonto: number;
  productoDeRegaloAgregado: { idProducto: number; descripcion: string; costoPromedio: number } | null;
  montoTotalDescontado: number;
  totalFinal: number;
  resumenDePromocionesAplicadas: string[];
}

interface ReglaDePrecioEspecialParaCalculo {
  precioEspecial: number;
  nombreDeLaPromocion: string;
  acumulable: boolean;
}

interface ReglaDeCantidadParaCalculo {
  cantidadMinima: number;
  tipoDescuento: 'Porcentaje' | 'MontoFijo';
  valorDescuento: number;
  nombreDeLaPromocion: string;
  acumulable: boolean;
}

interface ReglaDeMontoPedidoParaCalculo {
  montoMinimoPedido: number;
  tipoBeneficio: 'DescuentoPorcentaje' | 'ProductoGratis';
  valorDescuento: number | null;
  productoRegalo: Producto | null;
  nombreDeLaPromocion: string;
  acumulable: boolean;
}

@Injectable()
export class MotorDePromocionesService {
  constructor(private readonly promocionesService: PromocionesService) {}

  public async evaluarLineasDelPedido(
    lineasSeleccionadas: LineaSeleccionadaParaEvaluar[],
    fecha: string
  ): Promise<ResultadoDeEvaluacionDePromociones> {
    const promocionesVigentes = await this.promocionesService.obtenerPromocionesVigentes(fecha);

    const mapaDePrecioEspecial = this.construirMapaDePrecioEspecialPorProducto(promocionesVigentes);
    const mapaDeReglaDeCantidad = this.construirMapaDeReglaDeCantidadPorProducto(promocionesVigentes);
    const reglasDeMontoPedido = this.construirListaDeReglasDeMontoPedido(promocionesVigentes);

    const resumenDePromociones = new Set<string>();
    let huboUnaPromocionNoAcumulableAplicada = false;

    const lineasEvaluadas: LineaDePedidoEvaluada[] = [];

    for (const lineaSeleccionada of lineasSeleccionadas) {
      const resultadoDeLaLinea = this.evaluarUnaLinea(
        lineaSeleccionada,
        mapaDePrecioEspecial,
        mapaDeReglaDeCantidad,
        huboUnaPromocionNoAcumulableAplicada
      );

      lineasEvaluadas.push(resultadoDeLaLinea.linea);

      for (const nombre of resultadoDeLaLinea.nombresDePromocionesUsadas) {
        resumenDePromociones.add(nombre);
      }

      if (resultadoDeLaLinea.seAplicoUnaPromocionNoAcumulable) {
        huboUnaPromocionNoAcumulableAplicada = true;
      }
    }

    const subtotalAntesDelDescuentoPorMonto = lineasEvaluadas.reduce((suma, l) => suma + l.subtotalDeLaLinea, 0);

    const resultadoDelBeneficioPorMonto = this.evaluarBeneficioPorMontoDePedido(
      reglasDeMontoPedido,
      subtotalAntesDelDescuentoPorMonto,
      huboUnaPromocionNoAcumulableAplicada
    );

    if (resultadoDelBeneficioPorMonto.nombreDeLaPromocionAplicada !== null) {
      resumenDePromociones.add(resultadoDelBeneficioPorMonto.nombreDeLaPromocionAplicada);
    }

    const sumaAPrecioDeLista = lineasSeleccionadas.reduce(
      (suma, l) => suma + l.producto.precioUnitario * l.cantidad,
      0
    );
    const montoTotalDescontado =
      sumaAPrecioDeLista - subtotalAntesDelDescuentoPorMonto + resultadoDelBeneficioPorMonto.montoDescontado;
    const totalFinal = subtotalAntesDelDescuentoPorMonto - resultadoDelBeneficioPorMonto.montoDescontado;

    return {
      lineas: lineasEvaluadas,
      subtotalAntesDelDescuentoPorMonto,
      nombreDePromocionAplicadaPorMonto: resultadoDelBeneficioPorMonto.nombreDeLaPromocionAplicada,
      montoDescontadoPorMonto: resultadoDelBeneficioPorMonto.montoDescontado,
      productoDeRegaloAgregado: resultadoDelBeneficioPorMonto.productoDeRegalo,
      montoTotalDescontado,
      totalFinal,
      resumenDePromocionesAplicadas: Array.from(resumenDePromociones)
    };
  }

  private evaluarUnaLinea(
    lineaSeleccionada: LineaSeleccionadaParaEvaluar,
    mapaDePrecioEspecial: Map<number, ReglaDePrecioEspecialParaCalculo>,
    mapaDeReglaDeCantidad: Map<number, ReglaDeCantidadParaCalculo>,
    yaHuboUnaPromocionNoAcumulableAntesDeEstaLinea: boolean
  ): {
    linea: LineaDePedidoEvaluada;
    nombresDePromocionesUsadas: string[];
    seAplicoUnaPromocionNoAcumulable: boolean;
  } {
    const nombresDePromocionesUsadas: string[] = [];
    let seAplicoUnaPromocionNoAcumulable = false;
    let huboBloqueoEnEstaLinea = yaHuboUnaPromocionNoAcumulableAntesDeEstaLinea;

    // Paso 0: precio al mayor. Excluyente con promociones (no se combinan).
    const elProductoManejaPrecioAlMayor = lineaSeleccionada.producto.cantidadMinimaParaPrecioAlMayor > 0;
    const laCantidadAlcanzaElMinimoDePrecioAlMayor =
      elProductoManejaPrecioAlMayor &&
      lineaSeleccionada.cantidad >= lineaSeleccionada.producto.cantidadMinimaParaPrecioAlMayor;

    if (laCantidadAlcanzaElMinimoDePrecioAlMayor && lineaSeleccionada.producto.precioAlMayor !== null) {
      const precioUnitarioAlMayor = lineaSeleccionada.producto.precioAlMayor;
      const subtotalAlMayor = precioUnitarioAlMayor * lineaSeleccionada.cantidad;

      return {
        linea: {
          idProducto: lineaSeleccionada.producto.idProducto,
          descripcionDelProducto: lineaSeleccionada.producto.descripcion,
          cantidad: lineaSeleccionada.cantidad,
          precioDeLista: lineaSeleccionada.producto.precioUnitario,
          precioUnitarioAplicado: precioUnitarioAlMayor,
          subtotalDeLaLinea: subtotalAlMayor,
          costoUnitarioAplicado: lineaSeleccionada.producto.costoPromedio,
          nombreDePromocionAplicadaEnLinea: 'Precio al mayor',
          seUsoPrecioAlMayorEnEstaLinea: true
        },
        nombresDePromocionesUsadas: [],
        seAplicoUnaPromocionNoAcumulable: false
      };
    }

    let precioUnitarioAplicado = lineaSeleccionada.producto.precioUnitario;

    // Paso 1: precio especial por producto.
    const reglaDePrecioEspecial = mapaDePrecioEspecial.get(lineaSeleccionada.producto.idProducto);

    if (reglaDePrecioEspecial !== undefined && !huboBloqueoEnEstaLinea) {
      precioUnitarioAplicado = reglaDePrecioEspecial.precioEspecial;
      nombresDePromocionesUsadas.push(reglaDePrecioEspecial.nombreDeLaPromocion);

      if (!reglaDePrecioEspecial.acumulable) {
        seAplicoUnaPromocionNoAcumulable = true;
        huboBloqueoEnEstaLinea = true;
      }
    }

    const subtotalAlPrecioAplicado = precioUnitarioAplicado * lineaSeleccionada.cantidad;
    let descuentoPorCantidad = 0;

    // Paso 2: descuento por cantidad minima alcanzada.
    const reglaDeCantidad = mapaDeReglaDeCantidad.get(lineaSeleccionada.producto.idProducto);

    if (
      reglaDeCantidad !== undefined &&
      lineaSeleccionada.cantidad >= reglaDeCantidad.cantidadMinima &&
      !huboBloqueoEnEstaLinea
    ) {
      descuentoPorCantidad =
        reglaDeCantidad.tipoDescuento === 'Porcentaje'
          ? subtotalAlPrecioAplicado * (reglaDeCantidad.valorDescuento / 100)
          : reglaDeCantidad.valorDescuento;

      nombresDePromocionesUsadas.push(reglaDeCantidad.nombreDeLaPromocion);

      if (!reglaDeCantidad.acumulable) {
        seAplicoUnaPromocionNoAcumulable = true;
      }
    }

    const subtotalDeLaLinea = Math.max(subtotalAlPrecioAplicado - descuentoPorCantidad, 0);

    return {
      linea: {
        idProducto: lineaSeleccionada.producto.idProducto,
        descripcionDelProducto: lineaSeleccionada.producto.descripcion,
        cantidad: lineaSeleccionada.cantidad,
        precioDeLista: lineaSeleccionada.producto.precioUnitario,
        precioUnitarioAplicado,
        subtotalDeLaLinea,
        costoUnitarioAplicado: lineaSeleccionada.producto.costoPromedio,
        nombreDePromocionAplicadaEnLinea:
          nombresDePromocionesUsadas.length > 0 ? nombresDePromocionesUsadas.join(' + ') : null,
        seUsoPrecioAlMayorEnEstaLinea: false
      },
      nombresDePromocionesUsadas,
      seAplicoUnaPromocionNoAcumulable
    };
  }

  private evaluarBeneficioPorMontoDePedido(
    reglasDeMontoPedido: ReglaDeMontoPedidoParaCalculo[],
    subtotalDelPedido: number,
    huboUnaPromocionNoAcumulableAplicada: boolean
  ): {
    nombreDeLaPromocionAplicada: string | null;
    montoDescontado: number;
    productoDeRegalo: { idProducto: number; descripcion: string; costoPromedio: number } | null;
  } {
    if (huboUnaPromocionNoAcumulableAplicada) {
      return { nombreDeLaPromocionAplicada: null, montoDescontado: 0, productoDeRegalo: null };
    }

    for (const regla of reglasDeMontoPedido) {
      if (subtotalDelPedido < regla.montoMinimoPedido) {
        continue;
      }

      if (regla.tipoBeneficio === 'DescuentoPorcentaje') {
        return {
          nombreDeLaPromocionAplicada: regla.nombreDeLaPromocion,
          montoDescontado: subtotalDelPedido * ((regla.valorDescuento ?? 0) / 100),
          productoDeRegalo: null
        };
      }

      if (regla.productoRegalo !== null) {
        return {
          nombreDeLaPromocionAplicada: regla.nombreDeLaPromocion,
          montoDescontado: 0,
          productoDeRegalo: {
            idProducto: regla.productoRegalo.idProducto,
            descripcion: regla.productoRegalo.descripcion,
            costoPromedio: regla.productoRegalo.costoPromedio
          }
        };
      }
    }

    return { nombreDeLaPromocionAplicada: null, montoDescontado: 0, productoDeRegalo: null };
  }

  private construirMapaDePrecioEspecialPorProducto(promociones: Promocion[]): Map<number, ReglaDePrecioEspecialParaCalculo> {
    const mapa = new Map<number, ReglaDePrecioEspecialParaCalculo>();

    for (const promocion of promociones) {
      if (promocion.tipoPromocion !== 'PrecioEspecial') {
        continue;
      }

      for (const regla of promocion.reglasDePrecioEspecial ?? []) {
        mapa.set(regla.idProducto, {
          precioEspecial: Number(regla.precioEspecial),
          nombreDeLaPromocion: promocion.nombre,
          acumulable: promocion.acumulable
        });
      }
    }

    return mapa;
  }

  private construirMapaDeReglaDeCantidadPorProducto(promociones: Promocion[]): Map<number, ReglaDeCantidadParaCalculo> {
    const mapa = new Map<number, ReglaDeCantidadParaCalculo>();

    for (const promocion of promociones) {
      if (promocion.tipoPromocion !== 'DescuentoPorCantidad') {
        continue;
      }

      const productosAsociados = promocion.productos ?? [];
      const reglas = promocion.reglasDeCantidad ?? [];

      // El esquema permite varias reglas de cantidad por promocion (distintos umbrales);
      // para cada producto asociado se toma la regla que ofrezca mayor descuento.
      for (const productoAsociado of productosAsociados) {
        for (const regla of reglas) {
          const reglaNueva: ReglaDeCantidadParaCalculo = {
            cantidadMinima: regla.cantidadMinima,
            tipoDescuento: regla.tipoDescuento,
            valorDescuento: Number(regla.valorDescuento),
            nombreDeLaPromocion: promocion.nombre,
            acumulable: promocion.acumulable
          };

          const reglaYaAsignada = mapa.get(productoAsociado.idProducto);
          const estaOfreceMasDescuento =
            reglaYaAsignada === undefined || reglaNueva.valorDescuento > reglaYaAsignada.valorDescuento;

          if (estaOfreceMasDescuento) {
            mapa.set(productoAsociado.idProducto, reglaNueva);
          }
        }
      }
    }

    return mapa;
  }

  private construirListaDeReglasDeMontoPedido(promociones: Promocion[]): ReglaDeMontoPedidoParaCalculo[] {
    const lista: ReglaDeMontoPedidoParaCalculo[] = [];

    for (const promocion of promociones) {
      const esDeTipoMontoPedido =
        promocion.tipoPromocion === 'DescuentoPorMontoPedido' || promocion.tipoPromocion === 'ProductoGratisPorMonto';

      if (!esDeTipoMontoPedido) {
        continue;
      }

      for (const regla of promocion.reglasDeMontoPedido ?? []) {
        lista.push({
          montoMinimoPedido: Number(regla.montoMinimoPedido),
          tipoBeneficio: regla.tipoBeneficio,
          valorDescuento: regla.valorDescuento !== null ? Number(regla.valorDescuento) : null,
          productoRegalo: regla.productoRegalo,
          nombreDeLaPromocion: promocion.nombre,
          acumulable: promocion.acumulable
        });
      }
    }

    return lista;
  }
}
