export interface ParametrosDeBusqueda {
  texto: string;
  limite: number;
  desplazamiento: number;
}

export interface PaginaDeResultados<T> {
  elementos: T[];
  total: number;
  pagina: number;
  limite: number;
}

export function normalizarBusqueda(texto?: string, limite?: string, pagina?: string, limiteMaximo = 100, limitePorDefecto = 20): ParametrosDeBusqueda {
  const limiteNumerico = Math.min(Math.max(Number(limite) || limitePorDefecto, 1), limiteMaximo);
  const paginaNumerica = Math.max(Number(pagina) || 1, 1);
  return {
    texto: (texto ?? '').trim().slice(0, 100),
    limite: limiteNumerico,
    desplazamiento: (paginaNumerica - 1) * limiteNumerico
  };
}

export function escaparLike(texto: string): string {
  return texto.replace(/[\\%_]/g, (caracter) => `\\${caracter}`);
}

export function palabrasDeBusqueda(texto: string): string[] {
  return texto
    .split(/\s+/)
    .map((palabra) => palabra.trim())
    .filter((palabra) => palabra.length > 0)
    .slice(0, 6);
}
