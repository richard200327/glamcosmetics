import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CuentaPorCobrarPagar, Pedido } from '../../comun/entidades';
import { CuentasService } from '../cuentas/cuentas.service';
import { FiltrosDeReporteDto } from './dto/filtros-de-reporte.dto';
import { obtenerFechaLocalDeHoy, redondearMoneda } from '../../comun/utilidades/fechas';

export interface ProductoEnRanking {
  idProducto: number;
  descripcionDelProducto: string;
  cantidadVendida: number;
  cantidadRegalada: number;
  montoVendido: number;
  costoTotal: number;
  gananciaBruta: number;
  margenPorcentual: number;
  precioPromedioDeVenta: number;
  costoPromedioDeVenta: number;
}

export interface ClienteConMonto {
  idCliente: number;
  nombreDelCliente: string;
  cantidad: number;
  monto: number;
}

export interface PuntoDeLaSerieDiaria {
  fecha: string;
  totalVendido: number;
  costo: number;
  ganancia: number;
  cantidadDeOperaciones: number;
  totalComprado: number;
}

export interface ReporteDeVentas {
  cantidadDePedidosACredito: number;
  cantidadDeVentasDeContado: number;
  totalFacturado: number;
  ticketPromedio: number;
  costoTotalDeLoVendido: number;
  gananciaBruta: number;
  margenBrutoPorcentual: number;
  montoDescontadoPorPromociones: number;
  montoDescuentosManuales: number;
  cantidadDeUnidadesRegaladas: number;
  costoDeRegalos: number;
  valorDeRegalosAPrecioDeLista: number;
  totalComprado: number;
  cantidadDeCompras: number;
  totalCobradoEnElPeriodo: number;
  totalPagadoAProveedoresEnElPeriodo: number;
  saldoPendienteDeCuentasEmitidasEnElPeriodo: number;
  cantidadDeCuentasVencidasEnElPeriodo: number;
  productosMasVendidos: ProductoEnRanking[];
  rentabilidadPorProducto: ProductoEnRanking[];
  clientesConPedidos: ClienteConMonto[];
  clientesConSaldoPendiente: ClienteConMonto[];
  serieDiaria: PuntoDeLaSerieDiaria[];
}

export interface ProductoValorizado {
  idProducto: number;
  codigo: string;
  descripcion: string;
  existencia: number;
  existenciaMinima: number;
  costoPromedio: number;
  precioUnitario: number;
  valorAlCosto: number;
  valorAPrecioDeVenta: number;
  gananciaPotencial: number;
  margenPorcentual: number;
  ultimoCostoDeCompra: number | null;
  fechaDeUltimaCompra: string | null;
  unidadesVendidasUltimos30Dias: number;
  diasDeInventario: number | null;
}

export interface ReporteDeInventario {
  cantidadDeProductos: number;
  unidadesEnExistencia: number;
  valorAlCosto: number;
  valorAPrecioDeVenta: number;
  gananciaPotencial: number;
  productosSinExistencia: number;
  productosConStockBajo: number;
  productosConMargenNegativo: number;
  productos: ProductoValorizado[];
}

export interface ResumenDelTablero {
  fecha: string;
  ventasDeHoy: number;
  cantidadDeOperacionesDeHoy: number;
  cobradoHoy: number;
  gananciaDeHoy: number | null;
  costoDeHoy: number | null;
  comprasDeHoy: number | null;
  ventasDelMes: number;
  gananciaDelMes: number | null;
  totalPorCobrar: number;
  totalPorPagar: number | null;
  cuentasVencidasPorCobrar: number;
  cuentasVencidasPorPagar: number;
  productosSinExistencia: number;
  productosConStockBajo: number;
  valorDelInventario: number | null;
  productosPorReponer: { idProducto: number; descripcion: string; existencia: number; existenciaMinima: number }[];
  ultimasOperaciones: { idPedido: number; nombreDelCliente: string; total: number; estado: string; tipoOperacion: string; fecha: Date }[];
  serieDeLaSemana: { fecha: string; totalVendido: number; ganancia: number | null }[];
}

@Injectable()
export class ReportesService {
  constructor(
    @InjectRepository(Pedido)
    private readonly repositorioDePedidos: Repository<Pedido>,
    @InjectRepository(CuentaPorCobrarPagar)
    private readonly repositorioDeCuentas: Repository<CuentaPorCobrarPagar>,
    private readonly cuentasService: CuentasService,
    private readonly dataSource: DataSource
  ) {}

