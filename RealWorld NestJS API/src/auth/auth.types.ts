import type { Request } from 'express';
import type { UserResponse } from '../users/user-response';
import type { JwtPayload } from './jwt-payload';

export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

export interface MessageResponse {
  readonly message: string;
}

export interface UserEnvelopeResponse {
  readonly user: UserResponse;
}

export type EmptyResponse = Record<string, never>;
