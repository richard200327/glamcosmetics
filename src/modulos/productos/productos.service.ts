import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, DataSource, Not, Repository, SelectQueryBuilder } from 'typeorm';
import { PaginaDeResultados, ParametrosDeBusqueda, escaparLike, palabrasDeBusqueda } from '../../comun/utilidades/busqueda';
import { Producto } from '../../comun/entidades';
import { ActualizarProductoDto, AjustarExistenciaDto, CrearProductoDto } from './dto/producto.dto';
import { KardexService } from './kardex.service';

@Injectable()
export class ProductosService {
  constructor(
    @InjectRepository(Producto)
    private readonly repositorioDeProductos: Repository<Producto>,
    private readonly kardexService: KardexService,
    private readonly dataSource: DataSource
  ) {}

  public async obtenerListaDeProductos(soloActivos = false): Promise<Producto[]> {
    if (soloActivos) {
      return this.repositorioDeProductos.find({ where: { activo: true }, order: { descripcion: 'ASC' } });
    }
    return this.repositorioDeProductos.find({ order: { descripcion: 'ASC' } });
  }

  public async buscarProductos(parametros: ParametrosDeBusqueda, soloActivos: boolean): Promise<Producto[]> {
    const consulta = this.construirConsulta(parametros.texto, soloActivos ? 'todos' : 'cualquiera');

    if (parametros.texto !== '') {
      consulta
        .addSelect(
          `CASE WHEN producto.codigoDeBarras = :exacto OR producto.codigo = :exacto THEN 0 WHEN producto.codigo LIKE :inicio THEN 1 WHEN producto.descripcion LIKE :inicio THEN 2 ELSE 3 END`,
          'prioridad'
        )
        .setParameter('exacto', parametros.texto)
        .setParameter('inicio', `${escaparLike(parametros.texto)}%`)
        .orderBy('prioridad', 'ASC')
        .addOrderBy('producto.descripcion', 'ASC');
    } else {
      consulta.orderBy('producto.descripcion', 'ASC');
    }

    return consulta.take(parametros.limite).getMany();
  }

  public async obtenerPaginaDeProductos(parametros: ParametrosDeBusqueda, filtro: string): Promise<PaginaDeResultados<Producto>> {
    const [elementos, total] = await this.construirConsulta(parametros.texto, filtro)
      .orderBy('producto.descripcion', 'ASC')
      .skip(parametros.desplazamiento)
      .take(parametros.limite)
      .getManyAndCount();

    return { elementos, total, pagina: parametros.desplazamiento / parametros.limite + 1, limite: parametros.limite };
  }

  public async obtenerResumenDeProductos() {
    const fila = await this.repositorioDeProductos
      .createQueryBuilder('producto')
      .select('COUNT(*)', 'cantidad')
      .addSelect('SUM(CASE WHEN producto.existencia <= 0 THEN 1 ELSE 0 END)', 'agotados')
      .addSelect('SUM(CASE WHEN producto.existencia > 0 AND producto.existencia <= producto.existenciaMinima THEN 1 ELSE 0 END)', 'bajos')
      .addSelect('SUM(producto.existencia * producto.costoPromedio)', 'valorAlCosto')
      .addSelect('SUM(producto.existencia * producto.precioUnitario)', 'valorAPrecioDeVenta')
      .where('producto.activo = 1')
      .getRawOne<{ cantidad: string; agotados: string; bajos: string; valorAlCosto: string; valorAPrecioDeVenta: string }>();

    return {
      cantidad: Number(fila?.cantidad ?? 0),
      agotados: Number(fila?.agotados ?? 0),
      bajos: Number(fila?.bajos ?? 0),
      valorAlCosto: Math.round(Number(fila?.valorAlCosto ?? 0) * 100) / 100,
      valorAPrecioDeVenta: Math.round(Number(fila?.valorAPrecioDeVenta ?? 0) * 100) / 100
    };
  }

  public async obtenerProductoPorId(idProducto: number): Promise<Producto> {
    const producto = await this.repositorioDeProductos.findOne({ where: { idProducto } });

    if (producto === null) {
      throw new NotFoundException(`No se encontro el producto con id ${idProducto}.`);
    }

    return producto;
  }

