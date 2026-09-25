import { createParamDecorator, ExecutionContext } from '@nestjs/common';

// Extrae X-Idempotency-Key del header de la peticion. Es opcional: si el cliente no
// lo manda, el endpoint simplemente no aplica proteccion de idempotencia (se comporta
// como antes). El frontend SI lo manda en pedidos.crearPedido y pagos.crearPago.
export const ClaveDeIdempotencia = createParamDecorator((_datos: unknown, ctx: ExecutionContext): string | null => {
  const request = ctx.switchToHttp().getRequest();
  const valor = request.headers['x-idempotency-key'];
  return typeof valor === 'string' && valor.trim().length > 0 ? valor.trim() : null;
});
