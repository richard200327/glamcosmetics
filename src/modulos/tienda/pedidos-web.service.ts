import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Cliente, DetallePedidoWeb, PedidoWeb } from '../../comun/entidades';
import { PedidosService } from '../pedidos/pedidos.service';
import { ReservasService } from '../reservas/reservas.service';
import { TiendaService } from './tienda.service';
import { ConvertirPedidoWebDto, CrearPedidoWebDto, EliminarPedidoWebDto } from './dto/tienda.dto';
import { generarCodigoDePedido, limpiarTexto, normalizarDocumento } from './texto';
import { LoggerDeAplicacion } from '../../comun/logger/logger-de-aplicacion';
import { redondearMoneda } from '../../comun/utilidades/fechas';

interface FilaDeProductoBloqueado {
  IdProducto: number;
  Descripcion: string;
  NombreDeVariante: string | null;
  CodigoHex: string | null;
  PrecioUnitario: string;
  Existencia: number;
  Activo: number;
  IdProductoCatalogo: number | null;
  Visible: number | null;
  NombreCatalogo: string | null;
  Marca: string | null;
}

@Injectable()
export class PedidosWebService {
  private readonly logger = new LoggerDeAplicacion('PedidosWebService');

  constructor(
    @InjectRepository(PedidoWeb)
    private readonly repositorioDePedidosWeb: Repository<PedidoWeb>,
    private readonly reservasService: ReservasService,
    private readonly tiendaService: TiendaService,
    private readonly pedidosService: PedidosService,
    private readonly dataSource: DataSource
  ) {}

  public async crear(datos: CrearPedidoWebDto, claveDeIdempotencia: string | null, ip: string | null) {
    if (claveDeIdempotencia) {
      const existente = await this.repositorioDePedidosWeb
        .createQueryBuilder('pedido')
        .leftJoinAndSelect('pedido.detalles', 'detalles')
        .where('pedido.claveDeIdempotencia = :clave', { clave: claveDeIdempotencia })
        .getOne();
      if (existente) {
        return this.vistaPublica(existente);
      }
    }

    const configuracion = await this.tiendaService.obtenerConfiguracion();
    const cantidades = new Map<number, number>();
    for (const linea of datos.lineas) {
      cantidades.set(linea.idProducto, (cantidades.get(linea.idProducto) ?? 0) + linea.cantidad);
    }
    const ids = [...cantidades.keys()];

    const idPedidoWeb = await this.dataSource.transaction(async (manager) => {
      const productos: FilaDeProductoBloqueado[] = await manager.query(
        `SELECT p.IdProducto, p.Descripcion, p.NombreDeVariante, p.CodigoHex, p.PrecioUnitario, p.Existencia, p.Activo, p.IdProductoCatalogo,
                pc.Visible, pc.Nombre AS NombreCatalogo, m.Nombre AS Marca
         FROM Producto p
         LEFT JOIN ProductoDeCatalogo pc ON pc.IdProductoCatalogo = p.IdProductoCatalogo
         LEFT JOIN Marca m ON m.IdMarca = pc.IdMarca
         WHERE p.IdProducto IN (?) FOR UPDATE`,
        [ids]
      );
      const reservas = await this.reservasService.obtenerReservas(ids, null, manager);
      const detalles: Partial<DetallePedidoWeb>[] = [];
      let total = 0;

      for (const idProducto of ids) {
        const producto = productos.find((fila) => Number(fila.IdProducto) === idProducto);
        if (!producto || !Number(producto.Activo) || producto.IdProductoCatalogo === null || !Number(producto.Visible)) {
          throw new BadRequestException('Uno de los productos de tu carrito ya no esta disponible. Revisa el carrito.');
        }
        const cantidad = cantidades.get(idProducto) as number;
        const disponible = Number(producto.Existencia) - (reservas.get(idProducto) ?? 0);
        const nombre = [producto.Marca, producto.NombreCatalogo].filter(Boolean).join(' ') || producto.Descripcion;
        if (disponible < cantidad) {
          throw new BadRequestException(
            disponible <= 0
              ? `${nombre}${producto.NombreDeVariante ? ` (${producto.NombreDeVariante})` : ''} se agoto. Quitalo del carrito para continuar.`
              : `De ${nombre}${producto.NombreDeVariante ? ` (${producto.NombreDeVariante})` : ''} solo quedan ${disponible} unidades.`
          );
        }
        const precio = Number(producto.PrecioUnitario);
        const subtotal = redondearMoneda(precio * cantidad);
        total = redondearMoneda(total + subtotal);
        detalles.push({
          idProducto,
          idProductoCatalogo: producto.IdProductoCatalogo,
          descripcion: nombre.slice(0, 250),
          nombreDeVariante: producto.NombreDeVariante,
          codigoHex: producto.CodigoHex,
          cantidad,
          precioUnitario: precio,
          subtotal
        });
      }

      if (configuracion.montoMinimoDePedido > 0 && total < configuracion.montoMinimoDePedido) {
        throw new BadRequestException(`El pedido minimo es de $${configuracion.montoMinimoDePedido.toFixed(2)}.`);
      }

      let codigo = generarCodigoDePedido();
      for (let intento = 0; intento < 10; intento += 1) {
        const [repetido] = await manager.query('SELECT 1 FROM PedidoWeb WHERE Codigo = ?', [codigo]);
        if (!repetido) {
          break;
        }
        codigo = generarCodigoDePedido();
      }

      const pedido = await manager.save(
        manager.create(PedidoWeb, {
          codigo,
          nombreDelCliente: datos.cliente.nombre.trim(),
          cedula: datos.cliente.cedula.trim().toUpperCase(),
          telefono: datos.cliente.telefono.trim(),
          direccion: datos.cliente.direccion.trim(),
          notas: limpiarTexto(datos.cliente.notas),
          total,
          cantidadDeArticulos: [...cantidades.values()].reduce((suma, cantidad) => suma + cantidad, 0),
          estado: 'Pendiente',
          claveDeIdempotencia,
          ipDeOrigen: ip?.slice(0, 45) ?? null,
          detalles: detalles.map((detalle) => manager.create(DetallePedidoWeb, detalle))
        })
      );
      return pedido.idPedidoWeb;
    });

    const pedido = (await this.repositorioDePedidosWeb.findOne({ where: { idPedidoWeb } })) as PedidoWeb;
    this.logger.log('Pedido web recibido', { idPedidoWeb, codigo: pedido.codigo, total: pedido.total });
    return this.vistaPublica(pedido);
  }

