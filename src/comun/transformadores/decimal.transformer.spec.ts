import { transformadorDecimal } from './decimal.transformer';

// Este test existe porque la falta de este transformer causo un bug real durante el
// desarrollo: MySQL devuelve las columnas `decimal` como string, y sin conversion a
// number, sumar dos "decimales" hacia concatenacion de strings en vez de aritmetica
// (ej: "0.00" + "60.00" = "0.0060.00"), lo que terminaba generando NaN y rompiendo el
// UPDATE con "Unknown column 'NaN' in 'field list'" al anular un pago.
describe('transformadorDecimal', () => {
  describe('from (lectura desde la base de datos)', () => {
    it('convierte un string decimal a number', () => {
      expect(transformadorDecimal.from('60.00')).toBe(60);
    });

    it('convierte un string decimal con decimales reales a number', () => {
      expect(transformadorDecimal.from('55.2000')).toBeCloseTo(55.2);
    });

    it('devuelve null si el valor es null (columnas nullable)', () => {
      expect(transformadorDecimal.from(null)).toBeNull();
    });

    it('permite sumar dos valores leidos sin caer en concatenacion de strings', () => {
      const saldoPendiente = transformadorDecimal.from('0.00') as number;
      const montoAplicado = transformadorDecimal.from('60.00') as number;

      // Antes del fix, esto seria "0.00" + "60.00" = "0.0060.00" (string), no 60 (number).
      expect(saldoPendiente + montoAplicado).toBe(60);
      expect(typeof (saldoPendiente + montoAplicado)).toBe('number');
    });
  });

  describe('to (escritura hacia la base de datos)', () => {
    it('deja pasar el valor number tal cual (TypeORM/mysql2 lo serializa)', () => {
      expect(transformadorDecimal.to(60)).toBe(60);
    });

    it('deja pasar null/undefined tal cual', () => {
      expect(transformadorDecimal.to(null)).toBeNull();
      expect(transformadorDecimal.to(undefined)).toBeUndefined();
    });
  });
});
