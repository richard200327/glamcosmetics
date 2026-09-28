import { describirPremio, FIDELIDAD_POR_DEFECTO, leerConfiguracionDeFidelidad } from './fidelidad.service';

describe('programa de fidelidad', () => {
  it('describe el premio segun su tipo', () => {
    expect(describirPremio({ ...FIDELIDAD_POR_DEFECTO, tipoDePremio: 'porcentaje', valorDelDescuento: 15 }, null)).toBe('15% de descuento en tu próxima compra');
    expect(describirPremio({ ...FIDELIDAD_POR_DEFECTO, tipoDePremio: 'monto', valorDelDescuento: 5 }, null)).toBe('$5.00 de descuento en tu próxima compra');
    expect(describirPremio({ ...FIDELIDAD_POR_DEFECTO, tipoDePremio: 'producto', cantidadDelProducto: 2 }, 'MAC Labial Ruby Woo')).toBe('2 x MAC Labial Ruby Woo de regalo');
    expect(describirPremio({ ...FIDELIDAD_POR_DEFECTO, tipoDePremio: 'otro', descripcionDelPremio: 'Una sesion de maquillaje' }, null)).toBe('Una sesion de maquillaje');
  });

  it('usa la configuracion por defecto si no hay nada guardado o esta danado', () => {
    expect(leerConfiguracionDeFidelidad(null).meta).toBe(5);
    expect(leerConfiguracionDeFidelidad('{"meta":8}').meta).toBe(8);
    expect(leerConfiguracionDeFidelidad('no es json').tipoDePremio).toBe('porcentaje');
  });
});