  public async generarReporteDeVentas(filtros: FiltrosDeReporteDto): Promise<ReporteDeVentas> {
    await this.cuentasService.marcarCuentasVencidas();

    const desde = filtros.fechaDesde;
    const hasta = `${filtros.fechaHasta} 23:59:59`;
    const idCliente = filtros.idCliente ? Number(filtros.idCliente) : null;
    const filtroDeCliente = idCliente !== null ? ' AND p.IdCliente = ?' : '';
    const parametrosBase: unknown[] = idCliente !== null ? [desde, hasta, idCliente] : [desde, hasta];

    const [totales] = await this.dataSource.query(
      `SELECT
         COUNT(*) AS cantidad,
         SUM(CASE WHEN p.TipoOperacion = 'Pedido' THEN 1 ELSE 0 END) AS aCredito,
         SUM(CASE WHEN p.TipoOperacion = 'Venta' THEN 1 ELSE 0 END) AS deContado,
         COALESCE(SUM(p.Total), 0) AS totalFacturado,
         COALESCE(SUM(p.MontoTotalDescontadoPorPromociones), 0) AS descuentoPromociones,
         COALESCE(SUM(p.MontoTotalDescuentoManual), 0) AS descuentoManual
       FROM Pedido p
       WHERE p.Fecha >= ? AND p.Fecha <= ? AND p.Estado != 'Anulado'${filtroDeCliente}`,
      parametrosBase
    );

    const [costos] = await this.dataSource.query(
      `SELECT
         COALESCE(SUM(d.CostoUnitarioUsado * d.Cantidad), 0) AS costoTotal,
         COALESCE(SUM(CASE WHEN d.EsRegalo = 1 THEN d.Cantidad ELSE 0 END), 0) AS unidadesRegaladas,
         COALESCE(SUM(CASE WHEN d.EsRegalo = 1 THEN d.CostoUnitarioUsado * d.Cantidad ELSE 0 END), 0) AS costoRegalos,
         COALESCE(SUM(CASE WHEN d.EsRegalo = 1 THEN COALESCE(d.PrecioDeLista, 0) * d.Cantidad ELSE 0 END), 0) AS valorRegalos
       FROM DetallePedido d
       INNER JOIN Pedido p ON p.IdPedido = d.IdPedido
       WHERE p.Fecha >= ? AND p.Fecha <= ? AND p.Estado != 'Anulado'${filtroDeCliente}`,
      parametrosBase
    );

    const filasPorProducto: {
      idProducto: number;
      descripcion: string;
      cantidadVendida: string;
      cantidadRegalada: string;
      montoVendido: string;
      costoTotal: string;
    }[] = await this.dataSource.query(
      `SELECT
         d.IdProducto AS idProducto,
         pr.Descripcion AS descripcion,
         SUM(CASE WHEN d.EsRegalo = 0 THEN d.Cantidad ELSE 0 END) AS cantidadVendida,
         SUM(CASE WHEN d.EsRegalo = 1 THEN d.Cantidad ELSE 0 END) AS cantidadRegalada,
         SUM(d.Subtotal) AS montoVendido,
         SUM(d.CostoUnitarioUsado * d.Cantidad) AS costoTotal
       FROM DetallePedido d
       INNER JOIN Pedido p ON p.IdPedido = d.IdPedido
       INNER JOIN Producto pr ON pr.IdProducto = d.IdProducto
       WHERE p.Fecha >= ? AND p.Fecha <= ? AND p.Estado != 'Anulado'${filtroDeCliente}
       GROUP BY d.IdProducto, pr.Descripcion`,
      parametrosBase
    );

    const descuentoGlobalPorPedido: { total: string }[] = await this.dataSource.query(
      `SELECT COALESCE(SUM(p.DescuentoManualGlobal), 0) AS total FROM Pedido p
       WHERE p.Fecha >= ? AND p.Fecha <= ? AND p.Estado != 'Anulado'${filtroDeCliente}`,
      parametrosBase
    );
    const totalDeDescuentoGlobal = Number(descuentoGlobalPorPedido[0]?.total ?? 0);
    const sumaDeSubtotales = filasPorProducto.reduce((suma, fila) => suma + Number(fila.montoVendido), 0);

    const rentabilidadPorProducto: ProductoEnRanking[] = filasPorProducto
      .map((fila) => {
        const montoBruto = Number(fila.montoVendido);
        const proporcionDelDescuentoGlobal = sumaDeSubtotales > 0 ? (montoBruto / sumaDeSubtotales) * totalDeDescuentoGlobal : 0;
        const montoVendido = redondearMoneda(montoBruto - proporcionDelDescuentoGlobal);
        const costoTotal = redondearMoneda(Number(fila.costoTotal));
        const cantidadVendida = Number(fila.cantidadVendida);
        const cantidadRegalada = Number(fila.cantidadRegalada);
        const gananciaBruta = redondearMoneda(montoVendido - costoTotal);
        const unidadesTotales = cantidadVendida + cantidadRegalada;

        return {
          idProducto: Number(fila.idProducto),
          descripcionDelProducto: fila.descripcion,
          cantidadVendida,
          cantidadRegalada,
          montoVendido,
          costoTotal,
          gananciaBruta,
          margenPorcentual: montoVendido > 0 ? redondearMoneda((gananciaBruta / montoVendido) * 100) : 0,
          precioPromedioDeVenta: cantidadVendida > 0 ? redondearMoneda(montoVendido / cantidadVendida) : 0,
          costoPromedioDeVenta: unidadesTotales > 0 ? redondearMoneda(costoTotal / unidadesTotales) : 0
        };
      })
      .sort((a, b) => b.gananciaBruta - a.gananciaBruta);

    const productosMasVendidos = [...rentabilidadPorProducto]
      .sort((a, b) => b.cantidadVendida - a.cantidadVendida)
      .slice(0, 10);

    const [compras] = await this.dataSource.query(
      `SELECT COUNT(*) AS cantidad, COALESCE(SUM(c.Total), 0) AS total
       FROM Compra c WHERE c.Fecha >= ? AND c.Fecha <= ? AND c.Estado != 'Anulada'`,
      [desde, hasta]
    );

    const [cobros] = await this.dataSource.query(
      `SELECT
         COALESCE(SUM(CASE WHEN rp.IdProveedor IS NULL THEN rp.MontoTotal ELSE 0 END), 0) AS cobrado,
         COALESCE(SUM(CASE WHEN rp.IdProveedor IS NOT NULL THEN rp.MontoTotal ELSE 0 END), 0) AS pagado
       FROM RegistroPago rp
       WHERE rp.Fecha >= ? AND rp.Fecha <= ? AND rp.Anulado = 0${idCliente !== null ? ' AND rp.IdCliente = ?' : ''}`,
      parametrosBase
    );

    const serieDeVentas: { fecha: string; total: string; costo: string; cantidad: string }[] = await this.dataSource.query(
      `SELECT DATE_FORMAT(p.Fecha, '%Y-%m-%d') AS fecha,
              SUM(p.Total) AS total,
              SUM((SELECT COALESCE(SUM(d.CostoUnitarioUsado * d.Cantidad), 0) FROM DetallePedido d WHERE d.IdPedido = p.IdPedido)) AS costo,
              COUNT(*) AS cantidad
       FROM Pedido p
       WHERE p.Fecha >= ? AND p.Fecha <= ? AND p.Estado != 'Anulado'${filtroDeCliente}
       GROUP BY DATE_FORMAT(p.Fecha, '%Y-%m-%d')
       ORDER BY fecha`,
      parametrosBase
    );

    const serieDeCompras: { fecha: string; total: string }[] = await this.dataSource.query(
      `SELECT DATE_FORMAT(c.Fecha, '%Y-%m-%d') AS fecha, SUM(c.Total) AS total
       FROM Compra c WHERE c.Fecha >= ? AND c.Fecha <= ? AND c.Estado != 'Anulada'
       GROUP BY DATE_FORMAT(c.Fecha, '%Y-%m-%d')`,
      [desde, hasta]
    );

    const mapaDeCompras = new Map(serieDeCompras.map((fila) => [fila.fecha, Number(fila.total)]));
    const serieDiaria: PuntoDeLaSerieDiaria[] = this.generarRangoDeFechas(filtros.fechaDesde, filtros.fechaHasta).map((fecha) => {
      const venta = serieDeVentas.find((fila) => fila.fecha === fecha);
      const totalVendido = venta ? Number(venta.total) : 0;
      const costo = venta ? Number(venta.costo) : 0;
      return {
        fecha,
        totalVendido: redondearMoneda(totalVendido),
        costo: redondearMoneda(costo),
        ganancia: redondearMoneda(totalVendido - costo),
        cantidadDeOperaciones: venta ? Number(venta.cantidad) : 0,
        totalComprado: redondearMoneda(mapaDeCompras.get(fecha) ?? 0)
      };
    });

    const consultaDeCuentas = this.repositorioDeCuentas
      .createQueryBuilder('cuenta')
      .leftJoinAndSelect('cuenta.cliente', 'cliente')
      .where('cuenta.tipoCuenta = :tipo', { tipo: 'CXC' })
      .andWhere("cuenta.estado != 'Anulada'")
      .andWhere('cuenta.fechaEmision >= :desde', { desde })
      .andWhere('cuenta.fechaEmision <= :hasta', { hasta });

    if (idCliente !== null) {
      consultaDeCuentas.andWhere('cuenta.idCliente = :idCliente', { idCliente });
    }

    const cuentasFiltradas = await consultaDeCuentas.getMany();
    const cuentasConSaldo = cuentasFiltradas.filter((cuenta) => cuenta.saldoPendiente > 0);

    const pedidosDelPeriodo = await this.repositorioDePedidos
      .createQueryBuilder('pedido')
      .leftJoinAndSelect('pedido.cliente', 'cliente')
      .select(['pedido.idPedido', 'pedido.idCliente', 'pedido.total', 'cliente.idCliente', 'cliente.nombre'])
      .where('pedido.fecha >= :desde', { desde })
      .andWhere('pedido.fecha <= :hasta', { hasta })
      .andWhere("pedido.estado != 'Anulado'")
      .andWhere(idCliente !== null ? 'pedido.idCliente = :idCliente' : '1=1', { idCliente })
      .getMany();

    const totalFacturado = Number(totales?.totalFacturado ?? 0);
    const cantidadDeOperaciones = Number(totales?.cantidad ?? 0);
    const costoTotalDeLoVendido = Number(costos?.costoTotal ?? 0);
    const gananciaBruta = redondearMoneda(totalFacturado - costoTotalDeLoVendido);

    return {
      cantidadDePedidosACredito: Number(totales?.aCredito ?? 0),
      cantidadDeVentasDeContado: Number(totales?.deContado ?? 0),
      totalFacturado: redondearMoneda(totalFacturado),
      ticketPromedio: cantidadDeOperaciones > 0 ? redondearMoneda(totalFacturado / cantidadDeOperaciones) : 0,
      costoTotalDeLoVendido: redondearMoneda(costoTotalDeLoVendido),
      gananciaBruta,
      margenBrutoPorcentual: totalFacturado > 0 ? redondearMoneda((gananciaBruta / totalFacturado) * 100) : 0,
      montoDescontadoPorPromociones: redondearMoneda(Number(totales?.descuentoPromociones ?? 0)),
      montoDescuentosManuales: redondearMoneda(Number(totales?.descuentoManual ?? 0)),
      cantidadDeUnidadesRegaladas: Number(costos?.unidadesRegaladas ?? 0),
      costoDeRegalos: redondearMoneda(Number(costos?.costoRegalos ?? 0)),
      valorDeRegalosAPrecioDeLista: redondearMoneda(Number(costos?.valorRegalos ?? 0)),
      totalComprado: redondearMoneda(Number(compras?.total ?? 0)),
      cantidadDeCompras: Number(compras?.cantidad ?? 0),
      totalCobradoEnElPeriodo: redondearMoneda(Number(cobros?.cobrado ?? 0)),
      totalPagadoAProveedoresEnElPeriodo: redondearMoneda(Number(cobros?.pagado ?? 0)),
      saldoPendienteDeCuentasEmitidasEnElPeriodo: redondearMoneda(cuentasConSaldo.reduce((suma, cuenta) => suma + cuenta.saldoPendiente, 0)),
      cantidadDeCuentasVencidasEnElPeriodo: cuentasConSaldo.filter((cuenta) => cuenta.estado === 'Vencida').length,
      productosMasVendidos,
      rentabilidadPorProducto,
      clientesConPedidos: this.agruparPedidosPorCliente(pedidosDelPeriodo),
      clientesConSaldoPendiente: this.agruparCuentasPorCliente(cuentasConSaldo),
      serieDiaria
    };
  }

