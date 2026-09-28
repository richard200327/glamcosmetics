import { construirSslDeBaseDeDatos } from './ssl-de-base-de-datos';
import { join } from 'path';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import {
  Cliente,
  Usuario,
  Producto,
  TasaDeCambio,
  Pedido,
  DetallePedido,
  CuentaPorCobrarPagar,
  MetodoPago,
  RegistroPago,
  DetallePago,
  MovimientoDeInventario,
  Proveedor,
  Compra,
  DetalleCompra,
  Marca,
  Categoria,
  FamiliaDeColor,
  ProductoDeCatalogo,
  ImagenDeCatalogo,
  ConfiguracionDeTienda,
  PedidoWeb,
  DetallePedidoWeb
} from '../comun/entidades';
import { Promocion, PromocionProducto, ReglaCantidad, ReglaPrecioEspecial, ReglaMontoPedido } from '../comun/entidades/promocion.entity';
import { RegistroDeAuditoria } from '../comun/entidades/registro-de-auditoria.entity';

dotenv.config({ path: join(__dirname, '..', '..', '.env') });

// Datasource usado solo por la CLI de TypeORM (npm run migration:run / migration:revert).
// La app en si arma su conexion en app.module.ts via ConfigService.
export const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'sistema_ventas_pedidos',
  ssl: construirSslDeBaseDeDatos((clave) => process.env[clave]),
  entities: [
    Cliente,
    Usuario,
    Producto,
    TasaDeCambio,
    Pedido,
    DetallePedido,
    CuentaPorCobrarPagar,
    MetodoPago,
    RegistroPago,
    DetallePago,
    Promocion,
    PromocionProducto,
    ReglaCantidad,
    ReglaPrecioEspecial,
    ReglaMontoPedido,
    RegistroDeAuditoria,
    MovimientoDeInventario,
    Proveedor,
    Compra,
    DetalleCompra,
    Marca,
    Categoria,
    FamiliaDeColor,
    ProductoDeCatalogo,
    ImagenDeCatalogo,
    ConfiguracionDeTienda,
    PedidoWeb,
    DetallePedidoWeb
  ],
  migrations: ['src/migraciones/*.ts'],
  synchronize: false,
  logging: false
});
