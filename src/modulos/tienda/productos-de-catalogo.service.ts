import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { ImagenDeCatalogo, Producto, ProductoDeCatalogo } from '../../comun/entidades';
import { KardexService } from '../productos/kardex.service';
import { ReservasService } from '../reservas/reservas.service';
import { ActualizarImagenDto, ActualizarVarianteDto, GuardarProductoDeCatalogoDto, PublicarDesdeInventarioDto, VarianteDto } from './dto/tienda.dto';
import { crearSlug, limpiarTexto } from './texto';

export interface ArchivoSubido {
  buffer: Buffer;
  mimetype: string;
  size: number;
  originalname: string;
}

const LIMITE_DE_MAS_VENDIDOS = 5;

const TIPOS_DE_IMAGEN = ['image/webp', 'image/jpeg', 'image/png', 'image/avif'];

function esImagenValida(buffer: Buffer): boolean {
  if (buffer.length < 12) {
    return false;
  }
  const esJpeg = buffer[0] === 0xff && buffer[1] === 0xd8;
  const esPng = buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const esWebp = buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  const esAvif = buffer.subarray(4, 12).toString('ascii').startsWith('ftypavi');
  return esJpeg || esPng || esWebp || esAvif;
}

@Injectable()
export class ProductosDeCatalogoService {
  constructor(
    @InjectRepository(ProductoDeCatalogo)
    private readonly repositorioDeCatalogo: Repository<ProductoDeCatalogo>,
    @InjectRepository(ImagenDeCatalogo)
    private readonly repositorioDeImagenes: Repository<ImagenDeCatalogo>,
    private readonly kardexService: KardexService,
    private readonly reservasService: ReservasService,
    private readonly dataSource: DataSource
  ) {}

  public async obtenerLista(buscar: string, pagina: number, limite: number) {
    const consulta = this.repositorioDeCatalogo
      .createQueryBuilder('catalogo')
      .leftJoinAndSelect('catalogo.marca', 'marca')
      .leftJoinAndSelect('catalogo.categoria', 'categoria')
      .orderBy('catalogo.fechaActualizacion', 'DESC')
      .skip((pagina - 1) * limite)
      .take(limite);

    const texto = buscar.trim();
    if (texto !== '') {
      consulta.andWhere('(catalogo.nombre LIKE :texto OR marca.nombre LIKE :texto OR categoria.nombre LIKE :texto)', { texto: `%${texto}%` });
    }

    const [elementos, total] = await consulta.getManyAndCount();
    const ids = elementos.map((elemento) => elemento.idProductoCatalogo);
    const variantes = ids.length > 0 ? await this.dataSource.manager.find(Producto, { where: { idProductoCatalogo: In(ids) } }) : [];
    const imagenes: { IdProductoCatalogo: number; IdImagen: number; Cantidad: string }[] =
      ids.length > 0
        ? await this.dataSource.query(
            `SELECT i.IdProductoCatalogo, MIN(i.IdImagen) AS IdImagen, COUNT(*) AS Cantidad FROM ImagenDeCatalogo i
             INNER JOIN (SELECT IdProductoCatalogo, MIN(Orden) AS Orden FROM ImagenDeCatalogo WHERE IdProductoCatalogo IN (?) GROUP BY IdProductoCatalogo) o
               ON o.IdProductoCatalogo = i.IdProductoCatalogo AND o.Orden = i.Orden
             GROUP BY i.IdProductoCatalogo`,
            [ids]
          )
        : [];

    return {
      elementos: elementos.map((catalogo) => {
        const propias = variantes.filter((variante) => variante.idProductoCatalogo === catalogo.idProductoCatalogo);
        const imagen = imagenes.find((fila) => Number(fila.IdProductoCatalogo) === catalogo.idProductoCatalogo);
        return {
          ...catalogo,
          cantidadDeVariantes: propias.length,
          existenciaTotal: propias.reduce((suma, variante) => suma + variante.existencia, 0),
          precioDesde: propias.length > 0 ? Math.min(...propias.map((variante) => variante.precioUnitario)) : 0,
          precioHasta: propias.length > 0 ? Math.max(...propias.map((variante) => variante.precioUnitario)) : 0,
          variantes: propias
            .sort((a, b) => a.ordenEnCatalogo - b.ordenEnCatalogo)
            .map((variante) => ({ idProducto: variante.idProducto, nombreDeVariante: variante.nombreDeVariante, codigoHex: variante.codigoHex, existencia: variante.existencia })),
          idImagenPrincipal: imagen ? Number(imagen.IdImagen) : null
        };
      }),
      total,
      pagina,
      limite
    };
  }

