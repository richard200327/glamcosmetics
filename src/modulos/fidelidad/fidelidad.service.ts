import { BadRequestException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { LoggerDeAplicacion } from '../../comun/logger/logger-de-aplicacion';
import { ActualizarFidelidadDto, CanjearPremioDto } from './fidelidad.dto';

export type TipoDePremio = 'producto' | 'porcentaje' | 'monto' | 'otro';

export interface ConfiguracionDeFidelidad {
  activo: boolean;
  meta: number;
  montoMinimo: number;
  soloPagadas: boolean;
  tipoDePremio: TipoDePremio;
  idProducto: number | null;
  cantidadDelProducto: number;
  valorDelDescuento: number;
  descripcionDelPremio: string;
  mensajeProgreso: string;
  mensajeMeta: string;
}

export const FIDELIDAD_POR_DEFECTO: ConfiguracionDeFidelidad = {
  activo: true,
  meta: 5,
  montoMinimo: 0,
  soloPagadas: false,
  tipoDePremio: 'porcentaje',
  idProducto: null,
  cantidadDelProducto: 1,
  valorDelDescuento: 10,
  descripcionDelPremio: '',
  mensajeProgreso:
    'Hola {nombre} ✨ Tienes {compras} de {meta} compras con nosotros en {tienda}. Si llegas a {meta}, recibirás un premio exclusivo para ti. ¡Te faltan {faltan}!',
  mensajeMeta: '¡Felicidades, {nombre}! 🎉 Llegaste a {meta} compras con {tienda}. Tu premio exclusivo: {premio}. Escríbenos para coordinar la entrega.'
};

export interface ClienteDeFidelidad {
  idCliente: number;
  nombre: string;
  documento: string;
  telefono: string | null;
  compras: number;
  meta: number;
  faltan: number;
  alcanzoLaMeta: boolean;
  gastadoEnElCiclo: number;
  ultimaCompra: string | null;
  canjes: number;
  ultimoCanje: string | null;
}

export function describirPremio(configuracion: ConfiguracionDeFidelidad, nombreDelProducto: string | null): string {
  if (configuracion.descripcionDelPremio.trim() !== '') {
    return configuracion.descripcionDelPremio.trim();
  }
  switch (configuracion.tipoDePremio) {
    case 'producto':
      return nombreDelProducto
        ? `${configuracion.cantidadDelProducto > 1 ? `${configuracion.cantidadDelProducto} x ` : ''}${nombreDelProducto} de regalo`
        : 'un producto de regalo';
    case 'porcentaje':
      return `${configuracion.valorDelDescuento}% de descuento en tu próxima compra`;
    case 'monto':
      return `$${configuracion.valorDelDescuento.toFixed(2)} de descuento en tu próxima compra`;
    default:
      return 'un premio sorpresa';
  }
}

export function leerConfiguracionDeFidelidad(guardada: string | null): ConfiguracionDeFidelidad {
  try {
    const datos = guardada ? (JSON.parse(guardada) as Partial<ConfiguracionDeFidelidad>) : {};
    return { ...FIDELIDAD_POR_DEFECTO, ...datos };
  } catch {
    return { ...FIDELIDAD_POR_DEFECTO };
  }
}

@Injectable()
export class FidelidadService implements OnModuleInit {
  private readonly logger = new LoggerDeAplicacion('FidelidadService');

  constructor(private readonly dataSource: DataSource) {}

  public async onModuleInit(): Promise<void> {
    const [columna] = await this.dataSource.query(
      "SELECT COUNT(*) AS Cantidad FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ConfiguracionDeTienda' AND COLUMN_NAME = 'Fidelidad'"
    );
    if (Number(columna?.Cantidad ?? 0) === 0) {
      await this.dataSource.query('ALTER TABLE ConfiguracionDeTienda ADD COLUMN Fidelidad MEDIUMTEXT NULL');
      this.logger.log('Columna agregada', { tabla: 'ConfiguracionDeTienda', columna: 'Fidelidad' });
    }
    await this.dataSource.query(
      `CREATE TABLE IF NOT EXISTS CanjeDeFidelidad (
        IdCanje INT AUTO_INCREMENT PRIMARY KEY,
        IdCliente INT NOT NULL,
        Fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        ComprasContadas INT NOT NULL,
        Premio VARCHAR(250) NOT NULL,
        TipoDePremio VARCHAR(20) NOT NULL,
        IdUsuario INT NULL,
        Notas VARCHAR(250) NULL,
        KEY IX_CanjeDeFidelidad_Cliente (IdCliente, Fecha)
      )`
    );
  }

  public async obtenerConfiguracion() {
    const configuracion = await this.leer();
    return { ...configuracion, premio: await this.textoDelPremio(configuracion), nombreDelProducto: await this.nombreDelProducto(configuracion.idProducto) };
  }

  public async actualizarConfiguracion(datos: ActualizarFidelidadDto) {
    const actual = await this.leer();
    const siguiente: ConfiguracionDeFidelidad = { ...actual };
    for (const [clave, valor] of Object.entries(datos)) {
      if (valor !== undefined) {
        (siguiente as unknown as Record<string, unknown>)[clave] = typeof valor === 'string' ? valor.trim() : valor;
      }
    }
    if (siguiente.tipoDePremio === 'producto') {
      if (!siguiente.idProducto) {
        throw new BadRequestException('Elige el producto que se regala.');
      }
      if ((await this.nombreDelProducto(siguiente.idProducto)) === null) {
        throw new BadRequestException('El producto de regalo no existe.');
      }
    }
    if (!siguiente.mensajeProgreso) {
      siguiente.mensajeProgreso = FIDELIDAD_POR_DEFECTO.mensajeProgreso;
    }
    if (!siguiente.mensajeMeta) {
      siguiente.mensajeMeta = FIDELIDAD_POR_DEFECTO.mensajeMeta;
    }
    const resultado = await this.dataSource.query('UPDATE ConfiguracionDeTienda SET Fidelidad = ? WHERE IdConfiguracion = 1', [JSON.stringify(siguiente)]);
    if (!resultado?.affectedRows) {
      await this.dataSource.query('INSERT INTO ConfiguracionDeTienda (IdConfiguracion, Fidelidad) VALUES (1, ?)', [JSON.stringify(siguiente)]);
    }
    return this.obtenerConfiguracion();
  }

  public async obtenerClientes(buscar: string, estado: string, pagina: number, limite: number) {
    const configuracion = await this.leer();
    const todos = await this.calcular(configuracion, buscar);
    const filtrados = todos.filter((cliente) =>
      estado === 'alcanzaron' ? cliente.alcanzoLaMeta : estado === 'cerca' ? !cliente.alcanzoLaMeta && cliente.compras > 0 && cliente.faltan <= Math.max(1, Math.ceil(configuracion.meta * 0.2)) : true
    );
    const resumen = {
      participantes: todos.length,
      alcanzaron: todos.filter((cliente) => cliente.alcanzoLaMeta).length,
      cerca: todos.filter((cliente) => !cliente.alcanzoLaMeta && cliente.compras > 0 && cliente.faltan <= Math.max(1, Math.ceil(configuracion.meta * 0.2))).length,
      premiosEntregados: todos.reduce((suma, cliente) => suma + cliente.canjes, 0)
    };
    return {
      elementos: filtrados.slice((pagina - 1) * limite, pagina * limite),
      total: filtrados.length,
      pagina,
      limite,
      resumen,
      configuracion: { ...configuracion, premio: await this.textoDelPremio(configuracion) }
    };
  }

  public async obtenerCanjes(idCliente: number) {
    return this.dataSource.query(
      `SELECT f.IdCanje AS idCanje, f.Fecha AS fecha, f.ComprasContadas AS comprasContadas, f.Premio AS premio, f.TipoDePremio AS tipoDePremio, f.Notas AS notas, u.NombreUsuario AS usuario
       FROM CanjeDeFidelidad f LEFT JOIN Usuario u ON u.IdUsuario = f.IdUsuario
       WHERE f.IdCliente = ? ORDER BY f.Fecha DESC`,
      [idCliente]
    );
  }

  public async canjear(idCliente: number, datos: CanjearPremioDto, idUsuario: number) {
    const configuracion = await this.leer();
    const [cliente] = await this.calcular(configuracion, '', idCliente);
    if (!cliente) {
      throw new NotFoundException('La clienta no tiene compras registradas.');
    }
    if (!cliente.alcanzoLaMeta) {
      throw new BadRequestException(`A ${cliente.nombre} le faltan ${cliente.faltan} compras para el premio.`);
    }
    const premio = await this.textoDelPremio(configuracion);
    await this.dataSource.query(
      'INSERT INTO CanjeDeFidelidad (IdCliente, Fecha, ComprasContadas, Premio, TipoDePremio, IdUsuario, Notas) VALUES (?, NOW(), ?, ?, ?, ?, ?)',
      [idCliente, cliente.compras, premio.slice(0, 250), configuracion.tipoDePremio, idUsuario, datos.notas?.trim() || null]
    );
    this.logger.log('Premio de fidelidad entregado', { idCliente, premio, compras: cliente.compras });
    const [actualizado] = await this.calcular(configuracion, '', idCliente);
    return actualizado ?? { ...cliente, compras: 0, faltan: configuracion.meta, alcanzoLaMeta: false };
  }

  private async calcular(configuracion: ConfiguracionDeFidelidad, buscar: string, idCliente?: number): Promise<ClienteDeFidelidad[]> {
    const condicionDeEstado = configuracion.soloPagadas ? "p.Estado = 'Pagado'" : "p.Estado <> 'Anulado'";
    const condiciones = ['t.UltimaCompra IS NOT NULL'];
    const parametrosExternos: unknown[] = [];
    const texto = buscar.trim();
    if (texto) {
      condiciones.push('(t.Nombre LIKE ? OR t.Documento LIKE ? OR t.Telefono LIKE ?)');
      parametrosExternos.push(`%${texto}%`, `%${texto}%`, `%${texto}%`);
    }
    if (idCliente !== undefined) {
      condiciones.push('t.IdCliente = ?');
      parametrosExternos.push(idCliente);
    }
    const filas: Record<string, unknown>[] = await this.dataSource.query(
      `SELECT * FROM (
         SELECT c.IdCliente, c.Nombre, c.Documento, c.Telefono,
           (SELECT MAX(f.Fecha) FROM CanjeDeFidelidad f WHERE f.IdCliente = c.IdCliente) AS UltimoCanje,
           (SELECT COUNT(*) FROM CanjeDeFidelidad f WHERE f.IdCliente = c.IdCliente) AS Canjes,
           (SELECT COUNT(*) FROM Pedido p WHERE p.IdCliente = c.IdCliente AND ${condicionDeEstado} AND p.Total >= ?
              AND p.Fecha > COALESCE((SELECT MAX(f2.Fecha) FROM CanjeDeFidelidad f2 WHERE f2.IdCliente = c.IdCliente), '1900-01-01')) AS Compras,
           (SELECT COALESCE(SUM(p.Total), 0) FROM Pedido p WHERE p.IdCliente = c.IdCliente AND ${condicionDeEstado} AND p.Total >= ?
              AND p.Fecha > COALESCE((SELECT MAX(f3.Fecha) FROM CanjeDeFidelidad f3 WHERE f3.IdCliente = c.IdCliente), '1900-01-01')) AS Gastado,
           (SELECT MAX(p.Fecha) FROM Pedido p WHERE p.IdCliente = c.IdCliente AND ${condicionDeEstado}) AS UltimaCompra
         FROM Cliente c
         WHERE c.Activo = 1
       ) t
       WHERE ${condiciones.join(' AND ')}`,
      [configuracion.montoMinimo, configuracion.montoMinimo, ...parametrosExternos]
    );
    return filas
      .map((fila) => {
        const compras = Number(fila.Compras ?? 0);
        return {
          idCliente: Number(fila.IdCliente),
          nombre: String(fila.Nombre),
          documento: String(fila.Documento ?? ''),
          telefono: (fila.Telefono as string | null) ?? null,
          compras,
          meta: configuracion.meta,
          faltan: Math.max(configuracion.meta - compras, 0),
          alcanzoLaMeta: compras >= configuracion.meta,
          gastadoEnElCiclo: Math.round(Number(fila.Gastado ?? 0) * 100) / 100,
          ultimaCompra: fila.UltimaCompra ? new Date(fila.UltimaCompra as string).toISOString() : null,
          canjes: Number(fila.Canjes ?? 0),
          ultimoCanje: fila.UltimoCanje ? new Date(fila.UltimoCanje as string).toISOString() : null
        };
      })
      .sort((a, b) => Number(b.alcanzoLaMeta) - Number(a.alcanzoLaMeta) || b.compras - a.compras || a.nombre.localeCompare(b.nombre));
  }

  private async leer(): Promise<ConfiguracionDeFidelidad> {
    const [fila] = await this.dataSource.query('SELECT Fidelidad FROM ConfiguracionDeTienda WHERE IdConfiguracion = 1');
    return leerConfiguracionDeFidelidad((fila?.Fidelidad as string | null) ?? null);
  }

  private async textoDelPremio(configuracion: ConfiguracionDeFidelidad): Promise<string> {
    return describirPremio(configuracion, await this.nombreDelProducto(configuracion.idProducto));
  }

  private async nombreDelProducto(idProducto: number | null): Promise<string | null> {
    if (!idProducto) {
      return null;
    }
    const [fila] = await this.dataSource.query('SELECT Descripcion FROM Producto WHERE IdProducto = ?', [idProducto]);
    return fila ? String(fila.Descripcion) : null;
  }
}
