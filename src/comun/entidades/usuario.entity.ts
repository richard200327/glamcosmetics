import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Exclude } from 'class-transformer';

@Entity({ name: 'Usuario' })
export class Usuario {
  @PrimaryGeneratedColumn({ name: 'IdUsuario' })
  idUsuario: number;

  @Column({ name: 'NombreUsuario', type: 'varchar', length: 100 })
  nombreUsuario: string;

  // Hash bcrypt de la clave. @Exclude() + ClassSerializerInterceptor (global, ver
  // main.ts) aseguran que este campo NUNCA salga en ninguna respuesta JSON, sin
  // importar en que endpoint o relacion anidada aparezca la entidad Usuario.
  @Exclude()
  @Column({ name: 'Clave', type: 'varchar', length: 255 })
  clave: string;

  @Column({ name: 'Rol', type: 'varchar', length: 50 })
  rol: string;

  @Column({ name: 'Activo', type: 'tinyint', width: 1, default: 1 })
  activo: boolean;
}
