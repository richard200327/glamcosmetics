import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { ReservasService } from '../reservas/reservas.service';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Producto } from '../../comun/entidades';
import { MotorDePromocionesService, ResultadoDeEvaluacionDePromociones } from '../promociones/motor-de-promociones.service';
import { obtenerFechaLocalDeHoy, redondearMoneda } from '../../comun/utilidades/fechas';
import { DescuentoManualDto, EvaluarLineasDto, TipoDeDescuentoManual } from './dto/pedido.dto';

export interface LineaDelPedidoCalculada {
  idProducto: number;
  descripcionDelProducto: string;
  cantidad: number;
  precioDeLista: number;
  precioUnitarioAplicado: number;
  subtotalAntesDelDescuentoManual: number;
  descuentoManual: number;
  tipoDescuentoManual: TipoDeDescuentoManual | null;
  valorDescuentoManual: number;
  subtotalDeLaLinea: number;
  costoUnitarioAplicado: number;
  nombreDePromocionAplicadaEnLinea: string | null;
  seUsoPrecioAlMayorEnEstaLinea: boolean;
  esRegalo: boolean;
  esRegaloDePromocion: boolean;
  quedaPorDebajoDelCosto: boolean;
}

export interface ResultadoDelPedidoCalculado {
  lineas: LineaDelPedidoCalculada[];
  subtotalAPrecioDeLista: number;
  subtotalAntesDelDescuentoPorMonto: number;
  nombreDePromocionAplicadaPorMonto: string | null;
  montoDescontadoPorMonto: number;
  productoDeRegaloAgregado: { idProducto: number; descripcion: string; costoPromedio: number } | null;
  montoTotalDescontado: number;
  montoDescuentoManualEnLineas: number;
  descuentoManualGlobal: number;
  montoTotalDescuentoManual: number;
  valorDeRegalosAPrecioDeLista: number;
  costoDeRegalos: number;
  costoTotal: number;
  gananciaEstimada: number;
  margenEstimado: number;
  ventaPorDebajoDelCosto: boolean;
  totalFinal: number;
  resumenDePromocionesAplicadas: string[];
  advertencias: string[];
}

const RESULTADO_VACIO_DEL_MOTOR: ResultadoDeEvaluacionDePromociones = {
  lineas: [],
  subtotalAntesDelDescuentoPorMonto: 0,
  nombreDePromocionAplicadaPorMonto: null,
  montoDescontadoPorMonto: 0,
  productoDeRegaloAgregado: null,
  montoTotalDescontado: 0,
  totalFinal: 0,
  resumenDePromocionesAplicadas: []
};

@Injectable()
export class CalculadoraDePedidoService {
  constructor(
    @InjectRepository(Producto)
    private readonly repositorioDeProductos: Repository<Producto>,
    private readonly motorDePromocionesService: MotorDePromocionesService,
    @Optional() private readonly reservasService?: ReservasService
  ) {}