  public async generarReporteDeInventario(): Promise<ReporteDeInventario> {
    const filas: {
      IdProducto: number;
      Codigo: string;
      Descripcion: string;
      Existencia: number;
      ExistenciaMinima: number;
      CostoPromedio: string;
      PrecioUnitario: string;
      UltimoCosto: string | null;
      FechaUltimaCompra: string | null;
      Vendidas30: string | null;
    }[] = await this.dataSource.query(
      `SELECT pr.IdProducto, pr.Codigo, pr.Descripcion, pr.Existencia, pr.ExistenciaMinima, pr.CostoPromedio, pr.PrecioUnitario,
         (SELECT dc.CostoUnitarioFinal FROM DetalleCompra dc INNER JOIN Compra c ON c.IdCompra = dc.IdCompra
            WHERE dc.IdProducto = pr.IdProducto AND c.Estado != 'Anulada' ORDER BY c.Fecha DESC, dc.IdDetalleCompra DESC LIMIT 1) AS UltimoCosto,
         (SELECT DATE_FORMAT(MAX(c.Fecha), '%Y-%m-%d') FROM DetalleCompra dc INNER JOIN Compra c ON c.IdCompra = dc.IdCompra
            WHERE dc.IdProducto = pr.IdProducto AND c.Estado != 'Anulada') AS FechaUltimaCompra,
         (SELECT SUM(d.Cantidad) FROM DetallePedido d INNER JOIN Pedido p ON p.IdPedido = d.IdPedido
            WHERE d.IdProducto = pr.IdProducto AND p.Estado != 'Anulado' AND p.Fecha >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)) AS Vendidas30
       FROM Producto pr
       WHERE pr.Activo = 1
       ORDER BY pr.Descripcion`
    );

    const productos: ProductoValorizado[] = filas.map((fila) => {
      const existencia = Number(fila.Existencia);
      const costoPromedio = Number(fila.CostoPromedio);
      const precioUnitario = Number(fila.PrecioUnitario);
      const valorAlCosto = redondearMoneda(existencia * costoPromedio);
      const valorAPrecioDeVenta = redondearMoneda(existencia * precioUnitario);
      const vendidas30 = Number(fila.Vendidas30 ?? 0);

      return {
        idProducto: Number(fila.IdProducto),
        codigo: fila.Codigo,
        descripcion: fila.Descripcion,
        existencia,
        existenciaMinima: Number(fila.ExistenciaMinima),
        costoPromedio,
        precioUnitario,
        valorAlCosto,
        valorAPrecioDeVenta,
        gananciaPotencial: redondearMoneda(valorAPrecioDeVenta - valorAlCosto),
        margenPorcentual: precioUnitario > 0 ? redondearMoneda(((precioUnitario - costoPromedio) / precioUnitario) * 100) : 0,
        ultimoCostoDeCompra: fila.UltimoCosto !== null ? Number(fila.UltimoCosto) : null,
        fechaDeUltimaCompra: fila.FechaUltimaCompra,
        unidadesVendidasUltimos30Dias: vendidas30,
        diasDeInventario: vendidas30 > 0 ? Math.round(existencia / (vendidas30 / 30)) : null
      };
    });

    return {
      cantidadDeProductos: productos.length,
      unidadesEnExistencia: productos.reduce((suma, producto) => suma + producto.existencia, 0),
      valorAlCosto: redondearMoneda(productos.reduce((suma, producto) => suma + producto.valorAlCosto, 0)),
      valorAPrecioDeVenta: redondearMoneda(productos.reduce((suma, producto) => suma + producto.valorAPrecioDeVenta, 0)),
      gananciaPotencial: redondearMoneda(productos.reduce((suma, producto) => suma + producto.gananciaPotencial, 0)),
      productosSinExistencia: productos.filter((producto) => producto.existencia === 0).length,
      productosConStockBajo: productos.filter((producto) => producto.existencia > 0 && producto.existencia <= producto.existenciaMinima).length,
      productosConMargenNegativo: productos.filter((producto) => producto.precioUnitario < producto.costoPromedio).length,
      productos
    };
  }

