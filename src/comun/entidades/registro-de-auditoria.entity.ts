import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Usuario } from './usuario.entity';

@Entity({ name: 'RegistroDeAuditoria' })
export class RegistroDeAuditoria {
  @PrimaryGeneratedColumn({ name: 'IdRegistro' })
  idRegistro: number;

  @Column({ name: 'IdUsuario', nullable: true })
  idUsuario: number | null;

  @ManyToOne(() => Usuario, { eager: false, nullable: true })
  @JoinColumn({ name: 'IdUsuario' })
  usuario: Usuario | null;

  @Column({ name: 'NombreDeUsuario', type: 'varchar', length: 100, nullable: true })
  nombreDeUsuario: string | null;

  @Column({ name: 'Rol', type: 'varchar', length: 50, nullable: true })
  rol: string | null;

  @Column({ name: 'Metodo', type: 'varchar', length: 10 })
  metodo: string;

  @Column({ name: 'Ruta', type: 'varchar', length: 250 })
  ruta: string;

  @Column({ name: 'CodigoDeRespuesta', type: 'int' })
  codigoDeRespuesta: number;

  // Resumen truncado del body de la peticion (nunca se guardan claves/contraseñas,
  // ver AuditoriaInterceptor.limpiarCuerpoSensible).
  @Column({ name: 'ResumenDelCuerpo', type: 'varchar', length: 1000, nullable: true })
  resumenDelCuerpo: string | null;

  @Column({ name: 'DireccionIp', type: 'varchar', length: 64, nullable: true })
  direccionIp: string | null;

  @CreateDateColumn({ name: 'Fecha', type: 'datetime' })
  fecha: Date;
}
