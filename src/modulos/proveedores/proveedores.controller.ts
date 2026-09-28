import { normalizarBusqueda } from '../../comun/utilidades/busqueda';
import { Body, Controller, Get, Param, Query, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../../comun/guards/roles.guard';
import { Roles } from '../../comun/decoradores/roles.decorator';
import { Rol } from '../../comun/enums/rol.enum';
import { ProveedoresService } from './proveedores.service';
import { ActualizarProveedorDto, CrearProveedorDto } from './dto/proveedor.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Rol.Administrador, Rol.Almacen, Rol.Cajero)
@Controller('proveedores')
export class ProveedoresController {
  constructor(private readonly proveedoresService: ProveedoresService) {}

  @Get()
  public obtenerListaDeProveedores() {
    return this.proveedoresService.obtenerListaDeProveedores();
  }

  @Get('buscar')
  public buscarProveedores(@Query('texto') texto?: string, @Query('limite') limite?: string, @Query('soloActivos') soloActivos?: string) {
    return this.proveedoresService.buscarProveedores(normalizarBusqueda(texto, limite, '1', 50), soloActivos !== 'false');
  }

  @Get(':id')
  public obtenerProveedorPorId(@Param('id', ParseIntPipe) id: number) {
    return this.proveedoresService.obtenerProveedorPorId(id);
  }

  @Roles(Rol.Administrador, Rol.Almacen)
  @Post()
  public crearProveedor(@Body() datos: CrearProveedorDto) {
    return this.proveedoresService.crearProveedor(datos);
  }

  @Roles(Rol.Administrador, Rol.Almacen)
  @Patch(':id')
  public actualizarProveedor(@Param('id', ParseIntPipe) id: number, @Body() datos: ActualizarProveedorDto) {
    return this.proveedoresService.actualizarProveedor(id, datos);
  }
}