  public async obtenerDetalle(idProductoCatalogo: number) {
    const catalogo = await this.repositorioDeCatalogo.findOne({ where: { idProductoCatalogo } });
    if (catalogo === null) {
      throw new NotFoundException('Producto de catalogo no encontrado.');
    }
    const variantes = await this.dataSource.manager.find(Producto, {
      where: { idProductoCatalogo },
      relations: { familiaDeColor: true },
      order: { ordenEnCatalogo: 'ASC', idProducto: 'ASC' }
    });
    const reservas = await this.reservasService.obtenerReservas(variantes.map((variante) => variante.idProducto));
    const imagenes = await this.repositorioDeImagenes.find({ where: { idProductoCatalogo }, order: { orden: 'ASC', idImagen: 'ASC' } });
    return {
      ...catalogo,
      variantes: variantes.map((variante) => ({ ...variante, reservado: reservas.get(variante.idProducto) ?? 0 })),
      imagenes
    };
  }

  public async crear(datos: GuardarProductoDeCatalogoDto, idUsuario: number) {
    if (datos.destacado) {
      await this.validarLimiteDeDestacados(null);
    }
    const idProductoCatalogo = await this.dataSource.transaction(async (manager) => {
      const catalogo = manager.create(ProductoDeCatalogo, this.valoresDelCatalogo(datos));
      catalogo.slug = await this.slugDisponible(manager, datos.nombre);
      const guardado = await manager.save(catalogo);
      const completo = (await manager.findOne(ProductoDeCatalogo, { where: { idProductoCatalogo: guardado.idProductoCatalogo } })) as ProductoDeCatalogo;
      const variantes = datos.variantes && datos.variantes.length > 0 ? datos.variantes : [];
      for (const [indice, variante] of variantes.entries()) {
        await this.crearVarianteEnTransaccion(manager, completo, { ...variante, ordenEnCatalogo: variante.ordenEnCatalogo ?? indice }, idUsuario);
      }
      return guardado.idProductoCatalogo;
    });
    return this.obtenerDetalle(idProductoCatalogo);
  }

  public async actualizar(idProductoCatalogo: number, datos: GuardarProductoDeCatalogoDto) {
    if (datos.destacado) {
      await this.validarLimiteDeDestacados(idProductoCatalogo);
    }
    await this.dataSource.transaction(async (manager) => {
      const catalogo = await manager.findOne(ProductoDeCatalogo, { where: { idProductoCatalogo } });
      if (catalogo === null) {
        throw new NotFoundException('Producto de catalogo no encontrado.');
      }
      const cambioElNombre = catalogo.nombre !== datos.nombre.trim();
      Object.assign(catalogo, this.valoresDelCatalogo(datos));
      if (cambioElNombre) {
        catalogo.slug = await this.slugDisponible(manager, datos.nombre, idProductoCatalogo);
      }
      await manager.save(catalogo);
      const actualizado = (await manager.findOne(ProductoDeCatalogo, { where: { idProductoCatalogo } })) as ProductoDeCatalogo;
      const variantes = await manager.find(Producto, { where: { idProductoCatalogo } });
      for (const variante of variantes) {
        await manager.update(Producto, { idProducto: variante.idProducto }, { descripcion: this.descripcionDeVariante(actualizado, variante.nombreDeVariante) });
      }
    });
    return this.obtenerDetalle(idProductoCatalogo);
  }

  public async agregarVariante(idProductoCatalogo: number, datos: VarianteDto, idUsuario: number) {
    await this.dataSource.transaction(async (manager) => {
      const catalogo = await manager.findOne(ProductoDeCatalogo, { where: { idProductoCatalogo } });
      if (catalogo === null) {
        throw new NotFoundException('Producto de catalogo no encontrado.');
      }
      const [orden] = await manager.query('SELECT COALESCE(MAX(OrdenEnCatalogo), -1) + 1 AS Siguiente FROM Producto WHERE IdProductoCatalogo = ?', [idProductoCatalogo]);
      await this.crearVarianteEnTransaccion(manager, catalogo, { ...datos, ordenEnCatalogo: datos.ordenEnCatalogo ?? Number(orden.Siguiente) }, idUsuario);
    });
    return this.obtenerDetalle(idProductoCatalogo);
  }

