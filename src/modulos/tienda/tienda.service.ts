import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { Categoria, ConfiguracionDeTienda, FamiliaDeColor, Marca } from '../../comun/entidades';
import { ActualizarConfiguracionDeTiendaDto, GuardarCategoriaDto, GuardarFamiliaDeColorDto, GuardarMarcaDto } from './dto/tienda.dto';
import { crearSlug, limpiarTexto } from './texto';

@Injectable()
export class TiendaService {
  constructor(
    @InjectRepository(Marca)
    private readonly repositorioDeMarcas: Repository<Marca>,
    @InjectRepository(Categoria)
    private readonly repositorioDeCategorias: Repository<Categoria>,
    @InjectRepository(FamiliaDeColor)
    private readonly repositorioDeFamilias: Repository<FamiliaDeColor>,
    @InjectRepository(ConfiguracionDeTienda)
    private readonly repositorioDeConfiguracion: Repository<ConfiguracionDeTienda>
  ) {}

  public obtenerMarcas(soloActivas = false): Promise<Marca[]> {
    return this.repositorioDeMarcas.find({ where: soloActivas ? { activa: true } : {}, order: { orden: 'ASC', nombre: 'ASC' } });
  }

  public obtenerCategorias(soloActivas = false): Promise<Categoria[]> {
    return this.repositorioDeCategorias.find({ where: soloActivas ? { activa: true } : {}, order: { orden: 'ASC', nombre: 'ASC' } });
  }

  public obtenerFamilias(soloActivas = false): Promise<FamiliaDeColor[]> {
    return this.repositorioDeFamilias.find({ where: soloActivas ? { activa: true } : {}, order: { orden: 'ASC', nombre: 'ASC' } });
  }

  public async guardarMarca(datos: GuardarMarcaDto, idMarca?: number): Promise<Marca> {
    return this.guardarConNombreYSlug(this.repositorioDeMarcas, 'idMarca', 'marca', datos, idMarca);
  }

  public async guardarCategoria(datos: GuardarCategoriaDto, idCategoria?: number): Promise<Categoria> {
    return this.guardarConNombreYSlug(this.repositorioDeCategorias, 'idCategoria', 'categoria', datos, idCategoria);
  }

  public async guardarFamilia(datos: GuardarFamiliaDeColorDto, idFamiliaDeColor?: number): Promise<FamiliaDeColor> {
    const nombre = datos.nombre.trim();
    const existente = await this.repositorioDeFamilias.findOne({ where: idFamiliaDeColor ? { nombre, idFamiliaDeColor: Not(idFamiliaDeColor) } : { nombre } });
    if (existente !== null) {
      throw new ConflictException(`Ya existe el color "${nombre}".`);
    }
    const familia = idFamiliaDeColor ? await this.repositorioDeFamilias.findOne({ where: { idFamiliaDeColor } }) : this.repositorioDeFamilias.create();
    if (familia === null) {
      throw new NotFoundException('Color no encontrado.');
    }
    Object.assign(familia, { nombre, codigoHex: datos.codigoHex.toUpperCase(), orden: datos.orden ?? familia.orden ?? 0, activa: datos.activa ?? familia.activa ?? true });
    return this.repositorioDeFamilias.save(familia);
  }

  public async obtenerConfiguracion(): Promise<ConfiguracionDeTienda> {
    const configuracion = await this.repositorioDeConfiguracion.findOne({ where: { idConfiguracion: 1 } });
    if (configuracion !== null) {
      return configuracion;
    }
    return this.repositorioDeConfiguracion.save(
      this.repositorioDeConfiguracion.create({
        idConfiguracion: 1,
        nombreDeLaTienda: 'Glam Cosmetics',
        mostrarPreciosEnBolivares: true,
        mostrarExistenciaBaja: true,
        umbralDeExistenciaBaja: 3,
        montoMinimoDePedido: 0,
        horasDeReserva: 0
      })
    );
  }

  public async actualizarConfiguracion(datos: ActualizarConfiguracionDeTiendaDto): Promise<ConfiguracionDeTienda> {
    const configuracion = await this.obtenerConfiguracion();
    for (const [clave, valor] of Object.entries(datos)) {
      if (valor === undefined) {
        continue;
      }
      (configuracion as unknown as Record<string, unknown>)[clave] = typeof valor === 'string' ? limpiarTexto(valor) : valor;
    }
    if (!configuracion.nombreDeLaTienda) {
      configuracion.nombreDeLaTienda = 'Glam Cosmetics';
    }
    if (configuracion.numeroDeWhatsApp) {
      configuracion.numeroDeWhatsApp = normalizarWhatsApp(configuracion.numeroDeWhatsApp);
    }
    return this.repositorioDeConfiguracion.save(configuracion);
  }

  private async guardarConNombreYSlug<T extends { nombre: string; slug: string; descripcion: string | null; orden: number; activa: boolean }>(
    repositorio: Repository<T>,
    campoId: keyof T & string,
    etiqueta: string,
    datos: GuardarMarcaDto,
    id?: number
  ): Promise<T> {
    const nombre = datos.nombre.trim();
    const todas = await repositorio.find();
    const otras = todas.filter((elemento) => (elemento as Record<string, unknown>)[campoId] !== id);
    if (otras.some((elemento) => elemento.nombre.toLowerCase() === nombre.toLowerCase())) {
      throw new ConflictException(`Ya existe la ${etiqueta} "${nombre}".`);
    }
    const entidad = id !== undefined ? todas.find((elemento) => (elemento as Record<string, unknown>)[campoId] === id) : repositorio.create();
    if (entidad === undefined) {
      throw new NotFoundException(`No se encontro la ${etiqueta}.`);
    }
    let slug = crearSlug(nombre);
    let sufijo = 2;
    while (otras.some((elemento) => elemento.slug === slug)) {
      slug = `${crearSlug(nombre)}-${sufijo++}`;
    }
    Object.assign(entidad, {
      nombre,
      slug,
      descripcion: limpiarTexto(datos.descripcion),
      orden: datos.orden ?? entidad.orden ?? 0,
      activa: datos.activa ?? entidad.activa ?? true
    });
    return repositorio.save(entidad);
  }
}

export function normalizarWhatsApp(numero: string): string {
  const digitos = numero.replace(/\D/g, '');
  if (digitos.length === 11 && digitos.startsWith('0')) {
    return `58${digitos.substring(1)}`;
  }
  if (digitos.length === 10 && digitos.startsWith('4')) {
    return `58${digitos}`;
  }
  return digitos;
}
