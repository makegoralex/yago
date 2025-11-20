declare namespace Express {
  interface AuthenticatedUser {
    id: string;
    email: string;
    name: string;
    role: string;
    organizationId?: string;
  }

  interface OrganizationContext {
    id: string;
  }

  interface Request {
    user?: AuthenticatedUser;
    organization?: OrganizationContext;
  }
}