  public async publicarDesdeInventario(datos: PublicarDesdeInventarioDto) {
    const idProductoCatalogo = await this.dataSource.transaction(async (manager) => {
      const producto = await manager.findOne(Producto, { where: { idProducto: datos.idProducto } });
      if (producto === null) {
        throw new NotFoundException('Producto no encontrado.');
      }
      if (producto.idProductoCatalogo !== null) {
        await manager.update(ProductoDeCatalogo, { idProductoCatalogo: producto.idProductoCatalogo }, { visible: true });
        return producto.idProductoCatalogo;
      }
      const nombre = limpiarTexto(datos.nombre) ?? producto.descripcion;
      const catalogo = manager.create(ProductoDeCatalogo, {
        nombre: nombre.slice(0, 150),
        idMarca: datos.idMarca ?? null,
        idCategoria: datos.idCategoria ?? null,
        nombreDeLaVariante: 'Tono',
        visible: true,
        destacado: false,
        orden: 0
      });
      catalogo.slug = await this.slugDisponible(manager, nombre);
      const guardado = await manager.save(catalogo);
      await manager.update(
        Producto,
        { idProducto: producto.idProducto },
        {
          idProductoCatalogo: guardado.idProductoCatalogo,
          nombreDeVariante: limpiarTexto(datos.nombreDeVariante),
          codigoHex: datos.codigoHex ? datos.codigoHex.toUpperCase() : null,
          ordenEnCatalogo: 0
        }
      );
      return guardado.idProductoCatalogo;
    });
    return this.obtenerDetalle(idProductoCatalogo);
  }

  public async cambiarDestacado(idProductoCatalogo: number, destacado: boolean) {
    if (destacado) {
      await this.validarLimiteDeDestacados(idProductoCatalogo);
    }
    const resultado = await this.repositorioDeCatalogo.update({ idProductoCatalogo }, { destacado });
    if (!resultado.affected) {
      throw new NotFoundException('Producto de catalogo no encontrado.');
    }
    return this.obtenerDetalle(idProductoCatalogo);
  }

  public async obtenerDestacados() {
    return this.repositorioDeCatalogo.find({ where: { destacado: true }, order: { orden: 'ASC' } });
  }

  private async validarLimiteDeDestacados(idProductoCatalogo: number | null): Promise<void> {
    const [fila] = await this.dataSource.query(
      'SELECT COUNT(*) AS Cantidad FROM ProductoDeCatalogo WHERE Destacado = 1 AND IdProductoCatalogo != ?',
      [idProductoCatalogo ?? 0]
    );
    if (Number(fila.Cantidad) >= LIMITE_DE_MAS_VENDIDOS) {
      throw new ConflictException(`Ya hay ${LIMITE_DE_MAS_VENDIDOS} productos en "Mas vendidos". Quita uno antes de agregar otro.`);
    }
  }

  public async cambiarVisibilidad(idProductoCatalogo: number, visible: boolean) {
    const resultado = await this.repositorioDeCatalogo.update({ idProductoCatalogo }, { visible });
    if (!resultado.affected) {
      throw new NotFoundException('Producto de catalogo no encontrado.');
    }
    return this.obtenerDetalle(idProductoCatalogo);
  }

