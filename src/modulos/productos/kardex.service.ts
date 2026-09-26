import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { MovimientoDeInventario, OrigenDelMovimientoDeInventario, Producto } from '../../comun/entidades';
import { redondearCosto } from '../../comun/utilidades/fechas';

export interface DatosDeMovimientoDeKardex {
  idProducto: number;
  cantidad: number;
  origen: OrigenDelMovimientoDeInventario;
  costoUnitario?: number | null;
  idReferencia?: number | null;
  idUsuario?: number | null;
  observaciones?: string | null;
}

export interface ResultadoDeMovimientoDeKardex {
  existenciaAnterior: number;
  costoPromedioAnterior: number;
  existenciaResultante: number;
  costoPromedioResultante: number;
  costoUnitarioAplicado: number;
}

export interface FiltrosDeMovimientos {
  idProducto?: number;
  origen?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  pagina?: number;
  limite?: number;
}

interface FilaDeProductoBloqueado {
  IdProducto: number;
  Descripcion: string;
  Existencia: number | string;
  CostoPromedio: number | string;
}

@Injectable()
export class KardexService {
  constructor(
    @InjectRepository(MovimientoDeInventario)
    private readonly repositorioDeMovimientos: Repository<MovimientoDeInventario>,
    @InjectRepository(Producto)
    private readonly repositorioDeProductos: Repository<Producto>
  ) {}

  public async bloquearProductos(manager: EntityManager, idsDeProductos: number[]): Promise<void> {
    const idsOrdenados = Array.from(new Set(idsDeProductos)).sort((a, b) => a - b);

    if (idsOrdenados.length === 0) {
      return;
    }

    await manager.query('SELECT IdProducto FROM Producto WHERE IdProducto IN (?) ORDER BY IdProducto FOR UPDATE', [idsOrdenados]);
  }

  public async registrarEntrada(manager: EntityManager, datos: DatosDeMovimientoDeKardex): Promise<ResultadoDeMovimientoDeKardex> {
    const fila = await this.leerProductoBloqueado(manager, datos.idProducto);
    const existenciaAnterior = Number(fila.Existencia);
    const costoPromedioAnterior = Number(fila.CostoPromedio);
    const costoDeLaEntrada = datos.costoUnitario ?? null;

    let costoPromedioResultante = costoPromedioAnterior;

    if (costoDeLaEntrada !== null) {
      costoPromedioResultante =
        existenciaAnterior <= 0
          ? costoDeLaEntrada
          : (existenciaAnterior * costoPromedioAnterior + datos.cantidad * costoDeLaEntrada) / (existenciaAnterior + datos.cantidad);
    }

    costoPromedioResultante = redondearCosto(Math.max(costoPromedioResultante, 0));
    const existenciaResultante = existenciaAnterior + datos.cantidad;

    await manager.query('UPDATE Producto SET Existencia = ?, CostoPromedio = ? WHERE IdProducto = ?', [
      existenciaResultante,
      costoPromedioResultante,
      datos.idProducto
    ]);

    await this.guardarMovimiento(manager, datos, 'Entrada', costoDeLaEntrada ?? costoPromedioAnterior, existenciaResultante, costoPromedioResultante);

    return {
      existenciaAnterior,
      costoPromedioAnterior,
      existenciaResultante,
      costoPromedioResultante,
      costoUnitarioAplicado: costoDeLaEntrada ?? costoPromedioAnterior
    };
  }

  public async registrarSalida(manager: EntityManager, datos: DatosDeMovimientoDeKardex): Promise<ResultadoDeMovimientoDeKardex> {
    const fila = await this.leerProductoBloqueado(manager, datos.idProducto);
    const existenciaAnterior = Number(fila.Existencia);
    const costoPromedioAnterior = Number(fila.CostoPromedio);

    if (existenciaAnterior < datos.cantidad) {
      throw new BadRequestException(
        `No hay existencia suficiente de "${fila.Descripcion}". Disponible: ${existenciaAnterior}, solicitado: ${datos.cantidad}.`
      );
    }

    const existenciaResultante = existenciaAnterior - datos.cantidad;

    await manager.query('UPDATE Producto SET Existencia = ? WHERE IdProducto = ?', [existenciaResultante, datos.idProducto]);

    await this.guardarMovimiento(manager, datos, 'Salida', costoPromedioAnterior, existenciaResultante, costoPromedioAnterior);

    return {
      existenciaAnterior,
      costoPromedioAnterior,
      existenciaResultante,
      costoPromedioResultante: costoPromedioAnterior,
      costoUnitarioAplicado: costoPromedioAnterior
    };
  }

  public async revertirEntrada(manager: EntityManager, datos: DatosDeMovimientoDeKardex): Promise<ResultadoDeMovimientoDeKardex> {
    const fila = await this.leerProductoBloqueado(manager, datos.idProducto);
    const existenciaAnterior = Number(fila.Existencia);
    const costoPromedioAnterior = Number(fila.CostoPromedio);
    const costoDeLaEntrada = datos.costoUnitario ?? costoPromedioAnterior;

    if (existenciaAnterior < datos.cantidad) {
      throw new BadRequestException(
        `No se puede revertir: de "${fila.Descripcion}" quedan ${existenciaAnterior} unidades y la operacion necesita retirar ${datos.cantidad}. Probablemente ya se vendieron.`
      );
    }

    const existenciaResultante = existenciaAnterior - datos.cantidad;
    let costoPromedioResultante = costoPromedioAnterior;

    if (existenciaResultante > 0) {
      const costoRecalculado = (existenciaAnterior * costoPromedioAnterior - datos.cantidad * costoDeLaEntrada) / existenciaResultante;
      costoPromedioResultante = costoRecalculado > 0 ? costoRecalculado : costoPromedioAnterior;
    }

    costoPromedioResultante = redondearCosto(costoPromedioResultante);

    await manager.query('UPDATE Producto SET Existencia = ?, CostoPromedio = ? WHERE IdProducto = ?', [
      existenciaResultante,
      costoPromedioResultante,
      datos.idProducto
    ]);

    await this.guardarMovimiento(manager, datos, 'Salida', costoDeLaEntrada, existenciaResultante, costoPromedioResultante);

    return {
      existenciaAnterior,
      costoPromedioAnterior,
      existenciaResultante,
      costoPromedioResultante,
      costoUnitarioAplicado: costoDeLaEntrada
    };
  }