  public async obtenerResumenDelTablero(esAdministrador: boolean): Promise<ResumenDelTablero> {
    const hoy = obtenerFechaLocalDeHoy();
    const inicioDelMes = `${hoy.substring(0, 7)}-01`;
    const resumenDeCuentas = await this.cuentasService.obtenerResumen();

    const [ventasHoy] = await this.dataSource.query(
      `SELECT COUNT(*) AS cantidad, COALESCE(SUM(p.Total), 0) AS total,
              COALESCE(SUM((SELECT SUM(d.CostoUnitarioUsado * d.Cantidad) FROM DetallePedido d WHERE d.IdPedido = p.IdPedido)), 0) AS costo
       FROM Pedido p WHERE DATE(p.Fecha) = ? AND p.Estado != 'Anulado'`,
      [hoy]
    );

    const [ventasMes] = await this.dataSource.query(
      `SELECT COALESCE(SUM(p.Total), 0) AS total,
              COALESCE(SUM((SELECT SUM(d.CostoUnitarioUsado * d.Cantidad) FROM DetallePedido d WHERE d.IdPedido = p.IdPedido)), 0) AS costo
       FROM Pedido p WHERE p.Fecha >= ? AND p.Estado != 'Anulado'`,
      [inicioDelMes]
    );

    const [cobradoHoy] = await this.dataSource.query(
      `SELECT COALESCE(SUM(rp.MontoTotal), 0) AS total FROM RegistroPago rp WHERE DATE(rp.Fecha) = ? AND rp.Anulado = 0 AND rp.IdProveedor IS NULL`,
      [hoy]
    );

    const [comprasHoy] = await this.dataSource.query(
      `SELECT COALESCE(SUM(c.Total), 0) AS total FROM Compra c WHERE DATE(c.Fecha) = ? AND c.Estado != 'Anulada'`,
      [hoy]
    );

    const [inventario] = await this.dataSource.query(
      `SELECT
         SUM(CASE WHEN Existencia = 0 THEN 1 ELSE 0 END) AS sinExistencia,
         SUM(CASE WHEN Existencia > 0 AND Existencia <= ExistenciaMinima THEN 1 ELSE 0 END) AS stockBajo,
         COALESCE(SUM(Existencia * CostoPromedio), 0) AS valor
       FROM Producto WHERE Activo = 1`
    );

    const productosPorReponer: { IdProducto: number; Descripcion: string; Existencia: number; ExistenciaMinima: number }[] =
      await this.dataSource.query(
        `SELECT IdProducto, Descripcion, Existencia, ExistenciaMinima FROM Producto
         WHERE Activo = 1 AND Existencia <= ExistenciaMinima ORDER BY Existencia ASC, Descripcion ASC LIMIT 8`
      );

    const ultimasOperaciones = await this.repositorioDePedidos
      .createQueryBuilder('pedido')
      .leftJoinAndSelect('pedido.cliente', 'cliente')
      .select(['pedido.idPedido', 'pedido.total', 'pedido.estado', 'pedido.tipoOperacion', 'pedido.fecha', 'cliente.idCliente', 'cliente.nombre'])
      .orderBy('pedido.fecha', 'DESC')
      .take(6)
      .getMany();

    const desdeLaSemana = new Date();
    desdeLaSemana.setDate(desdeLaSemana.getDate() - 6);
    const fechaInicioDeLaSemana = `${desdeLaSemana.getFullYear()}-${String(desdeLaSemana.getMonth() + 1).padStart(2, '0')}-${String(desdeLaSemana.getDate()).padStart(2, '0')}`;

    const serie: { fecha: string; total: string; costo: string }[] = await this.dataSource.query(
      `SELECT DATE_FORMAT(p.Fecha, '%Y-%m-%d') AS fecha, SUM(p.Total) AS total,
              SUM((SELECT COALESCE(SUM(d.CostoUnitarioUsado * d.Cantidad), 0) FROM DetallePedido d WHERE d.IdPedido = p.IdPedido)) AS costo
       FROM Pedido p WHERE p.Fecha >= ? AND p.Estado != 'Anulado'
       GROUP BY DATE_FORMAT(p.Fecha, '%Y-%m-%d')`,
      [fechaInicioDeLaSemana]
    );

    const ventasDeHoy = Number(ventasHoy?.total ?? 0);
    const costoDeHoy = Number(ventasHoy?.costo ?? 0);
    const ventasDelMes = Number(ventasMes?.total ?? 0);
    const costoDelMes = Number(ventasMes?.costo ?? 0);

    return {
      fecha: hoy,
      ventasDeHoy: redondearMoneda(ventasDeHoy),
      cantidadDeOperacionesDeHoy: Number(ventasHoy?.cantidad ?? 0),
      cobradoHoy: redondearMoneda(Number(cobradoHoy?.total ?? 0)),
      gananciaDeHoy: esAdministrador ? redondearMoneda(ventasDeHoy - costoDeHoy) : null,
      costoDeHoy: esAdministrador ? redondearMoneda(costoDeHoy) : null,
      comprasDeHoy: esAdministrador ? redondearMoneda(Number(comprasHoy?.total ?? 0)) : null,
      ventasDelMes: redondearMoneda(ventasDelMes),
      gananciaDelMes: esAdministrador ? redondearMoneda(ventasDelMes - costoDelMes) : null,
      totalPorCobrar: resumenDeCuentas.totalPorCobrar,
      totalPorPagar: esAdministrador ? resumenDeCuentas.totalPorPagar : null,
      cuentasVencidasPorCobrar: resumenDeCuentas.vencidasPorCobrar,
      cuentasVencidasPorPagar: resumenDeCuentas.vencidasPorPagar,
      productosSinExistencia: Number(inventario?.sinExistencia ?? 0),
      productosConStockBajo: Number(inventario?.stockBajo ?? 0),
      valorDelInventario: esAdministrador ? redondearMoneda(Number(inventario?.valor ?? 0)) : null,
      productosPorReponer: productosPorReponer.map((fila) => ({
        idProducto: Number(fila.IdProducto),
        descripcion: fila.Descripcion,
        existencia: Number(fila.Existencia),
        existenciaMinima: Number(fila.ExistenciaMinima)
      })),
      ultimasOperaciones: ultimasOperaciones.map((pedido) => ({
        idPedido: pedido.idPedido,
        nombreDelCliente: pedido.cliente?.nombre ?? '',
        total: pedido.total,
        estado: pedido.estado,
        tipoOperacion: pedido.tipoOperacion,
        fecha: pedido.fecha
      })),
      serieDeLaSemana: this.generarRangoDeFechas(fechaInicioDeLaSemana, hoy).map((fecha) => {
        const fila = serie.find((punto) => punto.fecha === fecha);
        const total = fila ? Number(fila.total) : 0;
        const costo = fila ? Number(fila.costo) : 0;
        return { fecha, totalVendido: redondearMoneda(total), ganancia: esAdministrador ? redondearMoneda(total - costo) : null };
      })
    };
  }

