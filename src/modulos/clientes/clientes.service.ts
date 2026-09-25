import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, SelectQueryBuilder } from 'typeorm';
import { Cliente } from '../../comun/entidades';
import { PaginaDeResultados, ParametrosDeBusqueda, escaparLike, palabrasDeBusqueda } from '../../comun/utilidades/busqueda';
import { ActualizarClienteDto, CrearClienteDto } from './dto/cliente.dto';

@Injectable()
export class ClientesService {
  constructor(
    @InjectRepository(Cliente)
    private readonly repositorioDeClientes: Repository<Cliente>
  ) {}

  public async obtenerListaDeClientes(): Promise<Cliente[]> {
    return this.repositorioDeClientes.find({ order: { nombre: 'ASC' } });
  }

  public async buscarClientes(parametros: ParametrosDeBusqueda, soloActivos: boolean): Promise<Cliente[]> {
    const consulta = this.construirConsulta(parametros.texto, soloActivos ? 'activos' : 'todos');

    if (parametros.texto !== '') {
      consulta
        .addSelect(
          `CASE WHEN cliente.documento = :exacto THEN 0 WHEN cliente.nombre LIKE :inicio THEN 1 WHEN cliente.documento LIKE :inicio THEN 2 ELSE 3 END`,
          'prioridad'
        )
        .setParameter('exacto', parametros.texto)
        .setParameter('inicio', `${escaparLike(parametros.texto)}%`)
        .orderBy('prioridad', 'ASC')
        .addOrderBy('cliente.nombre', 'ASC');
    } else {
      consulta.orderBy('cliente.nombre', 'ASC');
    }

    return consulta.take(parametros.limite).getMany();
  }

  public async obtenerPaginaDeClientes(parametros: ParametrosDeBusqueda, estado: string): Promise<PaginaDeResultados<Cliente>> {
    const [elementos, total] = await this.construirConsulta(parametros.texto, estado)
      .orderBy('cliente.nombre', 'ASC')
      .skip(parametros.desplazamiento)
      .take(parametros.limite)
      .getManyAndCount();

    return { elementos, total, pagina: parametros.desplazamiento / parametros.limite + 1, limite: parametros.limite };
  }

  public async obtenerClientePorId(idCliente: number): Promise<Cliente> {
    const cliente = await this.repositorioDeClientes.findOne({ where: { idCliente } });

    if (cliente === null) {
      throw new NotFoundException(`No se encontro el cliente con id ${idCliente}.`);
    }

    return cliente;
  }

  public async crearCliente(datos: CrearClienteDto): Promise<Cliente> {
    const clienteNuevo = this.repositorioDeClientes.create({
      nombre: datos.nombre,
      documento: datos.documento,
      telefono: datos.telefono ?? null,
      correo: datos.correo ?? null,
      direccion: datos.direccion ?? null,
      activo: true
    });

    return this.repositorioDeClientes.save(clienteNuevo);
  }

  public async actualizarCliente(idCliente: number, datos: ActualizarClienteDto): Promise<Cliente> {
    const cliente = await this.obtenerClientePorId(idCliente);
    Object.assign(cliente, datos);
    return this.repositorioDeClientes.save(cliente);
  }

  private construirConsulta(texto: string, estado: string): SelectQueryBuilder<Cliente> {
    const consulta = this.repositorioDeClientes.createQueryBuilder('cliente');

    if (estado === 'activos') {
      consulta.andWhere('cliente.activo = 1');
    } else if (estado === 'inactivos') {
      consulta.andWhere('cliente.activo = 0');
    }

    palabrasDeBusqueda(texto).forEach((palabra, indice) => {
      consulta.andWhere(
        new Brackets((grupo) => {
          grupo
            .where(`cliente.nombre LIKE :palabra${indice}`)
            .orWhere(`cliente.documento LIKE :palabra${indice}`)
            .orWhere(`cliente.telefono LIKE :palabra${indice}`)
            .orWhere(`cliente.correo LIKE :palabra${indice}`);
        }),
        { [`palabra${indice}`]: `%${escaparLike(palabra)}%` }
      );
    });

    return consulta;
  }
}