  public async actualizarVariante(idProducto: number, datos: ActualizarVarianteDto) {
    const idProductoCatalogo = await this.dataSource.transaction(async (manager) => {
      const variante = await manager.findOne(Producto, { where: { idProducto } });
      if (variante === null || variante.idProductoCatalogo === null) {
        throw new NotFoundException('Variante no encontrada.');
      }
      const catalogo = (await manager.findOne(ProductoDeCatalogo, { where: { idProductoCatalogo: variante.idProductoCatalogo } })) as ProductoDeCatalogo;
      if (datos.codigo !== undefined || datos.codigoDeBarras !== undefined) {
        await this.validarCodigos(manager, datos.codigo ?? variante.codigo, datos.codigoDeBarras !== undefined ? limpiarTexto(datos.codigoDeBarras) : variante.codigoDeBarras, idProducto);
      }
      const cambios: Partial<Producto> = {};
      if (datos.nombreDeVariante !== undefined) {
        cambios.nombreDeVariante = limpiarTexto(datos.nombreDeVariante);
        cambios.descripcion = this.descripcionDeVariante(catalogo, cambios.nombreDeVariante);
      }
      if (datos.codigoHex !== undefined) {
        cambios.codigoHex = datos.codigoHex ? datos.codigoHex.toUpperCase() : null;
      }
      if (datos.idFamiliaDeColor !== undefined) {
        cambios.idFamiliaDeColor = datos.idFamiliaDeColor;
      }
      if (datos.codigo !== undefined) {
        cambios.codigo = datos.codigo.trim();
      }
      if (datos.codigoDeBarras !== undefined) {
        cambios.codigoDeBarras = limpiarTexto(datos.codigoDeBarras);
      }
      if (datos.precioUnitario !== undefined) {
        cambios.precioUnitario = datos.precioUnitario;
      }
      if (datos.existenciaMinima !== undefined) {
        cambios.existenciaMinima = datos.existenciaMinima;
      }
      if (datos.activo !== undefined) {
        cambios.activo = datos.activo;
      }
      if (datos.ordenEnCatalogo !== undefined) {
        cambios.ordenEnCatalogo = datos.ordenEnCatalogo;
      }
      await manager.update(Producto, { idProducto }, cambios);
      return variante.idProductoCatalogo;
    });
    return this.obtenerDetalle(idProductoCatalogo);
  }

  public async vincularVariante(idProductoCatalogo: number, idProducto: number) {
    await this.dataSource.transaction(async (manager) => {
      const catalogo = await manager.findOne(ProductoDeCatalogo, { where: { idProductoCatalogo } });
      const producto = await manager.findOne(Producto, { where: { idProducto } });
      if (catalogo === null || producto === null) {
        throw new NotFoundException('Producto no encontrado.');
      }
      if (producto.idProductoCatalogo !== null && producto.idProductoCatalogo !== idProductoCatalogo) {
        throw new ConflictException('Ese producto ya pertenece a otro producto del catalogo.');
      }
      const [orden] = await manager.query('SELECT COALESCE(MAX(OrdenEnCatalogo), -1) + 1 AS Siguiente FROM Producto WHERE IdProductoCatalogo = ?', [idProductoCatalogo]);
      await manager.update(Producto, { idProducto }, { idProductoCatalogo, ordenEnCatalogo: Number(orden.Siguiente) });
    });
    return this.obtenerDetalle(idProductoCatalogo);
  }

  public async desvincularVariante(idProducto: number) {
    const producto = await this.dataSource.manager.findOne(Producto, { where: { idProducto } });
    if (producto === null || producto.idProductoCatalogo === null) {
      throw new NotFoundException('Variante no encontrada.');
    }
    const idProductoCatalogo = producto.idProductoCatalogo;
    await this.dataSource.transaction(async (manager) => {
      await manager.update(ImagenDeCatalogo, { idProducto }, { idProducto: null });
      await manager.update(Producto, { idProducto }, { idProductoCatalogo: null });
    });
    return this.obtenerDetalle(idProductoCatalogo);
  }

  public async subirImagen(idProductoCatalogo: number, imagen: ArchivoSubido | undefined, miniatura: ArchivoSubido | undefined, datos: { idProducto?: string; textoAlternativo?: string; ancho?: string; alto?: string }) {
    if (!imagen || !miniatura) {
      throw new BadRequestException('Falta la imagen o su miniatura.');
    }
    for (const archivo of [imagen, miniatura]) {
      if (!TIPOS_DE_IMAGEN.includes(archivo.mimetype) || !esImagenValida(archivo.buffer)) {
        throw new BadRequestException('Solo se aceptan imagenes JPG, PNG, WEBP o AVIF.');
      }
    }
    if (imagen.size > 4 * 1024 * 1024) {
      throw new BadRequestException('La imagen no puede pesar mas de 4 MB.');
    }
    if (miniatura.size > 800 * 1024) {
      throw new BadRequestException('La miniatura no puede pesar mas de 800 KB.');
    }
    const catalogo = await this.repositorioDeCatalogo.findOne({ where: { idProductoCatalogo } });
    if (catalogo === null) {
      throw new NotFoundException('Producto de catalogo no encontrado.');
    }
    const idProducto = datos.idProducto ? Number(datos.idProducto) : null;
    if (idProducto !== null) {
      await this.validarVarianteDelCatalogo(idProducto, idProductoCatalogo);
    }
    const [orden] = await this.dataSource.query('SELECT COALESCE(MAX(Orden), -1) + 1 AS Siguiente FROM ImagenDeCatalogo WHERE IdProductoCatalogo = ?', [idProductoCatalogo]);
    const guardada = await this.repositorioDeImagenes.save(
      this.repositorioDeImagenes.create({
        idProductoCatalogo,
        idProducto,
        datos: imagen.buffer,
        miniatura: miniatura.buffer,
        tipoMime: imagen.mimetype,
        ancho: Math.max(Number(datos.ancho) || 0, 0),
        alto: Math.max(Number(datos.alto) || 0, 0),
        tamano: imagen.size,
        textoAlternativo: limpiarTexto(datos.textoAlternativo)?.slice(0, 200) ?? null,
        orden: Number(orden.Siguiente)
      })
    );
    await this.repositorioDeCatalogo.update({ idProductoCatalogo }, { fechaActualizacion: new Date() });
    const { datos: _datos, miniatura: _miniatura, ...resto } = guardada;
    return resto;
  }

