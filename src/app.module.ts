import { construirSslDeBaseDeDatos } from './config/ssl-de-base-de-datos';
import { join } from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TiendaModule } from './modulos/tienda/tienda.module';
import { ClientesModule } from './modulos/clientes/clientes.module';
import { UsuariosModule } from './modulos/usuarios/usuarios.module';
import { AuthModule } from './modulos/auth/auth.module';
import { ProductosModule } from './modulos/productos/productos.module';
import { TasasDeCambioModule } from './modulos/tasas-de-cambio/tasas-de-cambio.module';
import { PedidosModule } from './modulos/pedidos/pedidos.module';
import { CuentasModule } from './modulos/cuentas/cuentas.module';
import { PagosModule } from './modulos/pagos/pagos.module';
import { PromocionesModule } from './modulos/promociones/promociones.module';
import { ReportesModule } from './modulos/reportes/reportes.module';
import { AuditoriaModule } from './modulos/auditoria/auditoria.module';
import { MetodosPagoModule } from './modulos/metodos-pago/metodos-pago.module';
import { SaludModule } from './modulos/salud/salud.module';
import { ProveedoresModule } from './modulos/proveedores/proveedores.module';
import { ComprasModule } from './modulos/compras/compras.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: [join(__dirname, '..', '.env'), join(process.cwd(), '.env')] }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 3306),
        username: configService.get<string>('DB_USERNAME', 'root'),
        password: configService.get<string>('DB_PASSWORD', ''),
        database: configService.get<string>('DB_DATABASE', 'sistema_ventas_pedidos'),
        ssl: construirSslDeBaseDeDatos((clave) => configService.get<string>(clave)),
        autoLoadEntities: true,
        // synchronize se mantiene en false: el esquema se controla por las migraciones
        // SQL en /migraciones, no por TypeORM.
        synchronize: false,
        // Sin esto, si el pool de conexiones se agota (ej: muchas pestañas/pantallas
        // pidiendo datos a la vez, mas el interceptor de auditoria que escribe en CADA
        // peticion autenticada), una peticion nueva esperaba una conexion libre PARA
        // SIEMPRE, sin fallar ni avisar — eso se veia como una pantalla "Cargando..."
        // infinita en el frontend. Con queueLimit, si se agota la cola de espera, la
        // peticion falla rapido con un error claro en vez de colgarse sin explicacion.
        extra: {
          connectionLimit: 20,
          waitForConnections: true,
          queueLimit: 50,
          connectTimeout: 10000
        }
      })
    }),
    TiendaModule,
    ClientesModule,
    UsuariosModule,
    AuthModule,
    ProductosModule,
    TasasDeCambioModule,
    PedidosModule,
    CuentasModule,
    PagosModule,
    PromocionesModule,
    ReportesModule,
    AuditoriaModule,
    MetodosPagoModule,
    SaludModule,
    ProveedoresModule,
    ComprasModule
  ]
})
export class AppModule {}
