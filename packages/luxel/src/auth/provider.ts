export type AuthCredentials = {
  email: string;
  password: string;
};

export interface AuthProvider {
  authenticate(credentials: AuthCredentials): Promise<{ userId: string } | null>;
}

/** Dev-only fixed credentials for integration tests. */
export class DevCredentialsProvider implements AuthProvider {
  constructor(
    private readonly email = "dev@luxel.local",
    private readonly password = "luxel-dev",
    private readonly userId = "dev-user",
  ) {}

  async authenticate(credentials: AuthCredentials): Promise<{ userId: string } | null> {
    if (credentials.email === this.email && credentials.password === this.password) {
      return { userId: this.userId };
    }
    return null;
  }
}
