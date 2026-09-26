import { Controller, Get } from '@nestjs/common';

// Endpoint de prueba/health-check, SIN autenticacion: sirve para verificar rapido que
// el backend esta arriba y respondiendo, antes de siquiera hacer login. Util para
// Postman, monitoreo, o para que Mario confirme que el servidor levanto bien.
@Controller('salud')
export class SaludController {
  @Get()
  public verificarEstado() {
    return {
      estado: 'ok',
      mensaje: 'Backend de Sistema de Ventas y Pedidos funcionando correctamente.',
      fecha: new Date().toISOString()
    };
  }
}
