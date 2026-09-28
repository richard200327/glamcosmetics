import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { CuentaPorCobrarPagar, Pedido } from '../../comun/entidades';

export interface FiltrosDeCuentas {
  idCliente?: number;
  idProveedor?: number;
  tipoCuenta?: 'CXC' | 'CXP';
  estado?: string;
  soloConSaldo?: boolean;
  fechaDesde?: string;
  fechaHasta?: string;
  pagina?: number;
  limite?: number;
}

export interface ResumenDeCuentas {
  totalPorCobrar: number;
  totalPorPagar: number;
  cantidadPorCobrar: number;
  cantidadPorPagar: number;
  vencidasPorCobrar: number;
  vencidasPorPagar: number;
  montoVencidoPorCobrar: number;
  montoVencidoPorPagar: number;
}

@Injectable()
export class CuentasService {
  constructor(
    @InjectRepository(CuentaPorCobrarPagar)
    private readonly repositorioDeCuentas: Repository<CuentaPorCobrarPagar>,
    @InjectRepository(Pedido)
    private readonly repositorioDePedidos: Repository<Pedido>
  ) {}

  public async marcarCuentasVencidas(): Promise<void> {
    await this.repositorioDeCuentas.manager.query(
      `UPDATE CuentaPorCobrarPagar
       SET Estado = 'Vencida'
       WHERE Estado IN ('Pendiente', 'Parcial') AND SaldoPendiente > 0 AND FechaVencimiento IS NOT NULL AND DATE(FechaVencimiento) < CURDATE()`
    );
  }

  public async obtenerListaDeCuentas(filtros: FiltrosDeCuentas = {}): Promise<CuentaPorCobrarPagar[]> {
    await this.marcarCuentasVencidas();

    const limite = Math.min(filtros.limite ?? 100, 500);
    const pagina = Math.max(filtros.pagina ?? 1, 1);

    const consulta = this.repositorioDeCuentas
      .createQueryBuilder('cuenta')
      .leftJoinAndSelect('cuenta.cliente', 'cliente')
      .leftJoinAndSelect('cuenta.proveedor', 'proveedor')
      .orderBy('cuenta.fechaEmision', 'DESC')
      .skip((pagina - 1) * limite)
      .take(limite);

    if (filtros.idCliente) {
      consulta.andWhere('cuenta.idCliente = :idCliente', { idCliente: filtros.idCliente });
    }
    if (filtros.idProveedor) {
      consulta.andWhere('cuenta.idProveedor = :idProveedor', { idProveedor: filtros.idProveedor });
    }
    if (filtros.tipoCuenta) {
      consulta.andWhere('cuenta.tipoCuenta = :tipoCuenta', { tipoCuenta: filtros.tipoCuenta });
    }
    if (filtros.estado) {
      consulta.andWhere('cuenta.estado = :estado', { estado: filtros.estado });
    }
    if (filtros.soloConSaldo) {
      consulta.andWhere('cuenta.saldoPendiente > 0').andWhere("cuenta.estado != 'Anulada'");
    }
    if (filtros.fechaDesde) {
      consulta.andWhere('cuenta.fechaEmision >= :fechaDesde', { fechaDesde: filtros.fechaDesde });
    }
    if (filtros.fechaHasta) {
      consulta.andWhere('cuenta.fechaEmision <= :fechaHasta', { fechaHasta: `${filtros.fechaHasta} 23:59:59` });
    }

    return consulta.getMany();
  }

  public async obtenerResumen(): Promise<ResumenDeCuentas> {
    await this.marcarCuentasVencidas();

    const filas = await this.repositorioDeCuentas
      .createQueryBuilder('cuenta')
      .select('cuenta.tipoCuenta', 'tipo')
      .addSelect('SUM(cuenta.saldoPendiente)', 'total')
      .addSelect('COUNT(*)', 'cantidad')
      .addSelect("SUM(CASE WHEN cuenta.estado = 'Vencida' THEN 1 ELSE 0 END)", 'vencidas')
      .addSelect("SUM(CASE WHEN cuenta.estado = 'Vencida' THEN cuenta.saldoPendiente ELSE 0 END)", 'montoVencido')
      .where('cuenta.saldoPendiente > 0')
      .andWhere("cuenta.estado != 'Anulada'")
      .groupBy('cuenta.tipoCuenta')
      .getRawMany<{ tipo: string; total: string; cantidad: string; vencidas: string; montoVencido: string }>();

    const cxc = filas.find((fila) => fila.tipo === 'CXC');
    const cxp = filas.find((fila) => fila.tipo === 'CXP');

    return {
      totalPorCobrar: Number(cxc?.total ?? 0),
      totalPorPagar: Number(cxp?.total ?? 0),
      cantidadPorCobrar: Number(cxc?.cantidad ?? 0),
      cantidadPorPagar: Number(cxp?.cantidad ?? 0),
      vencidasPorCobrar: Number(cxc?.vencidas ?? 0),
      vencidasPorPagar: Number(cxp?.vencidas ?? 0),
      montoVencidoPorCobrar: Number(cxc?.montoVencido ?? 0),
      montoVencidoPorPagar: Number(cxp?.montoVencido ?? 0)
    };
  }