  public async actualizarImagen(idImagen: number, datos: ActualizarImagenDto) {
    const imagen = await this.repositorioDeImagenes.findOne({ where: { idImagen } });
    if (imagen === null) {
      throw new NotFoundException('Imagen no encontrada.');
    }
    if (datos.idProducto !== undefined && datos.idProducto !== null) {
      await this.validarVarianteDelCatalogo(datos.idProducto, imagen.idProductoCatalogo);
    }
    await this.repositorioDeImagenes.update(
      { idImagen },
      {
        ...(datos.idProducto !== undefined ? { idProducto: datos.idProducto } : {}),
        ...(datos.textoAlternativo !== undefined ? { textoAlternativo: limpiarTexto(datos.textoAlternativo) } : {})
      }
    );
    return this.repositorioDeImagenes.findOne({ where: { idImagen } });
  }

  public async ordenarImagenes(idProductoCatalogo: number, ids: number[]) {
    await this.dataSource.transaction(async (manager) => {
      for (const [indice, idImagen] of ids.entries()) {
        await manager.update(ImagenDeCatalogo, { idImagen, idProductoCatalogo }, { orden: indice });
      }
    });
    return this.repositorioDeImagenes.find({ where: { idProductoCatalogo }, order: { orden: 'ASC' } });
  }

  public async eliminarImagen(idImagen: number) {
    const resultado = await this.repositorioDeImagenes.delete({ idImagen });
    if (!resultado.affected) {
      throw new NotFoundException('Imagen no encontrada.');
    }
    return { eliminada: true };
  }

  public async obtenerContenidoDeImagen(idImagen: number, miniatura: boolean): Promise<{ contenido: Buffer; tipoMime: string } | null> {
    const [fila] = await this.dataSource.query(`SELECT ${miniatura ? 'Miniatura' : 'Datos'} AS Contenido, TipoMime FROM ImagenDeCatalogo WHERE IdImagen = ?`, [idImagen]);
    return fila ? { contenido: fila.Contenido as Buffer, tipoMime: String(fila.TipoMime) } : null;
  }

  private valoresDelCatalogo(datos: GuardarProductoDeCatalogoDto): Partial<ProductoDeCatalogo> {
    return {
      nombre: datos.nombre.trim(),
      idMarca: datos.idMarca ?? null,
      idCategoria: datos.idCategoria ?? null,
      descripcionCorta: limpiarTexto(datos.descripcionCorta),
      descripcion: limpiarTexto(datos.descripcion),
      modoDeUso: limpiarTexto(datos.modoDeUso),
      ingredientes: limpiarTexto(datos.ingredientes),
      atributos: limpiarTexto(datos.atributos),
      nombreDeLaVariante: limpiarTexto(datos.nombreDeLaVariante) ?? 'Tono',
      visible: datos.visible ?? true,
      destacado: datos.destacado ?? false,
      orden: datos.orden ?? 0
    };
  }

  private descripcionDeVariante(catalogo: ProductoDeCatalogo, nombreDeVariante: string | null): string {
    const partes = [catalogo.marca?.nombre, catalogo.nombre].filter(Boolean).join(' ');
    return (nombreDeVariante ? `${partes} - ${nombreDeVariante}` : partes).slice(0, 250);
  }