  public async obtenerMovimientos(filtros: FiltrosDeMovimientos): Promise<MovimientoDeInventario[]> {
    const limite = Math.min(filtros.limite ?? 100, 500);
    const pagina = Math.max(filtros.pagina ?? 1, 1);

    const consulta = this.repositorioDeMovimientos
      .createQueryBuilder('movimiento')
      .leftJoinAndSelect('movimiento.producto', 'producto')
      .leftJoinAndSelect('movimiento.usuario', 'usuario')
      .orderBy('movimiento.fecha', 'DESC')
      .addOrderBy('movimiento.idMovimiento', 'DESC')
      .skip((pagina - 1) * limite)
      .take(limite);

    if (filtros.idProducto) {
      consulta.andWhere('movimiento.idProducto = :idProducto', { idProducto: filtros.idProducto });
    }
    if (filtros.origen) {
      consulta.andWhere('movimiento.origen = :origen', { origen: filtros.origen });
    }
    if (filtros.fechaDesde) {
      consulta.andWhere('movimiento.fecha >= :fechaDesde', { fechaDesde: filtros.fechaDesde });
    }
    if (filtros.fechaHasta) {
      consulta.andWhere('movimiento.fecha <= :fechaHasta', { fechaHasta: `${filtros.fechaHasta} 23:59:59` });
    }

    return consulta.getMany();
  }

  public async obtenerKardexDeProducto(idProducto: number, fechaDesde?: string, fechaHasta?: string) {
    const producto = await this.repositorioDeProductos.findOne({ where: { idProducto } });

    if (producto === null) {
      throw new NotFoundException(`No se encontro el producto con id ${idProducto}.`);
    }

    const consulta = this.repositorioDeMovimientos
      .createQueryBuilder('movimiento')
      .leftJoinAndSelect('movimiento.usuario', 'usuario')
      .where('movimiento.idProducto = :idProducto', { idProducto })
      .orderBy('movimiento.fecha', 'ASC')
      .addOrderBy('movimiento.idMovimiento', 'ASC');

    if (fechaDesde) {
      consulta.andWhere('movimiento.fecha >= :fechaDesde', { fechaDesde });
    }
    if (fechaHasta) {
      consulta.andWhere('movimiento.fecha <= :fechaHasta', { fechaHasta: `${fechaHasta} 23:59:59` });
    }

    const movimientos = await consulta.take(1000).getMany();

    let existenciaInicial = 0;

    if (fechaDesde) {
      const anterior = await this.repositorioDeMovimientos
        .createQueryBuilder('movimiento')
        .where('movimiento.idProducto = :idProducto', { idProducto })
        .andWhere('movimiento.fecha < :fechaDesde', { fechaDesde })
        .orderBy('movimiento.fecha', 'DESC')
        .addOrderBy('movimiento.idMovimiento', 'DESC')
        .getOne();
      existenciaInicial = anterior?.existenciaResultante ?? 0;
    }

    const totalDeEntradas = movimientos.filter((m) => m.tipoMovimiento === 'Entrada').reduce((suma, m) => suma + m.cantidad, 0);
    const totalDeSalidas = movimientos.filter((m) => m.tipoMovimiento === 'Salida').reduce((suma, m) => suma + m.cantidad, 0);

    return {
      producto,
      existenciaInicial,
      totalDeEntradas,
      totalDeSalidas,
      movimientos: movimientos.map((movimiento) => ({ ...movimiento, producto: undefined }))
    };
  }

  private async leerProductoBloqueado(manager: EntityManager, idProducto: number): Promise<FilaDeProductoBloqueado> {
    const filas: FilaDeProductoBloqueado[] = await manager.query(
      'SELECT IdProducto, Descripcion, Existencia, CostoPromedio FROM Producto WHERE IdProducto = ? FOR UPDATE',
      [idProducto]
    );

    if (filas.length === 0) {
      throw new NotFoundException(`No se encontro el producto con id ${idProducto}.`);
    }

    return filas[0];
  }

  private async guardarMovimiento(
    manager: EntityManager,
    datos: DatosDeMovimientoDeKardex,
    tipoMovimiento: 'Entrada' | 'Salida',
    costoUnitario: number,
    existenciaResultante: number,
    costoPromedioResultante: number
  ): Promise<void> {
    await manager.insert(MovimientoDeInventario, {
      idProducto: datos.idProducto,
      tipoMovimiento,
      origen: datos.origen,
      idReferencia: datos.idReferencia ?? null,
      cantidad: datos.cantidad,
      costoUnitario: redondearCosto(costoUnitario),
      observaciones: datos.observaciones ?? null,
      idUsuario: datos.idUsuario ?? null,
      existenciaResultante,
      costoPromedioResultante
    });
  }
}
