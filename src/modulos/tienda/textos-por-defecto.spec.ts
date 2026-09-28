import { calcularMontosDePago, combinarTextos, DEFINICIONES_DE_TEXTOS, leerMetodosDePago } from './textos-por-defecto';

describe('textos y montos de pago de la tienda', () => {
  it('calcula el monto en bolivares y el descuento por pago en divisas', () => {
    expect(calcularMontosDePago(28, 185.4, 210)).toEqual({ bolivares: 5191.2, divisa: 24.72, descuento: 3.28 });
  });

  it('no inventa descuentos si falta la tasa o si Binance no es mayor que el BCV', () => {
    expect(calcularMontosDePago(28, null, 210)).toEqual({ bolivares: null, divisa: 28, descuento: 0 });
    expect(calcularMontosDePago(28, 185.4, null)).toEqual({ bolivares: 5191.2, divisa: 28, descuento: 0 });
    expect(calcularMontosDePago(28, 210, 185.4)).toEqual({ bolivares: 5880, divisa: 28, descuento: 0 });
  });

  it('combina los textos guardados con los textos por defecto', () => {
    const textos = combinarTextos(JSON.stringify({ 'portada.titulo': 'Brilla con Glam', 'clave.inventada': 'x', 'banner.boton': '   ' }));
    expect(textos['portada.titulo']).toBe('Brilla con Glam');
    expect(textos['banner.boton']).toBe('Ver catálogo');
    expect(textos['clave.inventada']).toBeUndefined();
    expect(Object.keys(textos)).toHaveLength(DEFINICIONES_DE_TEXTOS.length);
    expect(combinarTextos('no es json')['portada.titulo']).toBe('Tu belleza, en su tono exacto');
  });

  it('usa los cuatro metodos de pago por defecto si no hay configuracion', () => {
    expect(leerMetodosDePago(null).map((metodo) => metodo.id)).toEqual(['pago-movil', 'transferencia', 'zelle', 'binance']);
    expect(leerMetodosDePago('[]')).toEqual([]);
  });
});
