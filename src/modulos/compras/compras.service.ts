import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Compra, CuentaPorCobrarPagar, DetalleCompra, Producto, Proveedor } from '../../comun/entidades';
import { KardexService } from '../productos/kardex.service';
import { CuentasService } from '../cuentas/cuentas.service';
import { PagosService } from '../pagos/pagos.service';
import { TasasDeCambioService } from '../tasas-de-cambio/tasas-de-cambio.service';
import { LoggerDeAplicacion } from '../../comun/logger/logger-de-aplicacion';
import { obtenerFechaLocalDeHoy, redondearCosto, redondearMoneda, sumarDiasAFecha } from '../../comun/utilidades/fechas';
import { AnularCompraDto, CrearCompraDto } from './dto/compra.dto';

export interface FiltrosDeCompras {
  idProveedor?: number;
  estado?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  pagina?: number;
  limite?: number;
}

export interface CompraConCuenta extends Compra {
  idCuenta: number | null;
  saldoPendiente: number;
  fechaVencimiento: Date | null;
}

@Injectable()
export class ComprasService {
  private readonly logger = new LoggerDeAplicacion('ComprasService');

  constructor(
    @InjectRepository(Compra)
    private readonly repositorioDeCompras: Repository<Compra>,
    @InjectRepository(Producto)
    private readonly repositorioDeProductos: Repository<Producto>,
    @InjectRepository(Proveedor)
    private readonly repositorioDeProveedores: Repository<Proveedor>,
    private readonly kardexService: KardexService,
    private readonly cuentasService: CuentasService,
    private readonly pagosService: PagosService,
    private readonly tasasDeCambioService: TasasDeCambioService,
    private readonly dataSource: DataSource
  ) {}

  public async obtenerListaDeCompras(filtros: FiltrosDeCompras = {}): Promise<CompraConCuenta[]> {
    const limite = Math.min(filtros.limite ?? 100, 500);
    const pagina = Math.max(filtros.pagina ?? 1, 1);

    const consulta = this.repositorioDeCompras
      .createQueryBuilder('compra')
      .leftJoinAndSelect('compra.proveedor', 'proveedor')
      .leftJoinAndSelect('compra.usuario', 'usuario')
      .leftJoinAndSelect('compra.detalles', 'detalles')
      .leftJoinAndSelect('detalles.producto', 'producto')
      .orderBy('compra.fecha', 'DESC')
      .skip((pagina - 1) * limite)
      .take(limite);

    if (filtros.idProveedor) {
      consulta.andWhere('compra.idProveedor = :idProveedor', { idProveedor: filtros.idProveedor });
    }
    if (filtros.estado) {
      consulta.andWhere('compra.estado = :estado', { estado: filtros.estado });
    }
    if (filtros.fechaDesde) {
      consulta.andWhere('compra.fecha >= :fechaDesde', { fechaDesde: filtros.fechaDesde });
    }
    if (filtros.fechaHasta) {
      consulta.andWhere('compra.fecha <= :fechaHasta', { fechaHasta: `${filtros.fechaHasta} 23:59:59` });
    }

    const compras = await consulta.getMany();

    if (compras.length === 0) {
      return [];
    }

    const cuentas = await this.dataSource.getRepository(CuentaPorCobrarPagar).find({
      where: { idCompra: In(compras.map((compra) => compra.idCompra)) }
    });
    const mapaDeCuentas = new Map(cuentas.map((cuenta) => [cuenta.idCompra as number, cuenta]));

    return compras.map((compra) => this.combinarConCuenta(compra, mapaDeCuentas.get(compra.idCompra) ?? null));
  }

  public async obtenerCompraPorId(idCompra: number): Promise<CompraConCuenta> {
    const compra = await this.repositorioDeCompras.findOne({ where: { idCompra } });

    if (compra === null) {
      throw new NotFoundException(`No se encontro la compra con id ${idCompra}.`);
    }

    const cuenta = await this.cuentasService.obtenerCuentaPorIdCompra(idCompra);
    return this.combinarConCuenta(compra, cuenta);
  }

  public async obtenerUltimosCostosPorProducto(idProducto: number) {
    const filas = await this.dataSource
      .getRepository(DetalleCompra)
      .createQueryBuilder('detalle')
      .innerJoinAndSelect('detalle.compra', 'compra')
      .leftJoinAndSelect('compra.proveedor', 'proveedor')
      .where('detalle.idProducto = :idProducto', { idProducto })
      .andWhere("compra.estado != 'Anulada'")
      .orderBy('compra.fecha', 'DESC')
      .take(10)
      .getMany();

    return filas.map((detalle) => ({
      idCompra: detalle.idCompra,
      fecha: detalle.compra.fecha,
      nombreDelProveedor: detalle.compra.proveedor?.nombre ?? '',
      cantidad: detalle.cantidad,
      costoUnitario: detalle.costoUnitario,
      costoUnitarioFinal: detalle.costoUnitarioFinal
    }));
  }