  public async obtenerPorCodigo(codigo: string) {
    const pedido = await this.repositorioDePedidosWeb.findOne({ where: { codigo: codigo.toUpperCase() } });
    if (pedido === null) {
      throw new NotFoundException('No encontramos ese pedido.');
    }
    return this.vistaPublica(pedido);
  }

  public async obtenerLista(estado: string, buscar: string) {
    const consulta = this.repositorioDePedidosWeb
      .createQueryBuilder('pedido')
      .leftJoinAndSelect('pedido.detalles', 'detalles')
      .orderBy('pedido.fechaCreacion', estado === 'Pendiente' ? 'ASC' : 'DESC')
      .take(300);
    if (estado) {
      consulta.andWhere(estado === 'Pendiente' ? "pedido.estado IN ('Pendiente', 'Convirtiendo')" : 'pedido.estado = :estado', { estado });
    }
    const texto = buscar.trim();
    if (texto) {
      consulta.andWhere('(pedido.codigo LIKE :texto OR pedido.nombreDelCliente LIKE :texto OR pedido.cedula LIKE :texto OR pedido.telefono LIKE :texto)', { texto: `%${texto}%` });
    }
    const pedidos = await consulta.getMany();
    return this.agregarImagenes(pedidos);
  }

  public async obtenerPorId(idPedidoWeb: number) {
    const pedido = await this.repositorioDePedidosWeb.findOne({ where: { idPedidoWeb } });
    if (pedido === null) {
      throw new NotFoundException('Pedido del catalogo no encontrado.');
    }
    const [conImagenes] = await this.agregarImagenes([pedido]);
    return conImagenes;
  }

  public async resumen() {
    const [fila] = await this.dataSource.query(
      "SELECT COUNT(*) AS Cantidad, COALESCE(SUM(Total), 0) AS Total FROM PedidoWeb WHERE Estado IN ('Pendiente', 'Convirtiendo')"
    );
    return { pendientes: Number(fila.Cantidad), totalPendiente: redondearMoneda(Number(fila.Total)) };
  }

