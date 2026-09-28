export interface DefinicionDeTexto {
  clave: string;
  grupo: string;
  etiqueta: string;
  valor: string;
  multilinea?: boolean;
  variables?: string[];
}

const VARIABLES_DEL_PEDIDO = ['tienda', 'codigo', 'productos', 'total', 'totalBs', 'pagos', 'nombre', 'cedula', 'telefono', 'direccion', 'nota', 'enlace'];

export const DEFINICIONES_DE_TEXTOS: DefinicionDeTexto[] = [
  { grupo: 'Portada', clave: 'portada.etiqueta', etiqueta: 'Texto pequeno sobre el titulo', valor: '{tienda}', variables: ['tienda'] },
  { grupo: 'Portada', clave: 'portada.titulo', etiqueta: 'Titulo principal', valor: 'Tu belleza, en su tono exacto' },
  { grupo: 'Portada', clave: 'portada.descripcion', etiqueta: 'Descripcion', valor: 'Maquillaje original de tus marcas favoritas. Elige tus tonos, arma tu bolsa y confirma por WhatsApp.', multilinea: true },
  { grupo: 'Portada', clave: 'portada.botonCatalogo', etiqueta: 'Boton principal', valor: 'Ver catálogo' },
  { grupo: 'Portada', clave: 'portada.botonMasVendidos', etiqueta: 'Boton secundario', valor: 'Lo más vendido' },
  { grupo: 'Garantias', clave: 'garantia.originales', etiqueta: 'Originales', valor: '100% originales' },
  { grupo: 'Garantias', clave: 'garantia.delivery', etiqueta: 'Delivery', valor: 'Delivery en toda Venezuela' },
  { grupo: 'Garantias', clave: 'garantia.entrega', etiqueta: 'Entrega inmediata', valor: 'Entrega inmediata en Barquisimeto' },
  { grupo: 'Garantias', clave: 'garantia.whatsapp', etiqueta: 'Pedido por WhatsApp (portada)', valor: 'Pedido por WhatsApp' },
  { grupo: 'Garantias', clave: 'garantia.pago', etiqueta: 'Pago (pagina del producto)', valor: 'Pagas al coordinar' },
  { grupo: 'Mas vendidos', clave: 'masVendidos.etiqueta', etiqueta: 'Texto pequeno', valor: 'Favoritos de nuestras clientas' },
  { grupo: 'Mas vendidos', clave: 'masVendidos.titulo', etiqueta: 'Titulo', valor: 'Productos más vendidos' },
  { grupo: 'Mas vendidos', clave: 'masVendidos.insignia', etiqueta: 'Etiqueta de cada tarjeta', valor: 'Más vendido' },
  { grupo: 'Mas vendidos', clave: 'masVendidos.vacio', etiqueta: 'Cuando no hay productos', valor: 'Muy pronto verás aquí nuestros productos más vendidos.' },
  { grupo: 'Banner del catalogo', clave: 'banner.etiqueta', etiqueta: 'Texto pequeno', valor: 'Todo lo que buscas' },
  { grupo: 'Banner del catalogo', clave: 'banner.titulo', etiqueta: 'Titulo', valor: 'Explora el catálogo completo' },
  { grupo: 'Banner del catalogo', clave: 'banner.descripcion', etiqueta: 'Descripcion', valor: 'Filtra por precio, categoría, color y marca para encontrar tu tono exacto.', multilinea: true },
  { grupo: 'Banner del catalogo', clave: 'banner.boton', etiqueta: 'Boton', valor: 'Ver catálogo' },
  { grupo: 'Catalogo y producto', clave: 'catalogo.titulo', etiqueta: 'Titulo del catalogo', valor: 'Todo el catálogo' },
  { grupo: 'Catalogo y producto', clave: 'producto.consulta', etiqueta: 'Enlace de consulta en el producto', valor: '¿Dudas con el tono? Pregúntanos por WhatsApp' },
  { grupo: 'Bolsa y pedido', clave: 'carrito.pie', etiqueta: 'Aviso al pie de la bolsa', valor: 'Sin registro. Coordinamos el pago y la entrega por WhatsApp.' },
  { grupo: 'Bolsa y pedido', clave: 'checkout.titulo', etiqueta: 'Titulo de finalizar pedido', valor: 'Finalizar pedido' },
  { grupo: 'Bolsa y pedido', clave: 'checkout.subtitulo', etiqueta: 'Texto de finalizar pedido', valor: 'Solo necesitamos tus datos para el delivery. Sin registro ni pagos en línea: coordinamos todo por WhatsApp.', multilinea: true },
  { grupo: 'Bolsa y pedido', clave: 'checkout.aviso', etiqueta: 'Aviso bajo el boton de confirmar', valor: 'Al confirmar apartamos tus productos y te llevamos a WhatsApp para enviarnos el pedido.', multilinea: true },
  { grupo: 'Bolsa y pedido', clave: 'confirmacion.titulo', etiqueta: 'Titulo al confirmar', valor: '¡Pedido recibido!' },
  { grupo: 'Bolsa y pedido', clave: 'confirmacion.pasoTitulo', etiqueta: 'Titulo del ultimo paso', valor: 'Último paso: envíanos tu pedido por WhatsApp' },
  { grupo: 'Bolsa y pedido', clave: 'confirmacion.pasoTexto', etiqueta: 'Texto del ultimo paso', valor: 'Así te confirmamos la disponibilidad, el pago y la hora del delivery. Tus productos ya están apartados.', multilinea: true },
  { grupo: 'Bolsa y pedido', clave: 'confirmacion.boton', etiqueta: 'Boton de WhatsApp', valor: 'Enviar pedido por WhatsApp' },
  { grupo: 'Metodos de pago', clave: 'pagos.titulo', etiqueta: 'Titulo', valor: 'Métodos de pago' },
  { grupo: 'Metodos de pago', clave: 'pagos.descripcion', etiqueta: 'Texto', valor: 'Paga con el método que prefieras y envíanos el comprobante por WhatsApp.', multilinea: true },
  { grupo: 'Metodos de pago', clave: 'pagos.descuento', etiqueta: 'Aviso de descuento', valor: 'Tienes un descuento de -{descuento} al pagar con {metodos}', variables: ['descuento', 'metodos'] },
  { grupo: 'Pie de pagina', clave: 'pie.derechos', etiqueta: 'Texto final', valor: 'Productos 100% originales' },
  {
    grupo: 'WhatsApp',
    clave: 'whatsapp.pedido',
    etiqueta: 'Mensaje del pedido (lo envia la clienta)',
    multilinea: true,
    variables: VARIABLES_DEL_PEDIDO,
    valor: 'Hola {tienda} ✨ Acabo de hacer un pedido en el catálogo.\n\n*Pedido {codigo}*\n{productos}\n\n*Total: {total}* ({totalBs})\n\n{pagos}\n\nNombre: {nombre}\nCédula: {cedula}\nTeléfono: {telefono}\nDirección de entrega: {direccion}\n{nota}\n\nVer pedido: {enlace}'
  },
  { grupo: 'WhatsApp', clave: 'whatsapp.consulta', etiqueta: 'Consulta general (boton flotante)', valor: 'Hola {tienda}, quiero hacer una consulta.', multilinea: true, variables: ['tienda'] },
  { grupo: 'WhatsApp', clave: 'whatsapp.consultaProducto', etiqueta: 'Consulta desde un producto', valor: 'Hola, me gustaría más información sobre {producto}. {enlace}', multilinea: true, variables: ['tienda', 'producto', 'enlace'] },
  {
    grupo: 'WhatsApp',
    clave: 'whatsapp.cliente',
    etiqueta: 'Mensaje a la clienta desde el panel',
    valor: 'Hola {nombre}, te escribimos de {tienda} por tu pedido {codigo} ({articulos} artículos, {total}). ¿Te confirmamos el pago y la entrega?',
    multilinea: true,
    variables: ['tienda', 'nombre', 'codigo', 'articulos', 'total']
  }
];

