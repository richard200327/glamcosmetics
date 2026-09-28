import { Brackets } from 'typeorm';
import { ParametrosDeBusqueda, escaparLike, palabrasDeBusqueda } from '../../comun/utilidades/busqueda';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { CuentaPorCobrarPagar, Proveedor } from '../../comun/entidades';
import { ActualizarProveedorDto, CrearProveedorDto } from './dto/proveedor.dto';

export interface ProveedorConSaldo extends Proveedor {
  saldoPorPagar: number;
  cantidadDeCuentasAbiertas: number;
}

@Injectable()
export class ProveedoresService {
  constructor(
    @InjectRepository(Proveedor)
    private readonly repositorioDeProveedores: Repository<Proveedor>,
    @InjectRepository(CuentaPorCobrarPagar)
    private readonly repositorioDeCuentas: Repository<CuentaPorCobrarPagar>
  ) {}

  public async buscarProveedores(parametros: ParametrosDeBusqueda, soloActivos: boolean): Promise<Proveedor[]> {
    const consulta = this.repositorioDeProveedores.createQueryBuilder('proveedor');
    if (soloActivos) {
      consulta.andWhere('proveedor.activo = 1');
    }
    palabrasDeBusqueda(parametros.texto).forEach((palabra, indice) => {
      consulta.andWhere(
        new Brackets((grupo) => {
          grupo
            .where(`proveedor.nombre LIKE :palabra${indice}`)
            .orWhere(`proveedor.documento LIKE :palabra${indice}`)
            .orWhere(`proveedor.personaDeContacto LIKE :palabra${indice}`);
        }),
        { [`palabra${indice}`]: `%${escaparLike(palabra)}%` }
      );
    });
    return consulta.orderBy('proveedor.nombre', 'ASC').take(parametros.limite).getMany();
  }

  public async obtenerListaDeProveedores(): Promise<ProveedorConSaldo[]> {
    const proveedores = await this.repositorioDeProveedores.find({ order: { nombre: 'ASC' } });

    const saldos = await this.repositorioDeCuentas
      .createQueryBuilder('cuenta')
      .select('cuenta.idProveedor', 'idProveedor')
      .addSelect('SUM(cuenta.saldoPendiente)', 'saldo')
      .addSelect('COUNT(*)', 'cantidad')
      .where('cuenta.tipoCuenta = :tipo', { tipo: 'CXP' })
      .andWhere('cuenta.saldoPendiente > 0')
      .andWhere('cuenta.estado != :anulada', { anulada: 'Anulada' })
      .groupBy('cuenta.idProveedor')
      .getRawMany<{ idProveedor: number; saldo: string; cantidad: string }>();

    const mapaDeSaldos = new Map(saldos.map((fila) => [Number(fila.idProveedor), fila]));

    return proveedores.map((proveedor) => {
      const fila = mapaDeSaldos.get(proveedor.idProveedor);
      return {
        ...proveedor,
        saldoPorPagar: fila ? Number(fila.saldo) : 0,
        cantidadDeCuentasAbiertas: fila ? Number(fila.cantidad) : 0
      };
    });
  }

  public async obtenerProveedorPorId(idProveedor: number): Promise<Proveedor> {
    const proveedor = await this.repositorioDeProveedores.findOne({ where: { idProveedor } });

    if (proveedor === null) {
      throw new NotFoundException(`No se encontro el proveedor con id ${idProveedor}.`);
    }

    return proveedor;
  }

  public async crearProveedor(datos: CrearProveedorDto): Promise<Proveedor> {
    await this.validarDocumentoUnico(datos.documento, null);

    const proveedorNuevo = this.repositorioDeProveedores.create({
      nombre: datos.nombre.trim(),
      documento: datos.documento.trim().toUpperCase(),
      telefono: datos.telefono ?? null,
      correo: datos.correo ?? null,
      direccion: datos.direccion ?? null,
      personaDeContacto: datos.personaDeContacto ?? null,
      diasDeCredito: datos.diasDeCredito ?? 0,
      activo: true
    });

    return this.repositorioDeProveedores.save(proveedorNuevo);
  }

  public async actualizarProveedor(idProveedor: number, datos: ActualizarProveedorDto): Promise<Proveedor> {
    const proveedor = await this.obtenerProveedorPorId(idProveedor);

    if (datos.documento !== undefined) {
      await this.validarDocumentoUnico(datos.documento, idProveedor);
      datos.documento = datos.documento.trim().toUpperCase();
    }

    Object.assign(proveedor, datos);
    return this.repositorioDeProveedores.save(proveedor);
  }

  private async validarDocumentoUnico(documento: string, idProveedorExcluido: number | null): Promise<void> {
    const existente = await this.repositorioDeProveedores.findOne({
      where: {
        documento: documento.trim().toUpperCase(),
        ...(idProveedorExcluido !== null ? { idProveedor: Not(idProveedorExcluido) } : {})
      }
    });

    if (existente !== null) {
      throw new ConflictException(`Ya existe un proveedor registrado con el documento ${documento} (${existente.nombre}).`);
    }
  }
}
