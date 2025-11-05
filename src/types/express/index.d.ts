declare namespace Express {
  interface AuthenticatedUser {
    id: string;
    email: string;
    name: string;
    role: string;
  }

  interface Request {
    user?: AuthenticatedUser;
  }
}