  public async crearCompra(datos: CrearCompraDto, idUsuario: number, claveDeIdempotencia: string | null): Promise<CompraConCuenta> {
    if (claveDeIdempotencia !== null) {
      const compraExistente = await this.repositorioDeCompras.findOne({ where: { claveDeIdempotencia } });
      if (compraExistente !== null) {
        return this.obtenerCompraPorId(compraExistente.idCompra);
      }
    }

    const proveedor = await this.repositorioDeProveedores.findOne({ where: { idProveedor: datos.idProveedor } });
    if (proveedor === null) {
      throw new NotFoundException('El proveedor seleccionado no existe.');
    }
    if (!proveedor.activo) {
      throw new BadRequestException(`El proveedor "${proveedor.nombre}" esta inactivo.`);
    }

    const idsDeProductos = Array.from(new Set(datos.detalles.map((linea) => linea.idProducto)));
    const productos = await this.repositorioDeProductos.find({ where: { idProducto: In(idsDeProductos) } });
    if (productos.length !== idsDeProductos.length) {
      throw new NotFoundException('Uno o mas productos de la compra no existen.');
    }

    const subtotal = redondearMoneda(datos.detalles.reduce((suma, linea) => suma + linea.cantidad * linea.costoUnitario, 0));
    const montoDeDescuento = redondearMoneda(datos.montoDeDescuento ?? 0);
    const gastosAdicionales = redondearMoneda(datos.gastosAdicionales ?? 0);

    if (montoDeDescuento > subtotal) {
      throw new BadRequestException('El descuento del proveedor no puede ser mayor que el subtotal de la compra.');
    }

    const total = redondearMoneda(subtotal - montoDeDescuento + gastosAdicionales);
    const factorDeAjuste = subtotal > 0 ? (subtotal - montoDeDescuento + gastosAdicionales) / subtotal : 1;
    const pagos = datos.pagosDeContado ?? [];
    const sumaDePagos = redondearMoneda(pagos.reduce((suma, pago) => suma + pago.monto, 0));

    if (datos.esContado && total > 0 && pagos.length === 0) {
      throw new BadRequestException('Indica con que metodo(s) se pago la compra de contado.');
    }
    if (sumaDePagos > total + 0.009) {
      throw new BadRequestException(`Los pagos ($${sumaDePagos.toFixed(2)}) superan el total de la compra ($${total.toFixed(2)}).`);
    }
    if (datos.esContado && total > 0 && sumaDePagos < total - 0.009) {
      throw new BadRequestException(`Faltan $${(total - sumaDePagos).toFixed(2)} para completar el pago de contado.`);
    }

    let tasaBcv: number | null = null;
    try {
      tasaBcv = (await this.tasasDeCambioService.obtenerTasaVigenteParaFecha(obtenerFechaLocalDeHoy())).valorTasaBcv;
    } catch {
      if (pagos.length > 0) {
        throw new BadRequestException('Registra la tasa de cambio de hoy antes de registrar pagos de la compra.');
      }
    }

    const idCompra = await this.dataSource.transaction(async (manager) => {
      await this.kardexService.bloquearProductos(manager, idsDeProductos);

      const compraGuardada = await manager.save(
        manager.create(Compra, {
          claveDeIdempotencia,
          idProveedor: datos.idProveedor,
          idUsuario,
          numeroDeFactura: datos.numeroDeFactura?.trim() || null,
          fechaDeFactura: datos.fechaDeFactura || null,
          estado: total > 0 ? 'Pendiente' : 'Pagada',
          esContado: datos.esContado,
          subtotal,
          montoDeDescuento,
          gastosAdicionales,
          total,
          valorTasaBcvUsada: tasaBcv,
          montoEnBolivaresBcv: tasaBcv !== null ? redondearMoneda(total * tasaBcv) : null,
          observaciones: datos.observaciones?.trim() || null,
          detalles: []
        })
      );

      for (const linea of datos.detalles) {
        const costoUnitarioFinal = redondearCosto(linea.costoUnitario * factorDeAjuste);

        const entrada = await this.kardexService.registrarEntrada(manager, {
          idProducto: linea.idProducto,
          cantidad: linea.cantidad,
          costoUnitario: costoUnitarioFinal,
          origen: 'Compra',
          idReferencia: compraGuardada.idCompra,
          idUsuario,
          observaciones: `Compra #${compraGuardada.idCompra} a ${proveedor.nombre}${compraGuardada.numeroDeFactura ? ` (factura ${compraGuardada.numeroDeFactura})` : ''}`
        });

        await manager.insert(DetalleCompra, {
          idCompra: compraGuardada.idCompra,
          idProducto: linea.idProducto,
          cantidad: linea.cantidad,
          costoUnitario: linea.costoUnitario,
          costoUnitarioFinal,
          subtotal: redondearMoneda(linea.cantidad * linea.costoUnitario),
          existenciaAnterior: entrada.existenciaAnterior,
          costoPromedioAnterior: entrada.costoPromedioAnterior,
          costoPromedioResultante: entrada.costoPromedioResultante
        });

        if (linea.nuevoPrecioDeVenta !== undefined && linea.nuevoPrecioDeVenta !== null && linea.nuevoPrecioDeVenta > 0) {
          await manager.update(Producto, { idProducto: linea.idProducto }, { precioUnitario: linea.nuevoPrecioDeVenta });
        }
      }

      if (total > 0) {
        const diasDeCredito = datos.esContado ? 0 : datos.diasDeCredito ?? proveedor.diasDeCredito ?? 0;

        const cuentaGuardada = await manager.save(
          manager.create(CuentaPorCobrarPagar, {
            idCompra: compraGuardada.idCompra,
            idProveedor: datos.idProveedor,
            tipoCuenta: 'CXP',
            montoOriginal: total,
            saldoPendiente: total,
            fechaVencimiento: sumarDiasAFecha(new Date(), diasDeCredito),
            estado: 'Pendiente'
          })
        );

        if (pagos.length > 0) {
          const pagosAjustados =
            datos.esContado && Math.abs(sumaDePagos - total) <= 0.009 && sumaDePagos !== total
              ? [...pagos.slice(0, -1), { ...pagos[pagos.length - 1], monto: redondearMoneda(pagos[pagos.length - 1].monto + (total - sumaDePagos)) }]
              : pagos;

          await this.pagosService.registrarPagoEnTransaccion(
            manager,
            {
              idProveedor: datos.idProveedor,
              modoDeAplicacion: 'ContadoDirecto',
              observaciones: datos.esContado ? `Pago de contado de la compra #${compraGuardada.idCompra}` : `Abono inicial de la compra #${compraGuardada.idCompra}`,
              detalles: pagosAjustados.map((pago) => ({
                idCuenta: cuentaGuardada.idCuenta,
                idMetodoPago: pago.idMetodoPago,
                montoAplicado: pago.monto
              }))
            },
            idUsuario
          );
        }
      }

      return compraGuardada.idCompra;
    });

    this.logger.log('Compra registrada', { idCompra, idProveedor: datos.idProveedor, total, idUsuario });
    return this.obtenerCompraPorId(idCompra);
  }