  public async crearProducto(datos: CrearProductoDto, idUsuario: number | null): Promise<Producto> {
    await this.validarCodigosUnicos(datos.codigo, datos.codigoDeBarras ?? null, null);

    const existenciaInicial = datos.existencia ?? 0;

    return this.dataSource.transaction(async (manager) => {
      const productoNuevo = manager.create(Producto, {
        codigo: datos.codigo.trim(),
        codigoDeBarras: datos.codigoDeBarras?.trim() || null,
        descripcion: datos.descripcion.trim(),
        precioUnitario: datos.precioUnitario,
        costoPromedio: datos.costoPromedio,
        precioAlMayor: datos.precioAlMayor ?? null,
        cantidadMinimaParaPrecioAlMayor: datos.cantidadMinimaParaPrecioAlMayor ?? 0,
        existencia: 0,
        existenciaMinima: datos.existenciaMinima ?? 5,
        activo: datos.activo ?? true
      });

      const productoGuardado = await manager.save(productoNuevo);

      if (existenciaInicial > 0) {
        await this.kardexService.registrarEntrada(manager, {
          idProducto: productoGuardado.idProducto,
          cantidad: existenciaInicial,
          costoUnitario: datos.costoPromedio,
          origen: 'Inicial',
          idUsuario,
          observaciones: 'Existencia inicial al crear el producto'
        });
      }

      return manager.findOneOrFail(Producto, { where: { idProducto: productoGuardado.idProducto } });
    });
  }

  public async actualizarProducto(idProducto: number, datos: ActualizarProductoDto): Promise<Producto> {
    const producto = await this.obtenerProductoPorId(idProducto);

    await this.validarCodigosUnicos(
      datos.codigo ?? producto.codigo,
      datos.codigoDeBarras !== undefined ? datos.codigoDeBarras : producto.codigoDeBarras,
      idProducto
    );

    Object.assign(producto, {
      ...datos,
      codigoDeBarras: datos.codigoDeBarras !== undefined ? datos.codigoDeBarras?.trim() || null : producto.codigoDeBarras,
      precioAlMayor: datos.precioAlMayor !== undefined ? datos.precioAlMayor : producto.precioAlMayor
    });

    return this.repositorioDeProductos.save(producto);
  }

  public async ajustarExistencia(idProducto: number, datos: AjustarExistenciaDto, idUsuario: number | null): Promise<Producto> {
    await this.obtenerProductoPorId(idProducto);

    await this.dataSource.transaction(async (manager) => {
      const movimiento = {
        idProducto,
        cantidad: datos.cantidad,
        origen: 'Ajuste' as const,
        costoUnitario: datos.tipoMovimiento === 'Entrada' ? datos.costoUnitario ?? null : null,
        idUsuario,
        observaciones: datos.observaciones ?? null
      };

      if (datos.tipoMovimiento === 'Entrada') {
        await this.kardexService.registrarEntrada(manager, movimiento);
      } else {
        await this.kardexService.registrarSalida(manager, movimiento);
      }
    });

    return this.obtenerProductoPorId(idProducto);
  }

  private async validarCodigosUnicos(codigo: string, codigoDeBarras: string | null, idProductoExcluido: number | null): Promise<void> {
    const condicionDeExclusion = idProductoExcluido !== null ? { idProducto: Not(idProductoExcluido) } : {};

    const conMismoCodigo = await this.repositorioDeProductos.findOne({ where: { codigo: codigo.trim(), ...condicionDeExclusion } });
    if (conMismoCodigo !== null) {
      throw new ConflictException(`Ya existe un producto con el codigo "${codigo}" (${conMismoCodigo.descripcion}).`);
    }

    if (codigoDeBarras && codigoDeBarras.trim().length > 0) {
      const conMismoCodigoDeBarras = await this.repositorioDeProductos.findOne({
        where: { codigoDeBarras: codigoDeBarras.trim(), ...condicionDeExclusion }
      });
      if (conMismoCodigoDeBarras !== null) {
        throw new ConflictException(
          `El codigo de barras "${codigoDeBarras}" ya esta asignado a "${conMismoCodigoDeBarras.descripcion}".`
        );
      }
    }
  }

  private construirConsulta(texto: string, filtro: string): SelectQueryBuilder<Producto> {
    const consulta = this.repositorioDeProductos.createQueryBuilder('producto');

    if (filtro === 'inactivos') {
      consulta.andWhere('producto.activo = 0');
    } else if (filtro !== 'cualquiera') {
      consulta.andWhere('producto.activo = 1');
    }

    if (filtro === 'disponibles') {
      consulta.andWhere('producto.existencia > producto.existenciaMinima');
    } else if (filtro === 'bajo') {
      consulta.andWhere('producto.existencia > 0 AND producto.existencia <= producto.existenciaMinima');
    } else if (filtro === 'agotados') {
      consulta.andWhere('producto.existencia <= 0');
    } else if (filtro === 'alerta') {
      consulta.andWhere('producto.existencia <= producto.existenciaMinima');
    }

    palabrasDeBusqueda(texto).forEach((palabra, indice) => {
      consulta.andWhere(
        new Brackets((grupo) => {
          grupo
            .where(`producto.descripcion LIKE :palabra${indice}`)
            .orWhere(`producto.codigo LIKE :palabra${indice}`)
            .orWhere(`producto.codigoDeBarras LIKE :palabra${indice}`);
        }),
        { [`palabra${indice}`]: `%${escaparLike(palabra)}%` }
      );
    });

    return consulta;
  }
}