  public async evaluar(idPedidoWeb: number) {
    const pedido = await this.obtenerPendiente(idPedidoWeb);
    const calculo = await this.pedidosService.evaluarLineas({
      detalles: pedido.detalles.map((detalle) => ({ idProducto: detalle.idProducto, cantidad: detalle.cantidad })),
      idPedidoWeb
    } as never);
    return { totalDelPedidoWeb: pedido.total, totalActual: calculo.totalFinal, calculo };
  }

  public async convertir(idPedidoWeb: number, datos: ConvertirPedidoWebDto, idUsuario: number) {
    const bloqueo = await this.dataSource.query("UPDATE PedidoWeb SET Estado = 'Convirtiendo' WHERE IdPedidoWeb = ? AND Estado = 'Pendiente'", [idPedidoWeb]);
    if (!bloqueo.affectedRows) {
      const actual = await this.repositorioDePedidosWeb.findOne({ where: { idPedidoWeb } });
      if (actual === null) {
        throw new NotFoundException('Pedido del catalogo no encontrado.');
      }
      throw new ConflictException(actual.estado === 'Convirtiendo' ? 'Este pedido se esta procesando en este momento.' : `Este pedido ya esta ${actual.estado.toLowerCase()}.`);
    }

    try {
      const pedidoWeb = (await this.repositorioDePedidosWeb.findOne({ where: { idPedidoWeb } })) as PedidoWeb;
      const cliente = await this.obtenerOCrearCliente(pedidoWeb);
      const esContado = datos.tipo === 'Contado';
      const referencia = `Pedido del catalogo ${pedidoWeb.codigo}. Entrega: ${pedidoWeb.direccion}${pedidoWeb.notas ? `. Nota: ${pedidoWeb.notas}` : ''}`;
      const creado = await this.pedidosService.crearPedido(
        {
          idCliente: cliente.idCliente,
          tipoOperacion: esContado ? 'Venta' : 'Pedido',
          esContado,
          diasDeCredito: esContado ? undefined : datos.diasDeCredito ?? 15,
          detalles: pedidoWeb.detalles.map((detalle) => ({ idProducto: detalle.idProducto, cantidad: detalle.cantidad })),
          pagosDeContado: datos.pagos ?? [],
          observaciones: (limpiarTexto(datos.observaciones) ? `${datos.observaciones?.trim()} · ${referencia}` : referencia).slice(0, 250),
          idPedidoWeb
        } as never,
        idUsuario,
        `pedido-web-${idPedidoWeb}`
      );
      await this.repositorioDePedidosWeb.update(
        { idPedidoWeb },
        { estado: 'Convertido', idPedido: creado.idPedido, idCliente: cliente.idCliente, fechaDeGestion: new Date(), idUsuarioQueGestiono: idUsuario }
      );
      this.logger.log('Pedido web convertido', { idPedidoWeb, idPedido: creado.idPedido, tipo: datos.tipo });
      return { ...(await this.obtenerPorId(idPedidoWeb)), idPedido: creado.idPedido };
    } catch (error) {
      await this.dataSource.query("UPDATE PedidoWeb SET Estado = 'Pendiente' WHERE IdPedidoWeb = ? AND Estado = 'Convirtiendo'", [idPedidoWeb]);
      throw error;
    }
  }

  public async eliminar(idPedidoWeb: number, datos: EliminarPedidoWebDto, idUsuario: number) {
    const resultado = await this.dataSource.query(
      "UPDATE PedidoWeb SET Estado = 'Eliminado', MotivoDeEliminacion = ?, FechaDeGestion = NOW(), IdUsuarioQueGestiono = ? WHERE IdPedidoWeb = ? AND Estado = 'Pendiente'",
      [datos.motivo.trim(), idUsuario, idPedidoWeb]
    );
    if (!resultado.affectedRows) {
      throw new ConflictException('Solo se pueden eliminar pedidos pendientes.');
    }
    this.logger.warn('Pedido web eliminado', { idPedidoWeb, idUsuario });
    return this.obtenerPorId(idPedidoWeb);
  }

  private async obtenerPendiente(idPedidoWeb: number): Promise<PedidoWeb> {
    const pedido = await this.repositorioDePedidosWeb.findOne({ where: { idPedidoWeb } });
    if (pedido === null) {
      throw new NotFoundException('Pedido del catalogo no encontrado.');
    }
    if (pedido.estado !== 'Pendiente') {
      throw new ConflictException(`Este pedido ya esta ${pedido.estado.toLowerCase()}.`);
    }
    return pedido;
  }

