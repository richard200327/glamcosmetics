import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';

const intentos = new Map<string, number[]>();

@Injectable()
export class LimitadorDePedidosGuard implements CanActivate {
  private readonly maximo = 6;
  private readonly ventanaEnMilisegundos = 10 * 60 * 1000;

  public canActivate(contexto: ExecutionContext): boolean {
    const peticion = contexto.switchToHttp().getRequest();
    const ip = String(peticion.headers['x-forwarded-for'] ?? peticion.ip ?? 'desconocida').split(',')[0].trim();
    const ahora = Date.now();
    const recientes = (intentos.get(ip) ?? []).filter((momento) => ahora - momento < this.ventanaEnMilisegundos);
    if (recientes.length >= this.maximo) {
      throw new HttpException('Recibimos varios pedidos seguidos desde tu conexion. Espera unos minutos o escribenos por WhatsApp.', HttpStatus.TOO_MANY_REQUESTS);
    }
    recientes.push(ahora);
    intentos.set(ip, recientes);
    if (intentos.size > 5000) {
      for (const [clave, lista] of intentos) {
        if (lista.every((momento) => ahora - momento >= this.ventanaEnMilisegundos)) {
          intentos.delete(clave);
        }
      }
    }
    return true;
  }
}
