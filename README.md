# Backend — Sistema de Ventas y Pedidos (NestJS)

API REST en NestJS + TypeORM (MySQL) que sirve al frontend Angular de este mismo repositorio
(`sistema-ventas-pedidos`). Cubre: Clientes, Proveedores, Compras, Usuarios/Auth, Productos con kardex y costo
promedio ponderado, Pedidos/Ventas con descuentos manuales y regalos, Cuentas por
Cobrar/Pagar, Pagos (cobros y pagos a proveedores), Promociones, Tasas de Cambio, Tablero y
Reportes de ganancia e inventario valorizado.

## Requisitos

- Node.js 20+ (22.22.3+ si tambien compilas el frontend)
- MySQL 8+ o MariaDB 10.11+ con la base migrada (ver `../migraciones/README.md`)

## Instalación

```bash
cd backend
npm install
cp .env.example .env
# edita .env con tus credenciales de MySQL y un JWT_SECRET propio
npm run start:dev
```

La API queda disponible en `http://localhost:3000/api`.

## Estructura

```
src/
  comun/entidades/       Entidades TypeORM (mapeo 1:1 con las tablas de /migraciones)
  config/                 Datasource de TypeORM para la CLI de migraciones
  modulos/
    auth/                 Login JWT (usuarios.NombreUsuario + clave con bcrypt)
    usuarios/
    clientes/
    productos/             <- costoPromedio vive aqui
    tasas-de-cambio/        BCV / Binance, snapshot diario
    pedidos/                Crea el pedido, descuenta inventario, snapshot de costo y tasa
    cuentas/                Cuentas por Cobrar/Pagar (CXC/CXP)
    pagos/                  Aplica pagos a cuentas (siempre a tasa BCV), anulacion reversible
    promociones/            CRUD de promociones y sus 3 tipos de regla
    reportes/               Reporte de ventas con ganancia bruta y margen
```

## Autenticación

`POST /api/auth/login` con `{ "nombreUsuario": "...", "clave": "..." }` devuelve un
`accessToken` (JWT). El resto de los endpoints requieren el header:

```
Authorization: Bearer <accessToken>
```

Los usuarios se crean via `POST /api/usuarios` (la clave se guarda con bcrypt, nunca en
texto plano; nunca se devuelve en las respuestas).

## Inventario, costo y ganancia

- **Kardex:** todo cambio de existencia pasa por `KardexService` dentro de la misma
  transaccion que lo origina, con bloqueo `FOR UPDATE` del producto. Cada movimiento guarda
  `Origen` (Inicial, Ajuste, Compra, Venta, AnulacionVenta, AnulacionCompra), el documento de
  referencia, el usuario, la existencia resultante y el costo promedio resultante.
- **Costo promedio ponderado:** cada compra lo recalcula con
  `(existencia * costoActual + cantidad * costoReal) / (existencia + cantidad)`. El costo real
  de cada linea incluye el descuento del proveedor y el flete prorrateados por valor. Anular
  una compra revierte existencia y costo (se bloquea si ya se vendio esa mercancia).
- **Ganancia:** `DetallePedido.CostoUnitarioUsado` guarda el costo promedio del momento de la
  venta, asi la ganancia historica no cambia si el costo cambia despues. Los regalos cuestan
  y no facturan; los descuentos manuales reducen el ingreso. Todo se refleja en reportes.

## Endpoints principales nuevos

| Metodo y ruta | Uso |
|---|---|
| `GET/POST /api/proveedores`, `GET/PATCH /api/proveedores/:id` | Proveedores con `saldoPorPagar` |
| `GET/POST /api/compras`, `GET /api/compras/:id`, `PATCH /api/compras/:id/anular` | Compras (filtros `idProveedor`, `estado`, `fechaDesde`, `fechaHasta`) |
| `GET /api/compras/costos-por-producto/:id` | Historial de costos de compra de un producto |
| `POST /api/pedidos/evaluar` | Calcula promociones, descuentos manuales, regalos, costo y ganancia sin guardar |
| `POST /api/pedidos` | Crea pedido o venta; en contado registra el pago mixto en la misma transaccion |
| `PATCH /api/pedidos/:id/anular` | Anula con motivo, devuelve inventario y anula la cuenta y el pago de contado |
| `GET /api/productos/:id/kardex`, `GET /api/productos/movimientos/historial` | Kardex y movimientos con filtros |
| `GET /api/cuentas/resumen` | Totales por cobrar y por pagar, vencidos |
| `POST /api/pagos` con `idProveedor` | Pago a proveedor sobre cuentas CXP |
| `GET /api/reportes/ventas`, `GET /api/reportes/inventario`, `GET /api/tablero` | Reportes y tablero (costos y ganancia solo para Administrador) |
| `PATCH /api/usuarios/:id/clave` | Cambio de clave |

