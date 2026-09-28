import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CuentaPorCobrarPagar, DetallePedido, Pedido } from '../../comun/entidades';
import { CuentasService } from '../cuentas/cuentas.service';
import { TasasDeCambioService } from '../tasas-de-cambio/tasas-de-cambio.service';
import { KardexService } from '../productos/kardex.service';
import { PagosService } from '../pagos/pagos.service';
import { LoggerDeAplicacion } from '../../comun/logger/logger-de-aplicacion';
import { obtenerFechaLocalDeHoy, redondearMoneda, sumarDiasAFecha } from '../../comun/utilidades/fechas';
import { CalculadoraDePedidoService, ResultadoDelPedidoCalculado } from './calculadora-de-pedido.service';
import { CrearPedidoDto, EvaluarLineasDto, PagoDeContadoDto } from './dto/pedido.dto';

export interface RespuestaDePedidoCreado extends Pedido {
  idCuentaGenerada: number;
}

export interface FiltrosDePedidos {
  idCliente?: number;
  estado?: string;
  tipoOperacion?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  pagina?: number;
  limite?: number;
}

@Injectable()
export class PedidosService {
  private readonly logger = new LoggerDeAplicacion('PedidosService');

  constructor(
    @InjectRepository(Pedido)
    private readonly repositorioDePedidos: Repository<Pedido>,
    private readonly tasasDeCambioService: TasasDeCambioService,
    private readonly cuentasService: CuentasService,
    private readonly pagosService: PagosService,
    private readonly kardexService: KardexService,
    private readonly calculadoraDePedidoService: CalculadoraDePedidoService,
    private readonly dataSource: DataSource
  ) {}

  public async obtenerListaDePedidos(filtros: FiltrosDePedidos = {}): Promise<Pedido[]> {
    const limite = Math.min(filtros.limite ?? 100, 500);
    const pagina = Math.max(filtros.pagina ?? 1, 1);

    const consulta = this.repositorioDePedidos
      .createQueryBuilder('pedido')
      .leftJoinAndSelect('pedido.cliente', 'cliente')
      .leftJoinAndSelect('pedido.usuario', 'usuario')
      .leftJoinAndSelect('pedido.detalles', 'detalles')
      .leftJoinAndSelect('detalles.producto', 'producto')
      .orderBy('pedido.fecha', 'DESC')
      .skip((pagina - 1) * limite)
      .take(limite);

    if (filtros.idCliente) {
      consulta.andWhere('pedido.idCliente = :idCliente', { idCliente: filtros.idCliente });
    }
    if (filtros.estado) {
      consulta.andWhere('pedido.estado = :estado', { estado: filtros.estado });
    }
    if (filtros.tipoOperacion) {
      consulta.andWhere('pedido.tipoOperacion = :tipoOperacion', { tipoOperacion: filtros.tipoOperacion });
    }
    if (filtros.fechaDesde) {
      consulta.andWhere('pedido.fecha >= :fechaDesde', { fechaDesde: filtros.fechaDesde });
    }
    if (filtros.fechaHasta) {
      consulta.andWhere('pedido.fecha <= :fechaHasta', { fechaHasta: `${filtros.fechaHasta} 23:59:59` });
    }

    return consulta.getMany();
  }

  public async obtenerPedidoPorId(idPedido: number): Promise<Pedido & { idCuentaGenerada: number | null; saldoPendiente: number | null }> {
    const pedido = await this.repositorioDePedidos.findOne({ where: { idPedido } });

    if (pedido === null) {
      throw new NotFoundException(`No se encontro el pedido con id ${idPedido}.`);
    }

    const cuenta = await this.cuentasService.obtenerCuentaPorIdPedido(idPedido);
    return { ...pedido, idCuentaGenerada: cuenta?.idCuenta ?? null, saldoPendiente: cuenta ? cuenta.saldoPendiente : null };
  }

  public async evaluarLineas(datos: EvaluarLineasDto): Promise<ResultadoDelPedidoCalculado> {
    return this.calculadoraDePedidoService.calcular(datos);
  }

