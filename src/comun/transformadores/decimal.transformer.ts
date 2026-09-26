import { ValueTransformer } from 'typeorm';

// MySQL/TypeORM devuelve las columnas `decimal` como STRING (ej: "60.00"), no como
// number, para no perder precision. Sin este transformer, cualquier aritmetica sobre
// esos campos hace concatenacion de strings en vez de suma ("0.00" + "60.00" =
// "0.0060.00"), lo que eventualmente produce NaN y rompe la query de UPDATE
// ("Unknown column 'NaN'"). Se aplica a TODAS las columnas decimal de todas las
// entidades para que el resto del codigo pueda sumar/restar estos campos con
// seguridad, tratandolos como number en todo momento dentro de la aplicacion.
export const transformadorDecimal: ValueTransformer = {
  to: (valor: number | null | undefined) => valor,
  from: (valor: string | null) => (valor === null ? null : parseFloat(valor))
};
