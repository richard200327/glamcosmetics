import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { DetallePago, RegistroPago } from '../../comun/entidades';
import { CuentasService } from '../cuentas/cuentas.service';
import { TasasDeCambioService } from '../tasas-de-cambio/tasas-de-cambio.service';
import { AnularPagoDto, RegistrarPagoDto } from './dto/pago.dto';
import { LoggerDeAplicacion } from '../../comun/logger/logger-de-aplicacion';
import { obtenerFechaLocalDeHoy, redondearMoneda } from '../../comun/utilidades/fechas';

export interface AbonoAplicadoACuenta {
  pago: RegistroPago;
  montoAplicado: number;
  montoPagadoEnBolivares: number;
  nombreDelMetodoPago: string;
}

export interface FiltrosDePagos {
  idCliente?: number;
  idProveedor?: number;
  tipo?: 'Cobros' | 'PagosAProveedores';
  fechaDesde?: string;
  fechaHasta?: string;
  pagina?: number;
  limite?: number;
}

@Injectable()
export class PagosService {
  private readonly logger = new LoggerDeAplicacion('PagosService');

  constructor(
    @InjectRepository(RegistroPago)
    private readonly repositorioDePagos: Repository<RegistroPago>,
    @InjectRepository(DetallePago)
    private readonly repositorioDeDetalles: Repository<DetallePago>,
    private readonly cuentasService: CuentasService,
    private readonly tasasDeCambioService: TasasDeCambioService,
    private readonly dataSource: DataSource
  ) {}

  public async obtenerListaDePagos(filtros: FiltrosDePagos = {}): Promise<RegistroPago[]> {
    const limite = Math.min(filtros.limite ?? 100, 500);
    const pagina = Math.max(filtros.pagina ?? 1, 1);

    const consulta = this.repositorioDePagos
      .createQueryBuilder('pago')
      .leftJoinAndSelect('pago.usuario', 'usuario')
      .leftJoinAndSelect('pago.cliente', 'cliente')
      .leftJoinAndSelect('pago.proveedor', 'proveedor')
      .leftJoinAndSelect('pago.detalles', 'detalles')
      .leftJoinAndSelect('detalles.metodoPago', 'metodoPago')
      .leftJoinAndSelect('detalles.cuenta', 'cuenta')
      .orderBy('pago.fecha', 'DESC')
      .skip((pagina - 1) * limite)
      .take(limite);

    if (filtros.idCliente) {
      consulta.andWhere('pago.idCliente = :idCliente', { idCliente: filtros.idCliente });
    }
    if (filtros.idProveedor) {
      consulta.andWhere('pago.idProveedor = :idProveedor', { idProveedor: filtros.idProveedor });
    }
    if (filtros.tipo === 'Cobros') {
      consulta.andWhere('pago.idProveedor IS NULL');
    }
    if (filtros.tipo === 'PagosAProveedores') {
      consulta.andWhere('pago.idProveedor IS NOT NULL');
    }
    if (filtros.fechaDesde) {
      consulta.andWhere('pago.fecha >= :fechaDesde', { fechaDesde: filtros.fechaDesde });
    }
    if (filtros.fechaHasta) {
      consulta.andWhere('pago.fecha <= :fechaHasta', { fechaHasta: `${filtros.fechaHasta} 23:59:59` });
    }

    return consulta.getMany();
  }

