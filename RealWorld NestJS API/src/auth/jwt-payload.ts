export interface JwtPayload {
  readonly sub: string;
  readonly jti: string;
  readonly exp: number;
}
