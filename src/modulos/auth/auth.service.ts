import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsuariosService } from '../usuarios/usuarios.service';
import { LoginDto } from './dto/login.dto';
import { LoggerDeAplicacion } from '../../comun/logger/logger-de-aplicacion';

@Injectable()
export class AuthService {
  private readonly logger = new LoggerDeAplicacion('AuthService');

  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly jwtService: JwtService
  ) {}

  public async iniciarSesion(datos: LoginDto) {
    const usuario = await this.usuariosService.buscarPorNombreDeUsuario(datos.nombreUsuario);

    if (usuario === null || !usuario.activo) {
      // No se distingue "usuario no existe" de "usuario inactivo" en el mensaje al
      // cliente (para no dar pistas a un atacante), pero SI se distingue en el log,
      // que es informacion solo para el equipo tecnico.
      this.logger.warn('Intento de login fallido', { nombreUsuario: datos.nombreUsuario, motivo: 'usuario no encontrado o inactivo' });
      throw new UnauthorizedException('Usuario o clave incorrectos.');
    }

    const laClaveEsValida = await bcrypt.compare(datos.clave, usuario.clave);

    if (!laClaveEsValida) {
      this.logger.warn('Intento de login fallido', { nombreUsuario: datos.nombreUsuario, motivo: 'clave incorrecta' });
      throw new UnauthorizedException('Usuario o clave incorrectos.');
    }

    const payload = { sub: usuario.idUsuario, nombreUsuario: usuario.nombreUsuario, rol: usuario.rol };

    this.logger.log('Login exitoso', { idUsuario: usuario.idUsuario, nombreUsuario: usuario.nombreUsuario, rol: usuario.rol });

    return {
      accessToken: await this.jwtService.signAsync(payload),
      usuario: {
        idUsuario: usuario.idUsuario,
        nombreUsuario: usuario.nombreUsuario,
        rol: usuario.rol
      }
    };
  }
}