export interface DatoDeMetodoDePago {
  etiqueta: string;
  valor: string;
}

export interface MetodoDePagoWeb {
  id: string;
  nombre: string;
  moneda: 'bolivares' | 'divisa';
  activo: boolean;
  datos: DatoDeMetodoDePago[];
  nota: string;
}

export const METODOS_DE_PAGO_POR_DEFECTO: MetodoDePagoWeb[] = [
  {
    id: 'pago-movil',
    nombre: 'Pago móvil',
    moneda: 'bolivares',
    activo: true,
    datos: [
      { etiqueta: 'Banco', valor: '' },
      { etiqueta: 'Teléfono', valor: '' },
      { etiqueta: 'Cédula o RIF', valor: '' }
    ],
    nota: ''
  },
  {
    id: 'transferencia',
    nombre: 'Transferencia',
    moneda: 'bolivares',
    activo: true,
    datos: [
      { etiqueta: 'Banco', valor: '' },
      { etiqueta: 'Número de cuenta', valor: '' },
      { etiqueta: 'Titular', valor: '' },
      { etiqueta: 'Cédula o RIF', valor: '' }
    ],
    nota: ''
  },
  {
    id: 'zelle',
    nombre: 'Zelle',
    moneda: 'divisa',
    activo: true,
    datos: [
      { etiqueta: 'Correo', valor: '' },
      { etiqueta: 'Titular', valor: '' }
    ],
    nota: ''
  },
  {
    id: 'binance',
    nombre: 'Binance',
    moneda: 'divisa',
    activo: true,
    datos: [
      { etiqueta: 'Binance Pay ID', valor: '' },
      { etiqueta: 'Correo o usuario', valor: '' }
    ],
    nota: ''
  }
];

