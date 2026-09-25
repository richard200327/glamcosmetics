import { Injectable, Logger, LoggerService } from '@nestjs/common';

// Logger centralizado en la capa de servicio, siguiendo la convencion de logger en el
// servicio (no en el controlador). Envuelve el Logger nativo de Nest para que cada
// servicio pueda instanciar el suyo con su propio contexto (nombre de la clase) sin
// repetir codigo, y para tener un unico lugar donde cambiar de implementacion (ej: a
// Winston o Pino) si el proyecto lo necesita mas adelante.
@Injectable()
export class LoggerDeAplicacion implements LoggerService {
  private readonly logger: Logger;

  constructor(contexto: string) {
    this.logger = new Logger(contexto);
  }

  public log(mensaje: string, detalle?: Record<string, unknown>): void {
    this.logger.log(this.formatear(mensaje, detalle));
  }

  public warn(mensaje: string, detalle?: Record<string, unknown>): void {
    this.logger.warn(this.formatear(mensaje, detalle));
  }

  public error(mensaje: string, error?: unknown, detalle?: Record<string, unknown>): void {
    const stack = error instanceof Error ? error.stack : undefined;
    this.logger.error(this.formatear(mensaje, detalle), stack);
  }

  private formatear(mensaje: string, detalle?: Record<string, unknown>): string {
    if (!detalle || Object.keys(detalle).length === 0) {
      return mensaje;
    }
    return `${mensaje} ${JSON.stringify(detalle)}`;
  }
}