  private async crearVarianteEnTransaccion(manager: EntityManager, catalogo: ProductoDeCatalogo, datos: VarianteDto, idUsuario: number): Promise<Producto> {
    const codigo = datos.codigo?.trim() || (await this.codigoAutomatico(manager, catalogo.idProductoCatalogo));
    const codigoDeBarras = limpiarTexto(datos.codigoDeBarras);
    await this.validarCodigos(manager, codigo, codigoDeBarras, null);
    const nombreDeVariante = limpiarTexto(datos.nombreDeVariante);
    const producto = await manager.save(
      manager.create(Producto, {
        codigo,
        codigoDeBarras,
        descripcion: this.descripcionDeVariante(catalogo, nombreDeVariante),
        precioUnitario: datos.precioUnitario,
        costoPromedio: datos.costoPromedio ?? 0,
        precioAlMayor: null,
        cantidadMinimaParaPrecioAlMayor: 0,
        existencia: 0,
        existenciaMinima: datos.existenciaMinima ?? 3,
        activo: datos.activo ?? true,
        idProductoCatalogo: catalogo.idProductoCatalogo,
        nombreDeVariante,
        codigoHex: datos.codigoHex ? datos.codigoHex.toUpperCase() : null,
        idFamiliaDeColor: datos.idFamiliaDeColor ?? null,
        ordenEnCatalogo: datos.ordenEnCatalogo ?? 0
      })
    );
    if ((datos.existenciaInicial ?? 0) > 0) {
      await this.kardexService.registrarEntrada(manager, {
        idProducto: producto.idProducto,
        cantidad: datos.existenciaInicial as number,
        costoUnitario: datos.costoPromedio ?? 0,
        origen: 'Inicial',
        idUsuario,
        observaciones: 'Existencia inicial al crear la variante en el catalogo'
      });
    }
    return producto;
  }

  private async codigoAutomatico(manager: EntityManager, idProductoCatalogo: number): Promise<string> {
    for (let intento = 1; intento < 500; intento += 1) {
      const codigo = `GC${String(idProductoCatalogo).padStart(4, '0')}-${intento}`;
      const [fila] = await manager.query('SELECT COUNT(*) AS Cantidad FROM Producto WHERE Codigo = ?', [codigo]);
      if (Number(fila.Cantidad) === 0) {
        return codigo;
      }
    }
    throw new ConflictException('No se pudo generar un codigo para la variante.');
  }

  private async validarCodigos(manager: EntityManager, codigo: string, codigoDeBarras: string | null, idProductoExcluido: number | null): Promise<void> {
    const [porCodigo] = await manager.query('SELECT Descripcion FROM Producto WHERE Codigo = ? AND IdProducto != ?', [codigo, idProductoExcluido ?? 0]);
    if (porCodigo) {
      throw new ConflictException(`El codigo "${codigo}" ya lo usa "${porCodigo.Descripcion}".`);
    }
    if (codigoDeBarras) {
      const [porBarras] = await manager.query('SELECT Descripcion FROM Producto WHERE CodigoDeBarras = ? AND IdProducto != ?', [codigoDeBarras, idProductoExcluido ?? 0]);
      if (porBarras) {
        throw new ConflictException(`El codigo de barras "${codigoDeBarras}" ya lo usa "${porBarras.Descripcion}".`);
      }
    }
  }

  private async validarVarianteDelCatalogo(idProducto: number, idProductoCatalogo: number): Promise<void> {
    const [fila] = await this.dataSource.query('SELECT IdProductoCatalogo FROM Producto WHERE IdProducto = ?', [idProducto]);
    if (!fila || Number(fila.IdProductoCatalogo) !== idProductoCatalogo) {
      throw new BadRequestException('La variante no pertenece a este producto.');
    }
  }

  private async slugDisponible(manager: EntityManager, nombre: string, idExcluido?: number): Promise<string> {
    const base = crearSlug(nombre);
    let slug = base;
    let sufijo = 2;
    for (;;) {
      const [fila] = await manager.query('SELECT IdProductoCatalogo FROM ProductoDeCatalogo WHERE Slug = ? AND IdProductoCatalogo != ?', [slug, idExcluido ?? 0]);
      if (!fila) {
        return slug;
      }
      slug = `${base}-${sufijo++}`;
    }
  }
}
