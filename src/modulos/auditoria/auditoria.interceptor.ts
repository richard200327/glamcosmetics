import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AuditoriaService } from './auditoria.service';

const CAMPOS_SENSIBLES = ['clave', 'password', 'accessToken', 'token'];

// Interceptor global: registra toda peticion autenticada (metodo, ruta, usuario, rol,
// resultado) en RegistroDeAuditoria. No registra peticiones anonimas (login, por ejemplo)
// porque ahi todavia no hay un usuario identificado en request.user.
@Injectable()
export class AuditoriaInterceptor implements NestInterceptor {
  constructor(private readonly auditoriaService: AuditoriaService) {}

  public intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const usuario = request.user as { idUsuario: number; nombreUsuario: string; rol: string } | undefined;

    return next.handle().pipe(
      tap({
        next: () => this.registrar(request, usuario, context.switchToHttp().getResponse().statusCode ?? 200),
        error: (error) => this.registrar(request, usuario, error?.status ?? 500)
      })
    );
  }

  private registrar(request: any, usuario: { idUsuario: number; nombreUsuario: string; rol: string } | undefined, codigoDeRespuesta: number): void {
    if (usuario === undefined) {
      return;
    }

    void this.auditoriaService.registrarAccion({
      idUsuario: usuario.idUsuario,
      nombreDeUsuario: usuario.nombreUsuario,
      rol: usuario.rol,
      metodo: request.method,
      ruta: request.originalUrl ?? request.url,
      codigoDeRespuesta,
      resumenDelCuerpo: this.resumirCuerpo(request.body),
      direccionIp: request.ip ?? null
    });
  }

  private resumirCuerpo(cuerpo: unknown): string | null {
    if (cuerpo === undefined || cuerpo === null || Object.keys(cuerpo as object).length === 0) {
      return null;
    }

    const copia: Record<string, unknown> = { ...(cuerpo as Record<string, unknown>) };

    for (const campo of CAMPOS_SENSIBLES) {
      if (campo in copia) {
        copia[campo] = '***';
      }
    }

    const textoPlano = JSON.stringify(copia);
    return textoPlano.length > 1000 ? `${textoPlano.substring(0, 1000)}...` : textoPlano;
  }
}
