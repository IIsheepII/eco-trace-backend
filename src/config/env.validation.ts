export interface EnvironmentVariables {
  NODE_ENV: string;
  PORT: number;
  DATABASE_URL: string;
  ACCESS_TOKEN_SECRET: string;
  REFRESH_TOKEN_SECRET: string;
  ACCESS_TOKEN_TTL: string;
  REFRESH_TOKEN_TTL: string;
  CORS_ORIGIN: string;
  UPLOAD_DIR: string;
  MAX_FILE_SIZE_MB: number;
}

export function envValidation(config: Record<string, unknown>): EnvironmentVariables {
  const required = ['DATABASE_URL', 'ACCESS_TOKEN_SECRET', 'REFRESH_TOKEN_SECRET'];
  for (const key of required) {
    if (!config[key]) {
      throw new Error(`Missing required environment variable ${key}`);
    }
  }

  return {
    NODE_ENV: String(config.NODE_ENV ?? 'development'),
    PORT: Number(config.PORT ?? 3000),
    DATABASE_URL: String(config.DATABASE_URL),
    ACCESS_TOKEN_SECRET: String(config.ACCESS_TOKEN_SECRET),
    REFRESH_TOKEN_SECRET: String(config.REFRESH_TOKEN_SECRET),
    ACCESS_TOKEN_TTL: String(config.ACCESS_TOKEN_TTL ?? '15m'),
    REFRESH_TOKEN_TTL: String(config.REFRESH_TOKEN_TTL ?? '7d'),
    CORS_ORIGIN: String(config.CORS_ORIGIN ?? 'http://localhost:3001'),
    UPLOAD_DIR: String(config.UPLOAD_DIR ?? './uploads'),
    MAX_FILE_SIZE_MB: Number(config.MAX_FILE_SIZE_MB ?? 20),
  };
}