  public async obtenerAbonosAplicadosACuenta(idCuenta: number): Promise<AbonoAplicadoACuenta[]> {
    const detalles = await this.repositorioDeDetalles
      .createQueryBuilder('detalle')
      .innerJoinAndSelect('detalle.pago', 'pago')
      .leftJoinAndSelect('pago.usuario', 'usuario')
      .leftJoinAndSelect('pago.cliente', 'cliente')
      .leftJoinAndSelect('pago.proveedor', 'proveedor')
      .leftJoinAndSelect('pago.detalles', 'detallesDelPago')
      .leftJoinAndSelect('detallesDelPago.metodoPago', 'metodoDelPago')
      .leftJoinAndSelect('detalle.metodoPago', 'metodoPago')
      .where('detalle.idCuenta = :idCuenta', { idCuenta })
      .andWhere('pago.anulado = false')
      .orderBy('pago.fecha', 'DESC')
      .getMany();

    return detalles.map((detalle) => ({
      pago: detalle.pago,
      montoAplicado: Number(detalle.montoAplicado),
      montoPagadoEnBolivares: Number(detalle.montoPagadoEnBolivares),
      nombreDelMetodoPago: detalle.metodoPago?.nombre ?? ''
    }));
  }

  public async obtenerPagoPorId(idPago: number, manager: EntityManager = this.repositorioDePagos.manager): Promise<RegistroPago> {
    const pago = await manager.findOne(RegistroPago, { where: { idPago }, relations: { proveedor: true } });

    if (pago === null) {
      throw new NotFoundException(`No se encontro el pago con id ${idPago}.`);
    }

    return pago;
  }

  public async registrarPago(datos: RegistrarPagoDto, idUsuario: number, claveDeIdempotencia: string | null = null): Promise<RegistroPago> {
    if (claveDeIdempotencia !== null) {
      const pagoExistente = await this.repositorioDePagos.findOne({ where: { claveDeIdempotencia } });
      if (pagoExistente !== null) {
        this.logger.log('Pago reprocesado por clave de idempotencia', { idPago: pagoExistente.idPago, claveDeIdempotencia });
        return pagoExistente;
      }
    }

    return this.dataSource.transaction((manager) => this.registrarPagoEnTransaccion(manager, datos, idUsuario, claveDeIdempotencia));
  }

  public async registrarPagoEnTransaccion(
    manager: EntityManager,
    datos: RegistrarPagoDto,
    idUsuario: number,
    claveDeIdempotencia: string | null = null
  ): Promise<RegistroPago> {
    const idCliente = datos.idCliente ?? null;
    const idProveedor = datos.idProveedor ?? null;

    if ((idCliente === null) === (idProveedor === null)) {
      throw new BadRequestException('Indica el cliente (cobro) o el proveedor (pago), pero no ambos.');
    }

    const tasaVigente = await this.tasasDeCambioService.obtenerTasaVigenteParaFecha(obtenerFechaLocalDeHoy());
    const montosPorCuenta = new Map<number, number>();

    for (const linea of datos.detalles) {
      montosPorCuenta.set(linea.idCuenta, redondearMoneda((montosPorCuenta.get(linea.idCuenta) ?? 0) + linea.montoAplicado));
    }

    for (const [idCuenta, montoTotalDeLaCuenta] of montosPorCuenta.entries()) {
      const filas: { SaldoPendiente: string; Estado: string; IdCliente: number | null; IdProveedor: number | null; TipoCuenta: string }[] =
        await manager.query(
          'SELECT SaldoPendiente, Estado, IdCliente, IdProveedor, TipoCuenta FROM CuentaPorCobrarPagar WHERE IdCuenta = ? FOR UPDATE',
          [idCuenta]
        );

      if (filas.length === 0) {
        throw new NotFoundException(`No se encontro la cuenta #${idCuenta}.`);
      }

      const cuenta = filas[0];

      if (cuenta.Estado === 'Anulada') {
        throw new BadRequestException(`La cuenta #${idCuenta} esta anulada y no admite pagos.`);
      }
      if (idCliente !== null && (cuenta.TipoCuenta !== 'CXC' || Number(cuenta.IdCliente) !== idCliente)) {
        throw new BadRequestException(`La cuenta #${idCuenta} no pertenece a este cliente.`);
      }
      if (idProveedor !== null && (cuenta.TipoCuenta !== 'CXP' || Number(cuenta.IdProveedor) !== idProveedor)) {
        throw new BadRequestException(`La cuenta #${idCuenta} no pertenece a este proveedor.`);
      }
      if (montoTotalDeLaCuenta > Number(cuenta.SaldoPendiente) + 0.004) {
        throw new BadRequestException(
          `El monto aplicado a la cuenta #${idCuenta} ($${montoTotalDeLaCuenta.toFixed(2)}) supera su saldo pendiente ($${Number(cuenta.SaldoPendiente).toFixed(2)}).`
        );
      }
    }

    let montoTotal = 0;
    const detalles: Partial<DetallePago>[] = [];

    for (const linea of datos.detalles) {
      montoTotal = redondearMoneda(montoTotal + linea.montoAplicado);
      detalles.push({
        idCuenta: linea.idCuenta,
        idMetodoPago: linea.idMetodoPago,
        montoAplicado: linea.montoAplicado,
        montoPagadoEnBolivares: redondearMoneda(linea.montoAplicado * tasaVigente.valorTasaBcv)
      });
    }

    for (const [idCuenta, monto] of montosPorCuenta.entries()) {
      await this.cuentasService.aplicarAbonoACuenta(idCuenta, monto, manager);
    }

    const pagoNuevo = manager.create(RegistroPago, {
      claveDeIdempotencia,
      idUsuario,
      idCliente,
      idProveedor,
      montoTotal,
      valorTasaBcvUsada: tasaVigente.valorTasaBcv,
      montoTotalEnBolivares: redondearMoneda(montoTotal * tasaVigente.valorTasaBcv),
      observaciones: datos.observaciones ?? null,
      modoDeAplicacion: datos.modoDeAplicacion,
      anulado: false,
      detalles: detalles as DetallePago[]
    });

    const pagoGuardado = await manager.save(pagoNuevo);
    this.logger.log('Pago registrado', { idPago: pagoGuardado.idPago, idCliente, idProveedor, montoTotal });

    return this.obtenerPagoPorId(pagoGuardado.idPago, manager);
  }

