import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ReservasService } from '../reservas/reservas.service';
import { TiendaService } from './tienda.service';

export interface FiltrosDelCatalogo {
  buscar?: string;
  marca?: string;
  categoria?: string;
  color?: number;
  orden?: string;
  pagina: number;
  limite: number;
  soloDestacados?: boolean;
  excluir?: number;
}

interface FilaDeVariante {
  IdProducto: number;
  IdProductoCatalogo: number;
  NombreDeVariante: string | null;
  CodigoHex: string | null;
  IdFamiliaDeColor: number | null;
  PrecioUnitario: string;
  Existencia: number;
}

@Injectable()
export class CatalogoPublicoService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly reservasService: ReservasService,
    private readonly tiendaService: TiendaService
  ) {}

  public async obtenerTienda() {
    const configuracion = await this.tiendaService.obtenerConfiguracion();
    const [tasa] = await this.dataSource.query('SELECT ValorTasaBcv, Fecha FROM TasaDeCambio ORDER BY Fecha DESC LIMIT 1');
    return {
      nombreDeLaTienda: configuracion.nombreDeLaTienda,
      eslogan: configuracion.eslogan,
      numeroDeWhatsApp: configuracion.numeroDeWhatsApp,
      instagram: configuracion.instagram,
      direccion: configuracion.direccion,
      horarioDeAtencion: configuracion.horarioDeAtencion,
      mensajeDeEnvio: configuracion.mensajeDeEnvio,
      mostrarPreciosEnBolivares: configuracion.mostrarPreciosEnBolivares,
      montoMinimoDePedido: configuracion.montoMinimoDePedido,
      valorTasaBcv: tasa ? Number(tasa.ValorTasaBcv) : null
    };
  }

  public async obtenerFiltros() {
    const marcas = await this.dataSource.query(
      `SELECT m.IdMarca AS idMarca, m.Nombre AS nombre, m.Slug AS slug, COUNT(DISTINCT pc.IdProductoCatalogo) AS cantidad
       FROM Marca m INNER JOIN ProductoDeCatalogo pc ON pc.IdMarca = m.IdMarca AND pc.Visible = 1
       INNER JOIN Producto p ON p.IdProductoCatalogo = pc.IdProductoCatalogo AND p.Activo = 1
       WHERE m.Activa = 1 GROUP BY m.IdMarca ORDER BY m.Orden, m.Nombre`
    );
    const categorias = await this.dataSource.query(
      `SELECT c.IdCategoria AS idCategoria, c.Nombre AS nombre, c.Slug AS slug, COUNT(DISTINCT pc.IdProductoCatalogo) AS cantidad
       FROM Categoria c INNER JOIN ProductoDeCatalogo pc ON pc.IdCategoria = c.IdCategoria AND pc.Visible = 1
       INNER JOIN Producto p ON p.IdProductoCatalogo = pc.IdProductoCatalogo AND p.Activo = 1
       WHERE c.Activa = 1 GROUP BY c.IdCategoria ORDER BY c.Orden, c.Nombre`
    );
    const colores = await this.dataSource.query(
      `SELECT f.IdFamiliaDeColor AS idFamiliaDeColor, f.Nombre AS nombre, f.CodigoHex AS codigoHex, COUNT(DISTINCT pc.IdProductoCatalogo) AS cantidad
       FROM FamiliaDeColor f INNER JOIN Producto p ON p.IdFamiliaDeColor = f.IdFamiliaDeColor AND p.Activo = 1
       INNER JOIN ProductoDeCatalogo pc ON pc.IdProductoCatalogo = p.IdProductoCatalogo AND pc.Visible = 1
       WHERE f.Activa = 1 GROUP BY f.IdFamiliaDeColor ORDER BY f.Orden, f.Nombre`
    );
    const numero = (lista: { cantidad: string }[]) => lista.map((fila) => ({ ...fila, cantidad: Number(fila.cantidad) }));
    return { marcas: numero(marcas), categorias: numero(categorias), colores: numero(colores) };
  }

  public async obtenerProductos(filtros: FiltrosDelCatalogo) {
    const condiciones = ['pc.Visible = 1', '(m.IdMarca IS NULL OR m.Activa = 1)', '(c.IdCategoria IS NULL OR c.Activa = 1)'];
    const parametros: unknown[] = [];

    if (filtros.marca) {
      condiciones.push('m.Slug = ?');
      parametros.push(filtros.marca);
    }
    if (filtros.categoria) {
      condiciones.push('c.Slug = ?');
      parametros.push(filtros.categoria);
    }
    if (filtros.color) {
      condiciones.push('EXISTS (SELECT 1 FROM Producto pf WHERE pf.IdProductoCatalogo = pc.IdProductoCatalogo AND pf.Activo = 1 AND pf.IdFamiliaDeColor = ?)');
      parametros.push(filtros.color);
    }
    if (filtros.soloDestacados) {
      condiciones.push('pc.Destacado = 1');
    }
    if (filtros.excluir) {
      condiciones.push('pc.IdProductoCatalogo != ?');
      parametros.push(filtros.excluir);
    }
    const palabras = (filtros.buscar ?? '').trim().split(/\s+/).filter(Boolean).slice(0, 6);
    for (const palabra of palabras) {
      condiciones.push(
        '(pc.Nombre LIKE ? OR m.Nombre LIKE ? OR c.Nombre LIKE ? OR EXISTS (SELECT 1 FROM Producto pb WHERE pb.IdProductoCatalogo = pc.IdProductoCatalogo AND pb.Activo = 1 AND pb.NombreDeVariante LIKE ?))'
      );
      const patron = `%${palabra.replace(/[\\%_]/g, (caracter) => `\\${caracter}`)}%`;
      parametros.push(patron, patron, patron, patron);
    }

    const ordenes: Record<string, string> = {
      'precio-asc': 'PrecioDesde ASC, pc.Nombre ASC',
      'precio-desc': 'PrecioDesde DESC, pc.Nombre ASC',
      nuevos: 'pc.FechaCreacion DESC',
      nombre: 'pc.Nombre ASC'
    };
    const orden = ordenes[filtros.orden ?? ''] ?? 'pc.Destacado DESC, pc.Orden ASC, pc.FechaCreacion DESC';
    const desde = `FROM ProductoDeCatalogo pc
       INNER JOIN Producto p ON p.IdProductoCatalogo = pc.IdProductoCatalogo AND p.Activo = 1
       LEFT JOIN Marca m ON m.IdMarca = pc.IdMarca
       LEFT JOIN Categoria c ON c.IdCategoria = pc.IdCategoria
       WHERE ${condiciones.join(' AND ')}`;

    const [conteo] = await this.dataSource.query(`SELECT COUNT(DISTINCT pc.IdProductoCatalogo) AS Total ${desde}`, parametros);
    const filas: Record<string, unknown>[] = await this.dataSource.query(
      `SELECT pc.IdProductoCatalogo, pc.Slug, pc.Nombre, pc.DescripcionCorta, pc.Atributos, pc.Destacado, pc.NombreDeLaVariante,
              m.Nombre AS Marca, m.Slug AS SlugMarca, c.Nombre AS Categoria, c.Slug AS SlugCategoria,
              MIN(p.PrecioUnitario) AS PrecioDesde, MAX(p.PrecioUnitario) AS PrecioHasta
       ${desde}
       GROUP BY pc.IdProductoCatalogo
       ORDER BY ${orden}
       LIMIT ? OFFSET ?`,
      [...parametros, filtros.limite, (filtros.pagina - 1) * filtros.limite]
    );

    return {
      elementos: await this.construirTarjetas(filas),
      total: Number(conteo?.Total ?? 0),
      pagina: filtros.pagina,
      limite: filtros.limite
    };
  }

  public async obtenerProductoPorSlug(slug: string) {
    const [fila] = await this.dataSource.query(
      `SELECT pc.*, m.Nombre AS Marca, m.Slug AS SlugMarca, c.Nombre AS Categoria, c.Slug AS SlugCategoria
       FROM ProductoDeCatalogo pc LEFT JOIN Marca m ON m.IdMarca = pc.IdMarca LEFT JOIN Categoria c ON c.IdCategoria = pc.IdCategoria
       WHERE pc.Slug = ? AND pc.Visible = 1`,
      [slug]
    );
    if (!fila) {
      throw new NotFoundException('Este producto ya no esta disponible.');
    }
    const idProductoCatalogo = Number(fila.IdProductoCatalogo);
    const configuracion = await this.tiendaService.obtenerConfiguracion();
    const variantes: (FilaDeVariante & { Familia: string | null })[] = await this.dataSource.query(
      `SELECT p.IdProducto, p.IdProductoCatalogo, p.NombreDeVariante, p.CodigoHex, p.IdFamiliaDeColor, p.PrecioUnitario, p.Existencia, f.Nombre AS Familia
       FROM Producto p LEFT JOIN FamiliaDeColor f ON f.IdFamiliaDeColor = p.IdFamiliaDeColor
       WHERE p.IdProductoCatalogo = ? AND p.Activo = 1 ORDER BY p.OrdenEnCatalogo, p.IdProducto`,
      [idProductoCatalogo]
    );
    if (variantes.length === 0) {
      throw new NotFoundException('Este producto ya no esta disponible.');
    }
    const reservas = await this.reservasService.obtenerReservas(variantes.map((variante) => Number(variante.IdProducto)));
    const imagenes = await this.dataSource.query(
      'SELECT IdImagen AS idImagen, IdProducto AS idProducto, Ancho AS ancho, Alto AS alto, TextoAlternativo AS textoAlternativo FROM ImagenDeCatalogo WHERE IdProductoCatalogo = ? ORDER BY Orden, IdImagen',
      [idProductoCatalogo]
    );
    const relacionados = fila.SlugCategoria
      ? await this.obtenerProductos({ categoria: String(fila.SlugCategoria), excluir: idProductoCatalogo, pagina: 1, limite: 8 })
      : { elementos: [] };

    return {
      idProductoCatalogo,
      slug: fila.Slug,
      nombre: fila.Nombre,
      marca: fila.Marca ?? null,
      slugMarca: fila.SlugMarca ?? null,
      categoria: fila.Categoria ?? null,
      slugCategoria: fila.SlugCategoria ?? null,
      descripcionCorta: fila.DescripcionCorta,
      descripcion: fila.Descripcion,
      modoDeUso: fila.ModoDeUso,
      ingredientes: fila.Ingredientes,
      atributos: this.separarAtributos(fila.Atributos),
      nombreDeLaVariante: fila.NombreDeLaVariante,
      variantes: variantes.map((variante) => {
        const disponible = Math.max(Number(variante.Existencia) - (reservas.get(Number(variante.IdProducto)) ?? 0), 0);
        return {
          idProducto: Number(variante.IdProducto),
          nombre: variante.NombreDeVariante,
          codigoHex: variante.CodigoHex,
          familia: variante.Familia,
          precio: Number(variante.PrecioUnitario),
          disponible: this.disponibleVisible(disponible, configuracion.mostrarExistenciaBaja, configuracion.umbralDeExistenciaBaja),
          agotado: disponible <= 0,
          maximo: Math.min(disponible, 50)
        };
      }),
      imagenes: imagenes.map((imagen: Record<string, unknown>) => ({
        idImagen: Number(imagen.idImagen),
        idProducto: imagen.idProducto !== null ? Number(imagen.idProducto) : null,
        ancho: Number(imagen.ancho),
        alto: Number(imagen.alto),
        textoAlternativo: imagen.textoAlternativo
      })),
      relacionados: relacionados.elementos
    };
  }

  private async construirTarjetas(filas: Record<string, unknown>[]) {
    const ids = filas.map((fila) => Number(fila.IdProductoCatalogo));
    if (ids.length === 0) {
      return [];
    }
    const configuracion = await this.tiendaService.obtenerConfiguracion();
    const variantes: FilaDeVariante[] = await this.dataSource.query(
      `SELECT IdProducto, IdProductoCatalogo, NombreDeVariante, CodigoHex, IdFamiliaDeColor, PrecioUnitario, Existencia
       FROM Producto WHERE IdProductoCatalogo IN (?) AND Activo = 1 ORDER BY OrdenEnCatalogo, IdProducto`,
      [ids]
    );
    const reservas = await this.reservasService.obtenerReservas(variantes.map((variante) => Number(variante.IdProducto)));
    const imagenes: { IdProductoCatalogo: number; IdImagen: number; IdProducto: number | null }[] = await this.dataSource.query(
      'SELECT IdProductoCatalogo, IdImagen, IdProducto FROM ImagenDeCatalogo WHERE IdProductoCatalogo IN (?) ORDER BY Orden, IdImagen',
      [ids]
    );

    return filas.map((fila) => {
      const idProductoCatalogo = Number(fila.IdProductoCatalogo);
      const propias = variantes.filter((variante) => Number(variante.IdProductoCatalogo) === idProductoCatalogo);
      const imagenesPropias = imagenes.filter((imagen) => Number(imagen.IdProductoCatalogo) === idProductoCatalogo);
      const disponibles = propias.map((variante) => Math.max(Number(variante.Existencia) - (reservas.get(Number(variante.IdProducto)) ?? 0), 0));
      const disponibleTotal = disponibles.reduce((suma, valor) => suma + valor, 0);
      return {
        idProductoCatalogo,
        slug: fila.Slug,
        nombre: fila.Nombre,
        marca: fila.Marca ?? null,
        categoria: fila.Categoria ?? null,
        descripcionCorta: fila.DescripcionCorta,
        atributos: this.separarAtributos(fila.Atributos as string | null),
        destacado: Boolean(Number(fila.Destacado)),
        nombreDeLaVariante: fila.NombreDeLaVariante,
        precioDesde: Number(fila.PrecioDesde),
        precioHasta: Number(fila.PrecioHasta),
        idImagenPrincipal: imagenesPropias[0] ? Number(imagenesPropias[0].IdImagen) : null,
        idImagenSecundaria: imagenesPropias[1] ? Number(imagenesPropias[1].IdImagen) : null,
        variantes: propias.map((variante, indice) => ({
          idProducto: Number(variante.IdProducto),
          nombre: variante.NombreDeVariante,
          codigoHex: variante.CodigoHex,
          precio: Number(variante.PrecioUnitario),
          agotado: disponibles[indice] <= 0,
          idImagen: Number(imagenesPropias.find((imagen) => Number(imagen.IdProducto) === Number(variante.IdProducto))?.IdImagen ?? 0) || null
        })),
        agotado: disponibleTotal <= 0,
        disponible: propias.length === 1 ? this.disponibleVisible(disponibles[0], configuracion.mostrarExistenciaBaja, configuracion.umbralDeExistenciaBaja) : null
      };
    });
  }

  private disponibleVisible(disponible: number, mostrar: boolean, umbral: number): number | null {
    return mostrar && disponible > 0 && disponible <= umbral ? disponible : null;
  }

  private separarAtributos(atributos: string | null): string[] {
    return (atributos ?? '')
      .split(',')
      .map((atributo) => atributo.trim())
      .filter(Boolean)
      .slice(0, 8);
  }
}
