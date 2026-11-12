import type { Request } from 'express';
import type { JwtPayload } from '../auth/jwt-payload';

export interface OptionalAuthenticatedRequest extends Request {
  user?: JwtPayload;
}