export function combinarTextos(guardados: string | null): Record<string, string> {
  let propios: Record<string, unknown> = {};
  try {
    propios = guardados ? (JSON.parse(guardados) as Record<string, unknown>) : {};
  } catch {
    propios = {};
  }
  const resultado: Record<string, string> = {};
  for (const definicion of DEFINICIONES_DE_TEXTOS) {
    const valor = propios[definicion.clave];
    resultado[definicion.clave] = typeof valor === 'string' && valor.trim() !== '' ? valor : definicion.valor;
  }
  return resultado;
}

export function leerMetodosDePago(guardados: string | null): MetodoDePagoWeb[] {
  try {
    const lista = guardados ? (JSON.parse(guardados) as MetodoDePagoWeb[]) : null;
    if (Array.isArray(lista)) {
      return lista;
    }
  } catch {
    return METODOS_DE_PAGO_POR_DEFECTO.map((metodo) => ({ ...metodo, datos: metodo.datos.map((dato) => ({ ...dato })) }));
  }
  return METODOS_DE_PAGO_POR_DEFECTO.map((metodo) => ({ ...metodo, datos: metodo.datos.map((dato) => ({ ...dato })) }));
}

export function calcularMontosDePago(total: number, tasaBcv: number | null, tasaBinance: number | null) {
  if (!tasaBcv || tasaBcv <= 0) {
    return { bolivares: null, divisa: total, descuento: 0 };
  }
  const bolivares = Math.round(total * tasaBcv * 100) / 100;
  if (!tasaBinance || tasaBinance <= 0) {
    return { bolivares, divisa: total, descuento: 0 };
  }
  const divisa = Math.round((bolivares / tasaBinance) * 100) / 100;
  if (divisa >= total) {
    return { bolivares, divisa: total, descuento: 0 };
  }
  return { bolivares, divisa, descuento: Math.round((total - divisa) * 100) / 100 };
}
