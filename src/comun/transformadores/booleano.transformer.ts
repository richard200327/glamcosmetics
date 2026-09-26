import { ValueTransformer } from 'typeorm';

export const transformadorBooleano: ValueTransformer = {
  to: (valor: boolean | number | null | undefined) => (valor === null || valor === undefined ? valor : valor ? 1 : 0),
  from: (valor: number | string | boolean | null) => (valor === null || valor === undefined ? valor : Boolean(Number(valor)))
};
