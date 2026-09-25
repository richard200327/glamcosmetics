import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Raw, Repository } from 'typeorm';
import {
  Promocion,
  PromocionProducto,
  ReglaCantidad,
  ReglaMontoPedido,
  ReglaPrecioEspecial
} from '../../comun/entidades/promocion.entity';
import { ActualizarPromocionDto, CrearPromocionDto } from './dto/promocion.dto';

@Injectable()
export class PromocionesService {
  constructor(
    @InjectRepository(Promocion)
    private readonly repositorioDePromociones: Repository<Promocion>,
    @InjectRepository(PromocionProducto)
    private readonly repositorioDePromocionProducto: Repository<PromocionProducto>,
    @InjectRepository(ReglaCantidad)
    private readonly repositorioDeReglaCantidad: Repository<ReglaCantidad>,
    @InjectRepository(ReglaPrecioEspecial)
    private readonly repositorioDeReglaPrecioEspecial: Repository<ReglaPrecioEspecial>,
    @InjectRepository(ReglaMontoPedido)
    private readonly repositorioDeReglaMontoPedido: Repository<ReglaMontoPedido>
  ) {}

  public async obtenerListaDePromociones(): Promise<Promocion[]> {
    return this.repositorioDePromociones.find({ order: { fechaInicio: 'DESC' } });
  }

  // Promociones vigentes hoy y activas: las unicas que el motor de evaluacion del
  // frontend (o una futura version en el backend) deberia considerar al armar un pedido.
  public async obtenerPromocionesVigentes(fecha: string): Promise<Promocion[]> {
    return this.repositorioDePromociones.find({
      where: {
        activo: true,
        fechaInicio: Raw((columna) => `DATE(${columna}) <= :fecha`, { fecha }),
        fechaFin: Raw((columna) => `DATE(${columna}) >= :fecha`, { fecha })
      }
    });
  }

  public async obtenerPromocionPorId(idPromocion: number): Promise<Promocion> {
    const promocion = await this.repositorioDePromociones.findOne({ where: { idPromocion } });

    if (promocion === null) {
      throw new NotFoundException(`No se encontro la promocion con id ${idPromocion}.`);
    }

    return promocion;
  }

  public async crearPromocion(datos: CrearPromocionDto): Promise<Promocion> {
    const promocionNueva = this.repositorioDePromociones.create({
      nombre: datos.nombre,
      descripcion: datos.descripcion ?? null,
      tipoPromocion: datos.tipoPromocion,
      fechaInicio: new Date(datos.fechaInicio),
      fechaFin: new Date(datos.fechaFin),
      activo: true,
      acumulable: datos.acumulable
    });

    const promocionGuardada = await this.repositorioDePromociones.save(promocionNueva);

    if (datos.idsDeProductos && datos.idsDeProductos.length > 0) {
      const relaciones = datos.idsDeProductos.map((idProducto) =>
        this.repositorioDePromocionProducto.create({ idPromocion: promocionGuardada.idPromocion, idProducto })
      );
      await this.repositorioDePromocionProducto.save(relaciones);
    }

    if (datos.reglasDeCantidad && datos.reglasDeCantidad.length > 0) {
      const reglas = datos.reglasDeCantidad.map((regla) =>
        this.repositorioDeReglaCantidad.create({ ...regla, idPromocion: promocionGuardada.idPromocion })
      );
      await this.repositorioDeReglaCantidad.save(reglas);
    }

    if (datos.reglasDePrecioEspecial && datos.reglasDePrecioEspecial.length > 0) {
      const reglas = datos.reglasDePrecioEspecial.map((regla) =>
        this.repositorioDeReglaPrecioEspecial.create({ ...regla, idPromocion: promocionGuardada.idPromocion })
      );
      await this.repositorioDeReglaPrecioEspecial.save(reglas);
    }

    if (datos.reglasDeMontoPedido && datos.reglasDeMontoPedido.length > 0) {
      const reglas = datos.reglasDeMontoPedido.map((regla) =>
        this.repositorioDeReglaMontoPedido.create({
          montoMinimoPedido: regla.montoMinimoPedido,
          tipoBeneficio: regla.tipoBeneficio,
          valorDescuento: regla.valorDescuento ?? null,
          idProductoRegalo: regla.idProductoRegalo ?? null,
          idPromocion: promocionGuardada.idPromocion
        })
      );
      await this.repositorioDeReglaMontoPedido.save(reglas);
    }

    return this.obtenerPromocionPorId(promocionGuardada.idPromocion);
  }

