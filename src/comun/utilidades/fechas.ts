const completarConCero = (valor: number): string => String(valor).padStart(2, '0');

export function formatearFechaLocal(fecha: Date): string {
  return `${fecha.getFullYear()}-${completarConCero(fecha.getMonth() + 1)}-${completarConCero(fecha.getDate())}`;
}

export function obtenerFechaLocalDeHoy(): string {
  return formatearFechaLocal(new Date());
}

export function sumarDiasAFecha(fecha: Date, dias: number): Date {
  const copia = new Date(fecha);
  copia.setDate(copia.getDate() + dias);
  return copia;
}

export function redondearMoneda(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

export function redondearCosto(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 10000) / 10000;
}
