import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export interface PayloadDelToken {
  sub: number;
  nombreUsuario: string;
  rol: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') || 'secreto-de-desarrollo'
    });
  }

  public async validate(payload: PayloadDelToken) {
    return { idUsuario: payload.sub, nombreUsuario: payload.nombreUsuario, rol: payload.rol };
  }
}