  public async crearPedido(datos: CrearPedidoDto, idUsuario: number, claveDeIdempotencia: string | null = null): Promise<RespuestaDePedidoCreado> {
    if (claveDeIdempotencia !== null) {
      const pedidoExistente = await this.repositorioDePedidos.findOne({ where: { claveDeIdempotencia } });
      if (pedidoExistente !== null) {
        const cuentaExistente = await this.cuentasService.obtenerCuentaPorIdPedido(pedidoExistente.idPedido);
        this.logger.log('Pedido reprocesado por clave de idempotencia', { idPedido: pedidoExistente.idPedido, claveDeIdempotencia });
        return { ...pedidoExistente, idCuentaGenerada: cuentaExistente?.idCuenta ?? 0 };
      }
    }

    const esContado = datos.tipoOperacion === 'Venta' ? true : datos.esContado;
    const calculo = await this.calculadoraDePedidoService.calcular(datos);
    const tasaVigente = await this.tasasDeCambioService.obtenerTasaVigenteParaFecha(obtenerFechaLocalDeHoy());
    const total = calculo.totalFinal;
    const pagosIniciales = this.resolverPagosIniciales(datos, esContado, total);

    if (calculo.montoTotalDescuentoManual > 0 && !(datos.motivoDelDescuento ?? '').trim()) {
      datos.motivoDelDescuento = 'Descuento otorgado por el vendedor';
    }

    const resultado = await this.dataSource.transaction(async (manager) => {
      await this.kardexService.bloquearProductos(
        manager,
        calculo.lineas.map((linea) => linea.idProducto)
      );

      const pedidoNuevo = manager.create(Pedido, {
        claveDeIdempotencia,
        idCliente: datos.idCliente,
        idUsuario,
        estado: 'Pendiente',
        total,
        montoTotalDescontadoPorPromociones: calculo.montoTotalDescontado,
        resumenDePromocionesAplicadas:
          calculo.resumenDePromocionesAplicadas.length > 0 ? calculo.resumenDePromocionesAplicadas.join('|').substring(0, 500) : null,
        tipoOperacion: datos.tipoOperacion,
        esContado,
        idTasaUsada: tasaVigente.idTasa,
        valorTasaBcvUsada: tasaVigente.valorTasaBcv,
        valorTasaBinanceUsada: tasaVigente.valorTasaBinance,
        montoEnBolivaresBcv: redondearMoneda(total * tasaVigente.valorTasaBcv),
        montoEnBolivaresBinance: redondearMoneda(total * tasaVigente.valorTasaBinance),
        descuentoManualGlobal: calculo.descuentoManualGlobal,
        montoTotalDescuentoManual: calculo.montoTotalDescuentoManual,
        motivoDelDescuento: calculo.montoTotalDescuentoManual > 0 || calculo.valorDeRegalosAPrecioDeLista > 0 ? datos.motivoDelDescuento?.trim() || null : null,
        observaciones: datos.observaciones?.trim() || null,
        detalles: calculo.lineas.map((linea) =>
          manager.create(DetallePedido, {
            idProducto: linea.idProducto,
            cantidad: linea.cantidad,
            precioUnitario: linea.precioUnitarioAplicado,
            precioDeLista: linea.precioDeLista,
            costoUnitarioUsado: linea.costoUnitarioAplicado,
            nombrePromocionAplicadaEnLinea: linea.nombreDePromocionAplicadaEnLinea,
            seUsoPrecioAlMayorEnEstaLinea: linea.seUsoPrecioAlMayorEnEstaLinea,
            esRegalo: linea.esRegalo,
            descuentoManual: linea.descuentoManual,
            subtotal: linea.subtotalDeLaLinea
          })
        )
      });

      const pedidoGuardado = await manager.save(pedidoNuevo);

      for (const detalle of pedidoGuardado.detalles) {
        const salida = await this.kardexService.registrarSalida(manager, {
          idProducto: detalle.idProducto,
          cantidad: detalle.cantidad,
          origen: 'Venta',
          idReferencia: pedidoGuardado.idPedido,
          idUsuario,
          observaciones: `${datos.tipoOperacion} #${pedidoGuardado.idPedido}${detalle.esRegalo ? ' (regalo)' : ''}`
        });

        if (Math.abs(salida.costoUnitarioAplicado - detalle.costoUnitarioUsado) > 0.00005) {
          await manager.update(DetallePedido, { idDetallePedido: detalle.idDetallePedido }, { costoUnitarioUsado: salida.costoUnitarioAplicado });
        }
      }

      const hoy = new Date();
      const diasDeCredito = esContado ? 0 : datos.diasDeCredito ?? 15;
      const cuentaGuardada = await manager.save(
        manager.create(CuentaPorCobrarPagar, {
          idPedido: pedidoGuardado.idPedido,
          idCliente: datos.idCliente,
          tipoCuenta: 'CXC',
          montoOriginal: total,
          saldoPendiente: total,
          fechaVencimiento: sumarDiasAFecha(hoy, diasDeCredito),
          estado: total > 0 ? 'Pendiente' : 'Pagada'
        })
      );

      if (total <= 0) {
        await manager.update(Pedido, { idPedido: pedidoGuardado.idPedido }, { estado: 'Pagado' });
      } else if (pagosIniciales.length > 0) {
        await this.pagosService.registrarPagoEnTransaccion(
          manager,
          {
            idCliente: datos.idCliente,
            modoDeAplicacion: 'ContadoDirecto',
            observaciones: esContado ? `Pago de contado de la venta #${pedidoGuardado.idPedido}` : `Abono inicial del pedido #${pedidoGuardado.idPedido}`,
            detalles: pagosIniciales.map((pago) => ({
              idCuenta: cuentaGuardada.idCuenta,
              idMetodoPago: pago.idMetodoPago,
              montoAplicado: pago.monto
            }))
          },
          idUsuario
        );
      }

      return { idPedido: pedidoGuardado.idPedido, idCuenta: cuentaGuardada.idCuenta };
    });

    this.logger.log('Pedido creado', { idPedido: resultado.idPedido, total, idUsuario });

    const pedidoFinal = await this.obtenerPedidoPorId(resultado.idPedido);
    return { ...pedidoFinal, idCuentaGenerada: resultado.idCuenta };
  }

