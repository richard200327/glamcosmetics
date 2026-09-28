import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../comun/guards/roles.guard';
import { Roles } from '../../comun/decoradores/roles.decorator';
import { Rol } from '../../comun/enums/rol.enum';
import { UsuarioActual, UsuarioAutenticado } from '../../comun/decoradores/usuario-actual.decorator';
import { FidelidadService } from './fidelidad.service';
import { ActualizarFidelidadDto, CanjearPremioDto } from './fidelidad.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('fidelidad')
export class FidelidadController {
  constructor(private readonly fidelidadService: FidelidadService) {}

  @Get('configuracion')
  public obtenerConfiguracion() {
    return this.fidelidadService.obtenerConfiguracion();
  }

  @Patch('configuracion')
  @Roles(Rol.Administrador)
  public actualizarConfiguracion(@Body() datos: ActualizarFidelidadDto) {
    return this.fidelidadService.actualizarConfiguracion(datos);
  }

  @Get('clientes')
  public obtenerClientes(@Query('buscar') buscar?: string, @Query('estado') estado?: string, @Query('pagina') pagina?: string, @Query('limite') limite?: string) {
    return this.fidelidadService.obtenerClientes(
      (buscar ?? '').slice(0, 80),
      estado ?? 'todos',
      Math.max(Number(pagina) || 1, 1),
      Math.min(Math.max(Number(limite) || 30, 1), 100)
    );
  }

  @Get('clientes/:id/canjes')
  public obtenerCanjes(@Param('id', ParseIntPipe) id: number) {
    return this.fidelidadService.obtenerCanjes(id);
  }

  @Post('clientes/:id/canjear')
  @Roles(Rol.Administrador, Rol.Cajero, Rol.Vendedor)
  public canjear(@Param('id', ParseIntPipe) id: number, @Body() datos: CanjearPremioDto, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.fidelidadService.canjear(id, datos, usuario.idUsuario);
  }
}
