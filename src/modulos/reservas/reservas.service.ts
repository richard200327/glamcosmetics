import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

@Injectable()
export class ReservasService {
  constructor(private readonly dataSource: DataSource) {}

  public async obtenerReservas(
    idsDeProducto: number[] | null = null,
    idPedidoWebExcluido: number | null = null,
    manager: EntityManager = this.dataSource.manager
  ): Promise<Map<number, number>> {
    const [configuracion] = await manager.query('SELECT HorasDeReserva FROM ConfiguracionDeTienda WHERE IdConfiguracion = 1');
    const horas = Number(configuracion?.HorasDeReserva ?? 0);
    const condiciones = ["pw.Estado IN ('Pendiente', 'Convirtiendo')"];
    const parametros: unknown[] = [];

    if (horas > 0) {
      condiciones.push('pw.FechaCreacion >= DATE_SUB(NOW(), INTERVAL ? HOUR)');
      parametros.push(horas);
    }
    if (idPedidoWebExcluido !== null) {
      condiciones.push('pw.IdPedidoWeb != ?');
      parametros.push(idPedidoWebExcluido);
    }
    if (idsDeProducto !== null) {
      if (idsDeProducto.length === 0) {
        return new Map();
      }
      condiciones.push(`d.IdProducto IN (${idsDeProducto.map(() => '?').join(',')})`);
      parametros.push(...idsDeProducto);
    }

    const filas: { IdProducto: number; Cantidad: string }[] = await manager.query(
      `SELECT d.IdProducto, SUM(d.Cantidad) AS Cantidad
       FROM DetallePedidoWeb d INNER JOIN PedidoWeb pw ON pw.IdPedidoWeb = d.IdPedidoWeb
       WHERE ${condiciones.join(' AND ')}
       GROUP BY d.IdProducto`,
      parametros
    );

    return new Map(filas.map((fila) => [Number(fila.IdProducto), Number(fila.Cantidad)]));
  }
}