  public async anularPago(idPago: number, datos: AnularPagoDto): Promise<RegistroPago> {
    return this.dataSource.transaction((manager) => this.anularPagoEnTransaccion(manager, idPago, datos.motivoDeAnulacion));
  }

  public async anularPagoEnTransaccion(manager: EntityManager, idPago: number, motivo: string): Promise<RegistroPago> {
    const pago = await this.obtenerPagoPorId(idPago, manager);

    const resultado = await manager.query(
      `UPDATE RegistroPago SET Anulado = 1, MotivoDeAnulacion = ?, FechaDeAnulacion = NOW() WHERE IdPago = ? AND Anulado = 0`,
      [motivo, idPago]
    );

    if (resultado.affectedRows === 0) {
      return pago;
    }

    const montosPorCuenta = new Map<number, number>();
    for (const detalle of pago.detalles) {
      montosPorCuenta.set(detalle.idCuenta, redondearMoneda((montosPorCuenta.get(detalle.idCuenta) ?? 0) + Number(detalle.montoAplicado)));
    }

    for (const [idCuenta, monto] of montosPorCuenta.entries()) {
      await this.cuentasService.revertirAbonoACuenta(idCuenta, monto, manager);
    }

    this.logger.warn('Pago anulado', { idPago, motivo });
    return this.obtenerPagoPorId(idPago, manager);
  }

  public async obtenerPagosActivosDeCuenta(manager: EntityManager, idCuenta: number): Promise<RegistroPago[]> {
    const filas: { IdPago: number }[] = await manager.query(
      `SELECT DISTINCT rp.IdPago FROM RegistroPago rp INNER JOIN DetallePago dp ON dp.IdPago = rp.IdPago WHERE dp.IdCuenta = ? AND rp.Anulado = 0`,
      [idCuenta]
    );

    const pagos: RegistroPago[] = [];
    for (const fila of filas) {
      pagos.push(await this.obtenerPagoPorId(Number(fila.IdPago), manager));
    }
    return pagos;
  }
}
