export function crearSlug(texto: string): string {
  const base = texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90);
  return base || 'item';
}

export function normalizarDocumento(documento: string): string {
  return documento.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function limpiarTexto(valor: string | null | undefined): string | null {
  if (valor === undefined || valor === null) {
    return null;
  }
  const limpio = valor.trim();
  return limpio === '' ? null : limpio;
}

export function generarCodigoDePedido(): string {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let codigo = '';
  for (let indice = 0; indice < 6; indice += 1) {
    codigo += alfabeto[Math.floor(Math.random() * alfabeto.length)];
  }
  return `GC-${codigo}`;
}