  public async actualizarPromocion(idPromocion: number, datos: ActualizarPromocionDto): Promise<Promocion> {
    const promocion = await this.obtenerPromocionPorId(idPromocion);

    Object.assign(promocion, {
      ...datos,
      fechaInicio: datos.fechaInicio ? new Date(datos.fechaInicio) : promocion.fechaInicio,
      fechaFin: datos.fechaFin ? new Date(datos.fechaFin) : promocion.fechaFin
    });

    return this.repositorioDePromociones.save(promocion);
  }

  public async desactivarPromocion(idPromocion: number): Promise<Promocion> {
    const promocion = await this.obtenerPromocionPorId(idPromocion);
    promocion.activo = false;
    return this.repositorioDePromociones.save(promocion);
  }

  // --- Reglas de tipo "DescuentoPorCantidad" ---
  // Reemplaza por completo la regla de cantidad y los productos asociados de esta
  // promocion (solo puede haber una regla de cantidad activa por promocion en este flujo).
  public async guardarReglaDeCantidad(
    idPromocion: number,
    idsDeProductos: number[],
    cantidadMinima: number,
    tipoDescuento: 'Porcentaje' | 'MontoFijo',
    valorDescuento: number
  ): Promise<Promocion> {
    await this.obtenerPromocionPorId(idPromocion);

    await this.repositorioDePromocionProducto.delete({ idPromocion });
    if (idsDeProductos.length > 0) {
      const relaciones = idsDeProductos.map((idProducto) =>
        this.repositorioDePromocionProducto.create({ idPromocion, idProducto })
      );
      await this.repositorioDePromocionProducto.save(relaciones);
    }

    await this.repositorioDeReglaCantidad.delete({ idPromocion });
    await this.repositorioDeReglaCantidad.save(
      this.repositorioDeReglaCantidad.create({ idPromocion, cantidadMinima, tipoDescuento, valorDescuento })
    );

    return this.obtenerPromocionPorId(idPromocion);
  }

  // --- Reglas de tipo "PrecioEspecial" ---

  public async agregarReglaDePrecioEspecial(
    idPromocion: number,
    idProducto: number,
    precioEspecial: number
  ): Promise<Promocion> {
    await this.obtenerPromocionPorId(idPromocion);

    const reglaNueva = this.repositorioDeReglaPrecioEspecial.create({ idPromocion, idProducto, precioEspecial });
    await this.repositorioDeReglaPrecioEspecial.save(reglaNueva);

    return this.obtenerPromocionPorId(idPromocion);
  }

  public async eliminarReglaDePrecioEspecial(idRegla: number): Promise<void> {
    await this.repositorioDeReglaPrecioEspecial.delete({ idRegla });
  }

  // --- Reglas de tipo "DescuentoPorMontoPedido" / "ProductoGratisPorMonto" ---
  // Solo puede haber una regla de monto por promocion en este flujo: se reemplaza.

  public async guardarReglaDeMontoPedido(
    idPromocion: number,
    montoMinimoPedido: number,
    tipoBeneficio: 'DescuentoPorcentaje' | 'ProductoGratis',
    valorDescuento: number | null,
    idProductoRegalo: number | null
  ): Promise<Promocion> {
    await this.obtenerPromocionPorId(idPromocion);

    await this.repositorioDeReglaMontoPedido.delete({ idPromocion });
    await this.repositorioDeReglaMontoPedido.save(
      this.repositorioDeReglaMontoPedido.create({
        idPromocion,
        montoMinimoPedido,
        tipoBeneficio,
        valorDescuento,
        idProductoRegalo
      })
    );

    return this.obtenerPromocionPorId(idPromocion);
  }
}