  private async obtenerOCrearCliente(pedido: PedidoWeb): Promise<Cliente> {
    const documento = normalizarDocumento(pedido.cedula);
    const [existente] = await this.dataSource.query(
      "SELECT IdCliente FROM Cliente WHERE REPLACE(REPLACE(REPLACE(REPLACE(UPPER(Documento), '-', ''), '.', ''), ' ', ''), '_', '') = ? LIMIT 1",
      [documento]
    );
    if (existente) {
      const cliente = (await this.dataSource.manager.findOne(Cliente, { where: { idCliente: Number(existente.IdCliente) } })) as Cliente;
      const cambios: Partial<Cliente> = {};
      if (!cliente.telefono) {
        cambios.telefono = pedido.telefono;
      }
      if (!cliente.direccion) {
        cambios.direccion = pedido.direccion.slice(0, 250);
      }
      if (!cliente.activo) {
        cambios.activo = true;
      }
      if (Object.keys(cambios).length > 0) {
        await this.dataSource.manager.update(Cliente, { idCliente: cliente.idCliente }, cambios);
      }
      return cliente;
    }
    return this.dataSource.manager.save(
      this.dataSource.manager.create(Cliente, {
        nombre: pedido.nombreDelCliente,
        documento: pedido.cedula,
        telefono: pedido.telefono,
        direccion: pedido.direccion.slice(0, 250),
        correo: null,
        activo: true
      })
    );
  }

  private async agregarImagenes(pedidos: PedidoWeb[]) {
    const idsDeProducto = [...new Set(pedidos.flatMap((pedido) => pedido.detalles.map((detalle) => detalle.idProducto)))];
    const idsDeCatalogo = [...new Set(pedidos.flatMap((pedido) => pedido.detalles.map((detalle) => detalle.idProductoCatalogo).filter((id): id is number => id !== null)))];
    const imagenes: { IdImagen: number; IdProducto: number | null; IdProductoCatalogo: number }[] =
      idsDeCatalogo.length > 0
        ? await this.dataSource.query('SELECT IdImagen, IdProducto, IdProductoCatalogo FROM ImagenDeCatalogo WHERE IdProductoCatalogo IN (?) ORDER BY Orden, IdImagen', [idsDeCatalogo])
        : [];
    const existencias: { IdProducto: number; Existencia: number }[] =
      idsDeProducto.length > 0 ? await this.dataSource.query('SELECT IdProducto, Existencia FROM Producto WHERE IdProducto IN (?)', [idsDeProducto]) : [];

    return pedidos.map((pedido) => ({
      ...pedido,
      detalles: pedido.detalles.map((detalle) => {
        const propia = imagenes.find((imagen) => Number(imagen.IdProducto) === detalle.idProducto);
        const general = imagenes.find((imagen) => Number(imagen.IdProductoCatalogo) === detalle.idProductoCatalogo);
        return {
          ...detalle,
          idImagen: propia ? Number(propia.IdImagen) : general ? Number(general.IdImagen) : null,
          existenciaActual: Number(existencias.find((fila) => Number(fila.IdProducto) === detalle.idProducto)?.Existencia ?? 0)
        };
      })
    }));
  }

  private vistaPublica(pedido: PedidoWeb) {
    return {
      codigo: pedido.codigo,
      estado: pedido.estado === 'Convirtiendo' ? 'Pendiente' : pedido.estado,
      fechaCreacion: pedido.fechaCreacion,
      nombreDelCliente: pedido.nombreDelCliente,
      cedula: pedido.cedula,
      telefono: pedido.telefono,
      direccion: pedido.direccion,
      notas: pedido.notas,
      total: pedido.total,
      cantidadDeArticulos: pedido.cantidadDeArticulos,
      detalles: (pedido.detalles ?? []).map((detalle) => ({
        idProducto: detalle.idProducto,
        descripcion: detalle.descripcion,
        nombreDeVariante: detalle.nombreDeVariante,
        codigoHex: detalle.codigoHex,
        cantidad: detalle.cantidad,
        precioUnitario: detalle.precioUnitario,
        subtotal: detalle.subtotal
      }))
    };
  }
}
