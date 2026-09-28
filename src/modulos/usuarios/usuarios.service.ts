import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Usuario } from '../../comun/entidades';

@Injectable()
export class UsuariosService {
  constructor(
    @InjectRepository(Usuario)
    private readonly repositorioDeUsuarios: Repository<Usuario>
  ) {}

  public async buscarPorNombreDeUsuario(nombreUsuario: string): Promise<Usuario | null> {
    return this.repositorioDeUsuarios.findOne({ where: { nombreUsuario } });
  }

  public async obtenerListaDeUsuarios(): Promise<Omit<Usuario, 'clave'>[]> {
    const usuarios = await this.repositorioDeUsuarios.find({ order: { nombreUsuario: 'ASC' } });
    return usuarios.map((usuario) => this.sinClave(usuario));
  }

  public async obtenerUsuarioPorId(idUsuario: number): Promise<Omit<Usuario, 'clave'>> {
    const usuario = await this.repositorioDeUsuarios.findOne({ where: { idUsuario } });

    if (usuario === null) {
      throw new NotFoundException(`No se encontro el usuario con id ${idUsuario}.`);
    }

    return this.sinClave(usuario);
  }

  public async crearUsuario(datos: { nombreUsuario: string; clave: string; rol: string }): Promise<Omit<Usuario, 'clave'>> {
    const existente = await this.buscarPorNombreDeUsuario(datos.nombreUsuario.trim());
    if (existente !== null) {
      throw new ConflictException(`Ya existe un usuario llamado "${datos.nombreUsuario}".`);
    }

    const claveEncriptada = await bcrypt.hash(datos.clave, 10);

    const usuarioNuevo = this.repositorioDeUsuarios.create({
      nombreUsuario: datos.nombreUsuario.trim(),
      clave: claveEncriptada,
      rol: datos.rol,
      activo: true
    });

    const usuarioGuardado = await this.repositorioDeUsuarios.save(usuarioNuevo);
    return this.sinClave(usuarioGuardado);
  }

  public async actualizarUsuario(
    idUsuario: number,
    datos: { rol?: string; activo?: boolean }
  ): Promise<Omit<Usuario, 'clave'>> {
    const usuario = await this.repositorioDeUsuarios.findOne({ where: { idUsuario } });

    if (usuario === null) {
      throw new NotFoundException(`No se encontro el usuario con id ${idUsuario}.`);
    }

    Object.assign(usuario, datos);
    const usuarioGuardado = await this.repositorioDeUsuarios.save(usuario);
    return this.sinClave(usuarioGuardado);
  }

  public async cambiarClave(idUsuario: number, clave: string): Promise<Omit<Usuario, 'clave'>> {
    const usuario = await this.repositorioDeUsuarios.findOne({ where: { idUsuario } });

    if (usuario === null) {
      throw new NotFoundException(`No se encontro el usuario con id ${idUsuario}.`);
    }

    usuario.clave = await bcrypt.hash(clave, 10);
    const usuarioGuardado = await this.repositorioDeUsuarios.save(usuario);
    return this.sinClave(usuarioGuardado);
  }

  private sinClave(usuario: Usuario): Omit<Usuario, 'clave'> {
    const { clave, ...usuarioSinClave } = usuario;
    return usuarioSinClave;
  }
}