  public async anularPedido(idPedido: number, motivo: string | undefined, idUsuario: number): Promise<Pedido> {
    const pedido = await this.obtenerPedidoPorId(idPedido);
    const motivoFinal = motivo?.trim() || 'Anulado por el usuario';

    await this.dataSource.transaction(async (manager) => {
      const resultadoDelEstado = await manager.query(
        `UPDATE Pedido SET Estado = 'Anulado', MotivoDeAnulacion = ?, FechaDeAnulacion = NOW() WHERE IdPedido = ? AND Estado != 'Anulado'`,
        [motivoFinal, idPedido]
      );

      if (resultadoDelEstado.affectedRows === 0) {
        return;
      }

      const cuenta = await this.cuentasService.obtenerCuentaPorIdPedido(idPedido, manager);

      if (cuenta !== null) {
        const pagosActivos = await this.pagosService.obtenerPagosActivosDeCuenta(manager, cuenta.idCuenta);
        const abonosPosteriores = pagosActivos.filter((pago) => pago.modoDeAplicacion !== 'ContadoDirecto');

        if (abonosPosteriores.length > 0) {
          throw new BadRequestException(
            `Este pedido tiene abonos registrados (pago ${abonosPosteriores.map((pago) => `#${pago.idPago}`).join(', ')}). Anula esos pagos primero y luego anula el pedido.`
          );
        }

        for (const pago of pagosActivos) {
          await this.pagosService.anularPagoEnTransaccion(manager, pago.idPago, `Anulacion del pedido #${idPedido}`);
        }

        await this.cuentasService.anularCuenta(cuenta.idCuenta, manager);
      }

      for (const detalle of pedido.detalles) {
        await this.kardexService.registrarEntrada(manager, {
          idProducto: detalle.idProducto,
          cantidad: detalle.cantidad,
          costoUnitario: detalle.costoUnitarioUsado,
          origen: 'AnulacionVenta',
          idReferencia: idPedido,
          idUsuario,
          observaciones: `Anulacion del pedido #${idPedido}`
        });
      }
    });

    this.logger.warn('Pedido anulado', { idPedido, motivo: motivoFinal });
    return this.obtenerPedidoPorId(idPedido);
  }

  private resolverPagosIniciales(datos: CrearPedidoDto, esContado: boolean, total: number): PagoDeContadoDto[] {
    const pagos: PagoDeContadoDto[] =
      datos.pagosDeContado && datos.pagosDeContado.length > 0
        ? datos.pagosDeContado
        : datos.idMetodoPago && esContado
          ? [{ idMetodoPago: datos.idMetodoPago, monto: total }]
          : [];

    const sumaDePagos = redondearMoneda(pagos.reduce((suma, pago) => suma + pago.monto, 0));

    if (total <= 0) {
      return [];
    }

    if (esContado && pagos.length === 0) {
      throw new BadRequestException('Selecciona al menos un metodo de pago para la venta de contado.');
    }
    if (sumaDePagos > total + 0.009) {
      throw new BadRequestException(
        `Los pagos suman $${sumaDePagos.toFixed(2)} y el total es $${total.toFixed(2)}. Registra solo lo que se aplica a la venta (el vuelto no se registra).`
      );
    }
    if (esContado && sumaDePagos < total - 0.009) {
      throw new BadRequestException(
        `Faltan $${(total - sumaDePagos).toFixed(2)} para completar el pago de contado. Si el cliente pagara despues, registralo como pedido a credito.`
      );
    }

    if (esContado && Math.abs(sumaDePagos - total) <= 0.009 && sumaDePagos !== total) {
      const ultimo = pagos[pagos.length - 1];
      return [...pagos.slice(0, -1), { ...ultimo, monto: redondearMoneda(ultimo.monto + (total - sumaDePagos)) }];
    }

    return pagos;
  }
}