  private generarRangoDeFechas(desde: string, hasta: string): string[] {
    const fechas: string[] = [];
    const [anioDesde, mesDesde, diaDesde] = desde.split('-').map(Number);
    const [anioHasta, mesHasta, diaHasta] = hasta.split('-').map(Number);
    const cursor = new Date(anioDesde, mesDesde - 1, diaDesde);
    const fin = new Date(anioHasta, mesHasta - 1, diaHasta);

    while (cursor <= fin && fechas.length < 400) {
      fechas.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`);
      cursor.setDate(cursor.getDate() + 1);
    }

    return fechas;
  }

  private agruparPedidosPorCliente(pedidos: Pedido[]): ClienteConMonto[] {
    const mapa = new Map<number, ClienteConMonto>();

    for (const pedido of pedidos) {
      const acumulado = mapa.get(pedido.idCliente);
      if (acumulado === undefined) {
        mapa.set(pedido.idCliente, {
          idCliente: pedido.idCliente,
          nombreDelCliente: pedido.cliente?.nombre ?? '',
          cantidad: 1,
          monto: Number(pedido.total)
        });
      } else {
        acumulado.cantidad += 1;
        acumulado.monto = redondearMoneda(acumulado.monto + Number(pedido.total));
      }
    }

    return Array.from(mapa.values()).sort((a, b) => b.monto - a.monto);
  }

  private agruparCuentasPorCliente(cuentas: CuentaPorCobrarPagar[]): ClienteConMonto[] {
    const mapa = new Map<number, ClienteConMonto>();

    for (const cuenta of cuentas) {
      if (cuenta.idCliente === null) {
        continue;
      }

      const acumulado = mapa.get(cuenta.idCliente);
      if (acumulado === undefined) {
        mapa.set(cuenta.idCliente, {
          idCliente: cuenta.idCliente,
          nombreDelCliente: cuenta.cliente?.nombre ?? '',
          cantidad: 1,
          monto: Number(cuenta.saldoPendiente)
        });
      } else {
        acumulado.cantidad += 1;
        acumulado.monto = redondearMoneda(acumulado.monto + Number(cuenta.saldoPendiente));
      }
    }

    return Array.from(mapa.values()).sort((a, b) => b.monto - a.monto);
  }
}
