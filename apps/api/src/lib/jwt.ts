import jwt from 'jsonwebtoken';

export interface JwtConfig {
  secret: string;
  algorithm: jwt.Algorithm;
  issuer: string;
  audience: string;
  expiresIn: string;
}

function getJwtConfig(): JwtConfig {
  const secret = process.env['JWT_SECRET'];
  if (!secret || secret === 'change-me') {
    if (process.env['NODE_ENV'] === 'production') {
      throw new Error('JWT_SECRET must be set to a secure value in production');
    }
    console.warn('WARNING: Using default JWT_SECRET. Set JWT_SECRET env var for production.');
  }

  return {
    secret: secret || 'change-me-dev-only',
    algorithm: 'HS256',
    issuer: 'cdi-api',
    audience: 'cdi-web',
    expiresIn: process.env['JWT_EXPIRY'] || '8h',
  };
}

export const jwtConfig = getJwtConfig();

export interface AuthTokenPayload {
  userId: string;
  email: string;
  role: string;
  organizationId: string;
}

export function signToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, jwtConfig.secret, {
    algorithm: jwtConfig.algorithm,
    issuer: jwtConfig.issuer,
    audience: jwtConfig.audience,
    expiresIn: jwtConfig.expiresIn as jwt.SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): AuthTokenPayload {
  return jwt.verify(token, jwtConfig.secret, {
    algorithms: [jwtConfig.algorithm],
    issuer: jwtConfig.issuer,
    audience: jwtConfig.audience,
  }) as AuthTokenPayload;
}