## Migraciones SQL

Viven en `../migraciones`. Para una base nueva usa `esquema_completo.sql` (incluye hasta la
014). Para una base existente aplica solo las que falten, en orden; la ultima es
`014_compras_proveedores_kardex_y_descuentos_manuales.sql`.

## Nota importante: columnas `decimal` y aritmética

Todas las columnas `decimal` de todas las entidades usan `transformadorDecimal`
(`src/comun/transformadores/decimal.transformer.ts`). Esto es obligatorio: MySQL/TypeORM
devuelve `decimal` como `string` (ej. `"60.00"`), y sin este transformer cualquier suma
sobre esos campos hace **concatenación de strings** en vez de aritmética (`"0.00" +
"60.00"` = `"0.0060.00"`), lo que eventualmente genera `NaN` y rompe la query de
`UPDATE` con `Unknown column 'NaN' in 'field list'`. Esto no es teórico: se reprodujo
y se corrigió durante el desarrollo, al anular un pago (`PagosService.anularPago` →
`CuentasService.revertirAbonoACuenta`). Si se agrega una entidad nueva con columnas
`decimal`, hay que recordar añadir `transformer: transformadorDecimal`.

## Sincronización automática de tasas (dolarapi.com)

`POST /api/tasas-de-cambio/sincronizar` (solo Administrador) consulta
`https://ve.dolarapi.com/v1/dolares` y guarda la tasa del día:
- `fuente: "oficial"` → `ValorTasaBcv`
- `fuente: "paralelo"` → `ValorTasaBinance` (convención usual en Venezuela de
  aproximar la tasa Binance P2P con la tasa paralelo)

Usa el `fetch` global de Node 18+ (`DolarApiClienteService`), sin dependencias nuevas.
Si dolarapi.com no responde o no trae ambas fuentes, no se guarda nada a medias — se
lanza un error claro y la tasa ya registrada queda intacta; el usuario puede seguir
registrando la tasa manualmente ese día. Lógica de mapeo cubierta por
`tasas-de-cambio.service.spec.ts` (5 tests). **No se pudo probar la llamada de red real
en este entorno de desarrollo** porque `ve.dolarapi.com` no está en la lista blanca de
red del sandbox — probar en un entorno con acceso a internet real antes de confiar en
ella para producción.

## Logging y paginación

- **Logger centralizado** (`src/comun/logger/logger-de-aplicacion.ts`), instanciado
  directamente en el constructor de cada servicio (siguiendo la convención del
  proyecto: logger en la capa de servicio). Registra eventos de negocio clave:
  creación/anulación de pedidos y pagos, e intentos de login (exitosos y fallidos,
  sin filtrar si el motivo fue "usuario no existe" vs "clave incorrecta" al cliente,
  pero sí en el log interno).
- **Paginación** en `GET /pedidos`, `GET /cuentas` y `GET /pagos` vía `?pagina=` y
  `?limite=` (máximo 200). Por defecto se limita a 50 resultados para no traer el
  historial completo sin cota — antes estas consultas no tenían ningún límite.

Adicionalmente, se verificó con curl contra MySQL real que la **idempotencia** funciona:
dos peticiones `POST /pedidos` (y por separado, dos `POST /pagos`) con el mismo header
`X-Idempotency-Key` devuelven el mismo registro y **no duplican** el descuento de
inventario ni el abono a la cuenta. También se verificó la **paginación** (`?limite=`
respeta el tope de 200) y que los **21 tests automatizados** (`npm test`) pasan.

## Verificado end-to-end

Probado contra MariaDB 10.11 con la base creada desde `esquema_completo.sql` y, por
separado, aplicando 001 a 014 una por una (mismo esquema columna por columna). Flujo
verificado: compras a credito y de contado con prorrateo, costo promedio ponderado, venta
de contado con pago mixto, descuento por linea y global y regalo, pedido a credito con
abono parcial (estado Parcial), bloqueo de anulacion con abonos, anulacion de pago, pedido,
venta y compra con reversion de inventario y costo, kardex, reportes, tablero, resumen de
cuentas y saldo por proveedor. `npx jest` ejecuta las pruebas unitarias de calculadora de
pedido, kardex y cuentas.