  public async anularCompra(idCompra: number, datos: AnularCompraDto, idUsuario: number): Promise<CompraConCuenta> {
    const compra = await this.obtenerCompraPorId(idCompra);

    await this.dataSource.transaction(async (manager) => {
      const resultado = await manager.query(
        `UPDATE Compra SET Estado = 'Anulada', MotivoDeAnulacion = ?, FechaDeAnulacion = NOW() WHERE IdCompra = ? AND Estado != 'Anulada'`,
        [datos.motivo.trim(), idCompra]
      );

      if (resultado.affectedRows === 0) {
        return;
      }

      await this.kardexService.bloquearProductos(manager, compra.detalles.map((detalle) => detalle.idProducto));

      const cuenta = await this.cuentasService.obtenerCuentaPorIdCompra(idCompra, manager);

      if (cuenta !== null) {
        const pagosActivos = await this.pagosService.obtenerPagosActivosDeCuenta(manager, cuenta.idCuenta);
        const abonosPosteriores = pagosActivos.filter((pago) => pago.modoDeAplicacion !== 'ContadoDirecto');

        if (abonosPosteriores.length > 0) {
          throw new BadRequestException(
            `Esta compra tiene pagos al proveedor registrados (pago ${abonosPosteriores.map((pago) => `#${pago.idPago}`).join(', ')}). Anula esos pagos primero.`
          );
        }

        for (const pago of pagosActivos) {
          await this.pagosService.anularPagoEnTransaccion(manager, pago.idPago, `Anulacion de la compra #${idCompra}`);
        }

        await this.cuentasService.anularCuenta(cuenta.idCuenta, manager);
      }

      for (const detalle of compra.detalles) {
        await this.kardexService.revertirEntrada(manager, {
          idProducto: detalle.idProducto,
          cantidad: detalle.cantidad,
          costoUnitario: detalle.costoUnitarioFinal,
          origen: 'AnulacionCompra',
          idReferencia: idCompra,
          idUsuario,
          observaciones: `Anulacion de la compra #${idCompra}: ${datos.motivo.trim()}`
        });
      }
    });

    this.logger.warn('Compra anulada', { idCompra, motivo: datos.motivo });
    return this.obtenerCompraPorId(idCompra);
  }

  private combinarConCuenta(compra: Compra, cuenta: CuentaPorCobrarPagar | null): CompraConCuenta {
    return {
      ...compra,
      idCuenta: cuenta?.idCuenta ?? null,
      saldoPendiente: cuenta ? cuenta.saldoPendiente : 0,
      fechaVencimiento: cuenta?.fechaVencimiento ?? null
    };
  }
}
