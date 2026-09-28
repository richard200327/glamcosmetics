import { BadRequestException, Body, Controller, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../comun/guards/roles.guard';
import { Roles } from '../../comun/decoradores/roles.decorator';
import { UsuarioActual, UsuarioAutenticado } from '../../comun/decoradores/usuario-actual.decorator';
import { Rol } from '../../comun/enums/rol.enum';
import { UsuariosService } from './usuarios.service';

const ROLES_VALIDOS = Object.values(Rol);

class CrearUsuarioDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  nombreUsuario: string;

  @IsString()
  @MinLength(6)
  clave: string;

  @IsIn(ROLES_VALIDOS)
  rol: string;
}

class ActualizarUsuarioDto {
  @IsOptional()
  @IsIn(ROLES_VALIDOS)
  rol?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

class CambiarClaveDto {
  @IsString()
  @MinLength(6)
  clave: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Rol.Administrador)
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get()
  public obtenerListaDeUsuarios() {
    return this.usuariosService.obtenerListaDeUsuarios();
  }

  @Get(':id')
  public obtenerUsuarioPorId(@Param('id', ParseIntPipe) id: number) {
    return this.usuariosService.obtenerUsuarioPorId(id);
  }

  @Post()
  public crearUsuario(@Body() datos: CrearUsuarioDto) {
    return this.usuariosService.crearUsuario(datos);
  }

  @Patch(':id')
  public actualizarUsuario(
    @Param('id', ParseIntPipe) id: number,
    @Body() datos: ActualizarUsuarioDto,
    @UsuarioActual() usuario: UsuarioAutenticado
  ) {
    if (usuario.idUsuario === id && (datos.activo === false || (datos.rol !== undefined && datos.rol !== Rol.Administrador))) {
      throw new BadRequestException('No puedes desactivarte ni quitarte el rol de Administrador a ti mismo.');
    }
    return this.usuariosService.actualizarUsuario(id, datos);
  }

  @Patch(':id/clave')
  public cambiarClave(@Param('id', ParseIntPipe) id: number, @Body() datos: CambiarClaveDto) {
    return this.usuariosService.cambiarClave(id, datos.clave);
  }
}
