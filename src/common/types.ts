import { Request } from 'express';

export interface AuthenticatedUser {
  id: string;
  email: string;
  organisationId: string;
  role: string;
  permissions: string[];
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}