  public async calcular(datos: EvaluarLineasDto): Promise<ResultadoDelPedidoCalculado> {
    const idsDeProductos = Array.from(new Set(datos.detalles.map((linea) => linea.idProducto)));
    const productos = await this.repositorioDeProductos.find({ where: { idProducto: In(idsDeProductos) } });
    const mapaDeProductos = new Map(productos.map((producto) => [producto.idProducto, producto]));

    const cantidadesSolicitadas = new Map<number, number>();

    for (const linea of datos.detalles) {
      const producto = mapaDeProductos.get(linea.idProducto);

      if (producto === undefined) {
        throw new NotFoundException(`No se encontro el producto con id ${linea.idProducto}.`);
      }
      if (!producto.activo) {
        throw new BadRequestException(`"${producto.descripcion}" esta inactivo y no se puede vender.`);
      }

      cantidadesSolicitadas.set(linea.idProducto, (cantidadesSolicitadas.get(linea.idProducto) ?? 0) + linea.cantidad);
    }

    const reservas = this.reservasService
      ? await this.reservasService.obtenerReservas([...cantidadesSolicitadas.keys()], datos.idPedidoWeb ?? null)
      : new Map<number, number>();

    for (const [idProducto, cantidad] of cantidadesSolicitadas.entries()) {
      const producto = mapaDeProductos.get(idProducto) as Producto;
      const apartado = reservas.get(idProducto) ?? 0;
      if (producto.existencia - apartado < cantidad) {
        throw new BadRequestException(
          apartado > 0
            ? `No hay existencia suficiente de "${producto.descripcion}": hay ${producto.existencia}, pero ${apartado} estan apartadas por pedidos del catalogo. Disponible: ${Math.max(producto.existencia - apartado, 0)}, solicitado: ${cantidad}.`
            : `No hay existencia suficiente de "${producto.descripcion}". Disponible: ${producto.existencia}, solicitado: ${cantidad}.`
        );
      }
    }

    const lineasNormales = datos.detalles.filter((linea) => !linea.esRegalo);

    const resultadoDelMotor =
      lineasNormales.length > 0
        ? await this.motorDePromocionesService.evaluarLineasDelPedido(
            lineasNormales.map((linea) => ({ producto: mapaDeProductos.get(linea.idProducto) as Producto, cantidad: linea.cantidad })),
            obtenerFechaLocalDeHoy()
          )
        : RESULTADO_VACIO_DEL_MOTOR;

    const advertencias: string[] = [];
    const lineas: LineaDelPedidoCalculada[] = [];
    let indiceEnElMotor = 0;

    for (const linea of datos.detalles) {
      const producto = mapaDeProductos.get(linea.idProducto) as Producto;

      if (linea.esRegalo) {
        lineas.push(this.construirLineaDeRegalo(producto, linea.cantidad, null, false));
        continue;
      }

      const lineaDelMotor = resultadoDelMotor.lineas[indiceEnElMotor];
      indiceEnElMotor += 1;

      const subtotalAntes = redondearMoneda(lineaDelMotor.subtotalDeLaLinea);
      const descuentoManual = this.calcularDescuento(linea.tipoDescuentoManual ?? null, linea.valorDescuentoManual ?? 0, subtotalAntes);
      const subtotalFinal = redondearMoneda(subtotalAntes - descuentoManual);
      const costoDeLaLinea = lineaDelMotor.costoUnitarioAplicado * lineaDelMotor.cantidad;

      lineas.push({
        idProducto: lineaDelMotor.idProducto,
        descripcionDelProducto: lineaDelMotor.descripcionDelProducto,
        cantidad: lineaDelMotor.cantidad,
        precioDeLista: lineaDelMotor.precioDeLista,
        precioUnitarioAplicado: lineaDelMotor.precioUnitarioAplicado,
        subtotalAntesDelDescuentoManual: subtotalAntes,
        descuentoManual,
        tipoDescuentoManual: descuentoManual > 0 ? linea.tipoDescuentoManual ?? null : null,
        valorDescuentoManual: descuentoManual > 0 ? linea.valorDescuentoManual ?? 0 : 0,
        subtotalDeLaLinea: subtotalFinal,
        costoUnitarioAplicado: lineaDelMotor.costoUnitarioAplicado,
        nombreDePromocionAplicadaEnLinea: lineaDelMotor.nombreDePromocionAplicadaEnLinea,
        seUsoPrecioAlMayorEnEstaLinea: lineaDelMotor.seUsoPrecioAlMayorEnEstaLinea,
        esRegalo: false,
        esRegaloDePromocion: false,
        quedaPorDebajoDelCosto: subtotalFinal + 0.004 < costoDeLaLinea
      });
    }

    let productoDeRegaloAgregado = resultadoDelMotor.productoDeRegaloAgregado;

    if (productoDeRegaloAgregado !== null) {
      const productoRegalo =
        mapaDeProductos.get(productoDeRegaloAgregado.idProducto) ??
        (await this.repositorioDeProductos.findOne({ where: { idProducto: productoDeRegaloAgregado.idProducto } }));
      const cantidadYaSolicitada = cantidadesSolicitadas.get(productoDeRegaloAgregado.idProducto) ?? 0;

      if (productoRegalo !== null && productoRegalo.activo && productoRegalo.existencia >= cantidadYaSolicitada + 1) {
        lineas.push(this.construirLineaDeRegalo(productoRegalo, 1, resultadoDelMotor.nombreDePromocionAplicadaPorMonto, true));
      } else {
        advertencias.push(
          `La promocion "${resultadoDelMotor.nombreDePromocionAplicadaPorMonto}" incluye un regalo, pero no hay existencia de "${productoDeRegaloAgregado.descripcion}".`
        );
        productoDeRegaloAgregado = null;
      }
    }

    const montoDescuentoManualEnLineas = redondearMoneda(lineas.reduce((suma, linea) => suma + linea.descuentoManual, 0));
    const baseParaDescuentoGlobal = Math.max(redondearMoneda(resultadoDelMotor.totalFinal - montoDescuentoManualEnLineas), 0);
    const descuentoManualGlobal = this.calcularDescuentoGlobal(datos.descuentoGlobal ?? null, baseParaDescuentoGlobal);
    const totalFinal = redondearMoneda(baseParaDescuentoGlobal - descuentoManualGlobal);

    const costoTotal = redondearMoneda(lineas.reduce((suma, linea) => suma + linea.costoUnitarioAplicado * linea.cantidad, 0));
    const lineasDeRegalo = lineas.filter((linea) => linea.esRegalo);
    const valorDeRegalosAPrecioDeLista = redondearMoneda(lineasDeRegalo.reduce((suma, linea) => suma + linea.precioDeLista * linea.cantidad, 0));
    const costoDeRegalos = redondearMoneda(lineasDeRegalo.reduce((suma, linea) => suma + linea.costoUnitarioAplicado * linea.cantidad, 0));
    const subtotalAPrecioDeLista = redondearMoneda(
      lineas.filter((linea) => !linea.esRegalo).reduce((suma, linea) => suma + linea.precioDeLista * linea.cantidad, 0)
    );
    const gananciaEstimada = redondearMoneda(totalFinal - costoTotal);

    return {
      lineas,
      subtotalAPrecioDeLista,
      subtotalAntesDelDescuentoPorMonto: redondearMoneda(resultadoDelMotor.subtotalAntesDelDescuentoPorMonto),
      nombreDePromocionAplicadaPorMonto: resultadoDelMotor.nombreDePromocionAplicadaPorMonto,
      montoDescontadoPorMonto: redondearMoneda(resultadoDelMotor.montoDescontadoPorMonto),
      productoDeRegaloAgregado,
      montoTotalDescontado: redondearMoneda(resultadoDelMotor.montoTotalDescontado),
      montoDescuentoManualEnLineas,
      descuentoManualGlobal,
      montoTotalDescuentoManual: redondearMoneda(montoDescuentoManualEnLineas + descuentoManualGlobal),
      valorDeRegalosAPrecioDeLista,
      costoDeRegalos,
      costoTotal,
      gananciaEstimada,
      margenEstimado: totalFinal > 0 ? redondearMoneda((gananciaEstimada / totalFinal) * 100) : 0,
      ventaPorDebajoDelCosto: gananciaEstimada < 0,
      totalFinal,
      resumenDePromocionesAplicadas: resultadoDelMotor.resumenDePromocionesAplicadas,
      advertencias
    };
  }

