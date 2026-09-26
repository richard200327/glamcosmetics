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
  precioMinimo?: number;
  precioMaximo?: number;
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
    const marcas: { idMarca: number; nombre: string; slug: string; cantidad: string }[] = await this.dataSource.query(
      `SELECT m.IdMarca AS idMarca, m.Nombre AS nombre, m.Slug AS slug,
              (SELECT COUNT(*) FROM ProductoDeCatalogo pc WHERE pc.IdMarca = m.IdMarca AND pc.Visible = 1
                 AND EXISTS (SELECT 1 FROM Producto p WHERE p.IdProductoCatalogo = pc.IdProductoCatalogo AND p.Activo = 1)) AS cantidad
       FROM Marca m WHERE m.Activa = 1 ORDER BY m.Orden, m.Nombre`
    );
    const categorias: { idCategoria: number; nombre: string; slug: string; cantidad: string }[] = await this.dataSource.query(
      `SELECT c.IdCategoria AS idCategoria, c.Nombre AS nombre, c.Slug AS slug,
              (SELECT COUNT(*) FROM ProductoDeCatalogo pc WHERE pc.IdCategoria = c.IdCategoria AND pc.Visible = 1
                 AND EXISTS (SELECT 1 FROM Producto p WHERE p.IdProductoCatalogo = pc.IdProductoCatalogo AND p.Activo = 1)) AS cantidad
       FROM Categoria c WHERE c.Activa = 1 ORDER BY c.Orden, c.Nombre`
    );
    const colores: { idFamiliaDeColor: number; nombre: string; codigoHex: string; cantidad: string }[] = await this.dataSource.query(
      `SELECT f.IdFamiliaDeColor AS idFamiliaDeColor, f.Nombre AS nombre, f.CodigoHex AS codigoHex,
              (SELECT COUNT(DISTINCT p.IdProductoCatalogo) FROM Producto p INNER JOIN ProductoDeCatalogo pc ON pc.IdProductoCatalogo = p.IdProductoCatalogo
                 WHERE p.IdFamiliaDeColor = f.IdFamiliaDeColor AND p.Activo = 1 AND pc.Visible = 1) AS cantidad
       FROM FamiliaDeColor f WHERE f.Activa = 1 ORDER BY f.Orden, f.Nombre`
    );
    const [rango] = await this.dataSource.query(
      `SELECT COALESCE(MIN(p.PrecioUnitario), 0) AS Minimo, COALESCE(MAX(p.PrecioUnitario), 0) AS Maximo
       FROM Producto p INNER JOIN ProductoDeCatalogo pc ON pc.IdProductoCatalogo = p.IdProductoCatalogo
       WHERE p.Activo = 1 AND pc.Visible = 1`
    );
    const numero = <T extends { cantidad: string | number }>(lista: T[]) => lista.map((fila) => ({ ...fila, cantidad: Number(fila.cantidad) })).filter((fila) => fila.cantidad > 0);
    return {
      marcas: numero(marcas),
      categorias: numero(categorias),
      colores: numero(colores),
      precios: { minimo: Math.floor(Number(rango?.Minimo ?? 0)), maximo: Math.ceil(Number(rango?.Maximo ?? 0)) }
    };
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
    if (filtros.precioMinimo !== undefined || filtros.precioMaximo !== undefined) {
      condiciones.push(
        'EXISTS (SELECT 1 FROM Producto pp WHERE pp.IdProductoCatalogo = pc.IdProductoCatalogo AND pp.Activo = 1 AND pp.PrecioUnitario >= ? AND pp.PrecioUnitario <= ?)'
      );
      parametros.push(filtros.precioMinimo ?? 0, filtros.precioMaximo ?? 999999999);
    }
    if (filtros.soloDestacados) {
      condiciones.push('pc.Destacado = 1');
    }
    if (filtros.excluir) {
      condiciones.push('pc.IdProductoCatalogo != ?');
      parametros.push(filtros.excluir);
    }
    for (const palabra of this.palabrasDeBusqueda(filtros.buscar ?? '')) {
      condiciones.push(
        `(pc.Nombre LIKE ? OR m.Nombre LIKE ? OR c.Nombre LIKE ? OR pc.DescripcionCorta LIKE ? OR pc.Atributos LIKE ?
          OR EXISTS (SELECT 1 FROM Producto pb LEFT JOIN FamiliaDeColor fb ON fb.IdFamiliaDeColor = pb.IdFamiliaDeColor
                     WHERE pb.IdProductoCatalogo = pc.IdProductoCatalogo AND pb.Activo = 1 AND (pb.NombreDeVariante LIKE ? OR fb.Nombre LIKE ? OR pb.Codigo LIKE ?)))`
      );
      const patron = `%${palabra.replace(/[\%_]/g, (caracter) => `\${caracter}`)}%`;
      parametros.push(patron, patron, patron, patron, patron, patron, patron, patron);
    }

    const ordenes: Record<string, string> = {
      'precio-asc': 'pr.PrecioDesde ASC, pc.Nombre ASC',
      'precio-desc': 'pr.PrecioDesde DESC, pc.Nombre ASC',
      nuevos: 'pc.FechaCreacion DESC',
      nombre: 'pc.Nombre ASC'
    };
    const orden = filtros.soloDestacados
      ? 'pc.Orden ASC, pc.FechaActualizacion DESC'
      : ordenes[filtros.orden ?? ''] ?? 'pc.Destacado DESC, pc.Orden ASC, pc.FechaCreacion DESC';
    const desde = `FROM ProductoDeCatalogo pc
       INNER JOIN (
         SELECT IdProductoCatalogo, MIN(PrecioUnitario) AS PrecioDesde, MAX(PrecioUnitario) AS PrecioHasta
         FROM Producto WHERE Activo = 1 AND IdProductoCatalogo IS NOT NULL GROUP BY IdProductoCatalogo
       ) pr ON pr.IdProductoCatalogo = pc.IdProductoCatalogo
       LEFT JOIN Marca m ON m.IdMarca = pc.IdMarca
       LEFT JOIN Categoria c ON c.IdCategoria = pc.IdCategoria
       WHERE ${condiciones.join(' AND ')}`;

    const [conteo] = await this.dataSource.query(`SELECT COUNT(*) AS Total ${desde}`, parametros);
    const filas: Record<string, unknown>[] = await this.dataSource.query(
      `SELECT pc.IdProductoCatalogo, pc.Slug, pc.Nombre, pc.DescripcionCorta, pc.Atributos, pc.Destacado, pc.NombreDeLaVariante,
              m.Nombre AS Marca, m.Slug AS SlugMarca, c.Nombre AS Categoria, c.Slug AS SlugCategoria,
              pr.PrecioDesde, pr.PrecioHasta
       ${desde}
       ORDER BY ${orden}, pc.IdProductoCatalogo DESC
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

  public async obtenerSugerencias(texto: string) {
    const palabras = this.palabrasDeBusqueda(texto);
    if (palabras.length === 0) {
      return { marcas: [], categorias: [], colores: [], tonos: [], productos: [] };
    }
    const filtros = await this.obtenerFiltros();
    const normalizar = (valor: string) => valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const coincide = (valor: string) => palabras.some((palabra) => normalizar(valor).includes(normalizar(palabra)));
    const patron = `%${palabras[0].replace(/[\%_]/g, (caracter) => `\${caracter}`)}%`;
    const tonos: { Nombre: string; CodigoHex: string | null; Slug: string; Producto: string; IdImagen: number | null }[] = await this.dataSource.query(
      `SELECT p.NombreDeVariante AS Nombre, p.CodigoHex, pc.Slug, pc.Nombre AS Producto,
              (SELECT i.IdImagen FROM ImagenDeCatalogo i WHERE i.IdProductoCatalogo = pc.IdProductoCatalogo ORDER BY (i.IdProducto = p.IdProducto) DESC, i.Orden, i.IdImagen LIMIT 1) AS IdImagen
       FROM Producto p INNER JOIN ProductoDeCatalogo pc ON pc.IdProductoCatalogo = p.IdProductoCatalogo
       WHERE p.Activo = 1 AND pc.Visible = 1 AND p.NombreDeVariante LIKE ?
       ORDER BY p.NombreDeVariante LIMIT 6`,
      [patron]
    );
    const productos = await this.obtenerProductos({ buscar: texto, pagina: 1, limite: 5 });
    return {
      marcas: filtros.marcas.filter((marca) => coincide(marca.nombre)).slice(0, 4),
      categorias: filtros.categorias.filter((categoria) => coincide(categoria.nombre)).slice(0, 4),
      colores: filtros.colores.filter((color) => coincide(color.nombre)).slice(0, 4),
      tonos: tonos.map((tono) => ({ nombre: tono.Nombre, codigoHex: tono.CodigoHex, slug: tono.Slug, producto: tono.Producto, idImagen: tono.IdImagen !== null ? Number(tono.IdImagen) : null })),
      productos: productos.elementos.map((producto) => ({
        slug: producto.slug,
        nombre: producto.nombre,
        marca: producto.marca,
        precioDesde: producto.precioDesde,
        idImagen: producto.idImagenPrincipal
      })),
      total: productos.total
    };
  }

  private palabrasDeBusqueda(texto: string): string[] {
    return texto
      .trim()
      .split(/\s+/)
      .filter((palabra) => palabra.length > 0)
      .slice(0, 6)
      .map((palabra) => {
        const minuscula = palabra.toLowerCase();
        if (minuscula.length > 5 && minuscula.endsWith('es')) {
          return palabra.slice(0, -2);
        }
        if (minuscula.length > 4 && minuscula.endsWith('s')) {
          return palabra.slice(0, -1);
        }
        return palabra;
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
