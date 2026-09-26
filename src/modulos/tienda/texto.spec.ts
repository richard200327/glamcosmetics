import { crearSlug, generarCodigoDePedido, normalizarDocumento } from './texto';
import { normalizarWhatsApp } from './tienda.service';

describe('utilidades de la tienda', () => {
  it('crea slugs sin acentos ni simbolos', () => {
    expect(crearSlug('Base Pro Filt\'r Soft Matte – Tono Cálido')).toBe('base-pro-filt-r-soft-matte-tono-calido');
    expect(crearSlug('   ')).toBe('item');
  });

  it('normaliza la cedula para reconocer a la misma clienta', () => {
    expect(normalizarDocumento('V-18.555.444')).toBe('V18555444');
    expect(normalizarDocumento('v18555444')).toBe('V18555444');
  });

  it('lleva el telefono venezolano al formato internacional de WhatsApp', () => {
    expect(normalizarWhatsApp('0414-555.12.34')).toBe('584145551234');
    expect(normalizarWhatsApp('4145551234')).toBe('584145551234');
    expect(normalizarWhatsApp('+58 414 5551234')).toBe('584145551234');
  });

  it('genera codigos de pedido legibles', () => {
    expect(generarCodigoDePedido()).toMatch(/^GC-[A-HJ-NP-Z2-9]{6}$/);
  });
});
