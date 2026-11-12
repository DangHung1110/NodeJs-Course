export interface JwtPayload {
  readonly sub: string;
  readonly jti: string;
  readonly exp: number;
  readonly type: 'access';
  readonly version: number;
}

export interface RefreshTokenPayload {
  readonly sub: string;
  readonly jti: string;
  readonly exp: number;
  readonly type: 'refresh';
  readonly version: number;
}