  private construirLineaDeRegalo(
    producto: Producto,
    cantidad: number,
    nombreDeLaPromocion: string | null,
    esRegaloDePromocion: boolean
  ): LineaDelPedidoCalculada {
    return {
      idProducto: producto.idProducto,
      descripcionDelProducto: producto.descripcion,
      cantidad,
      precioDeLista: producto.precioUnitario,
      precioUnitarioAplicado: 0,
      subtotalAntesDelDescuentoManual: 0,
      descuentoManual: 0,
      tipoDescuentoManual: null,
      valorDescuentoManual: 0,
      subtotalDeLaLinea: 0,
      costoUnitarioAplicado: producto.costoPromedio,
      nombreDePromocionAplicadaEnLinea: nombreDeLaPromocion ?? 'Regalo',
      seUsoPrecioAlMayorEnEstaLinea: false,
      esRegalo: true,
      esRegaloDePromocion,
      quedaPorDebajoDelCosto: false
    };
  }

  private calcularDescuento(tipo: TipoDeDescuentoManual | null, valor: number, base: number): number {
    if (tipo === null || valor <= 0 || base <= 0) {
      return 0;
    }

    if (tipo === 'Porcentaje') {
      if (valor > 100) {
        throw new BadRequestException('Un descuento en porcentaje no puede ser mayor a 100%.');
      }
      return redondearMoneda(base * (valor / 100));
    }

    return redondearMoneda(Math.min(valor, base));
  }

  private calcularDescuentoGlobal(descuento: DescuentoManualDto | null, base: number): number {
    if (descuento === null) {
      return 0;
    }
    return this.calcularDescuento(descuento.tipo, descuento.valor, base);
  }
}