  public async obtenerCuentaPorId(idCuenta: number, manager: EntityManager = this.repositorioDeCuentas.manager): Promise<CuentaPorCobrarPagar> {
    const cuenta = await manager.findOne(CuentaPorCobrarPagar, {
      where: { idCuenta },
      relations: { cliente: true, proveedor: true }
    });

    if (cuenta === null) {
      throw new NotFoundException(`No se encontro la cuenta con id ${idCuenta}.`);
    }

    return cuenta;
  }

  public async obtenerCuentaPorIdPedido(idPedido: number, manager: EntityManager = this.repositorioDeCuentas.manager): Promise<CuentaPorCobrarPagar | null> {
    return manager.findOne(CuentaPorCobrarPagar, { where: { idPedido } });
  }

  public async obtenerCuentaPorIdCompra(idCompra: number, manager: EntityManager = this.repositorioDeCuentas.manager): Promise<CuentaPorCobrarPagar | null> {
    return manager.findOne(CuentaPorCobrarPagar, { where: { idCompra }, relations: { proveedor: true } });
  }

  public async aplicarAbonoACuenta(
    idCuenta: number,
    montoAplicado: number,
    manager: EntityManager = this.repositorioDeCuentas.manager
  ): Promise<CuentaPorCobrarPagar> {
    const resultado = await manager.query(
      `UPDATE CuentaPorCobrarPagar
       SET Estado = CASE WHEN SaldoPendiente - ? <= 0.004 THEN 'Pagada' ELSE 'Parcial' END,
           SaldoPendiente = GREATEST(ROUND(SaldoPendiente - ?, 2), 0)
       WHERE IdCuenta = ? AND Estado != 'Anulada' AND SaldoPendiente >= ROUND(?, 2)`,
      [montoAplicado, montoAplicado, idCuenta, montoAplicado]
    );

    if (resultado.affectedRows === 0) {
      throw new ConflictException(
        `El saldo de la cuenta #${idCuenta} cambio o ya no admite abonos. Verifica el saldo actual e intenta de nuevo.`
      );
    }

    const cuentaActualizada = await this.obtenerCuentaPorId(idCuenta, manager);
    await this.sincronizarEstadoDelDocumento(cuentaActualizada, manager);

    return cuentaActualizada;
  }

  public async revertirAbonoACuenta(
    idCuenta: number,
    montoAplicado: number,
    manager: EntityManager = this.repositorioDeCuentas.manager
  ): Promise<CuentaPorCobrarPagar> {
    await manager.query(
      `UPDATE CuentaPorCobrarPagar
       SET Estado = CASE
             WHEN LEAST(SaldoPendiente + ?, MontoOriginal) >= MontoOriginal THEN 'Pendiente'
             ELSE 'Parcial'
           END,
           SaldoPendiente = LEAST(SaldoPendiente + ?, MontoOriginal)
       WHERE IdCuenta = ? AND Estado != 'Anulada'`,
      [montoAplicado, montoAplicado, idCuenta]
    );

    const cuentaActualizada = await this.obtenerCuentaPorId(idCuenta, manager);
    await this.sincronizarEstadoDelDocumento(cuentaActualizada, manager);

    return cuentaActualizada;
  }

  public async anularCuenta(idCuenta: number, manager: EntityManager): Promise<void> {
    await manager.query(`UPDATE CuentaPorCobrarPagar SET Estado = 'Anulada', SaldoPendiente = 0 WHERE IdCuenta = ?`, [idCuenta]);
  }

  private async sincronizarEstadoDelDocumento(cuenta: CuentaPorCobrarPagar, manager: EntityManager): Promise<void> {
    const estadoEquivalente =
      cuenta.estado === 'Pagada' ? 'Pagado' : cuenta.saldoPendiente < cuenta.montoOriginal ? 'Parcial' : 'Pendiente';

    if (cuenta.idPedido !== null) {
      await manager.query(`UPDATE Pedido SET Estado = ? WHERE IdPedido = ? AND Estado != 'Anulado'`, [estadoEquivalente, cuenta.idPedido]);
    }

    if (cuenta.idCompra !== null) {
      const estadoDeLaCompra = estadoEquivalente === 'Pagado' ? 'Pagada' : estadoEquivalente;
      await manager.query(`UPDATE Compra SET Estado = ? WHERE IdCompra = ? AND Estado != 'Anulada'`, [estadoDeLaCompra, cuenta.idCompra]);
    }
  }
}
