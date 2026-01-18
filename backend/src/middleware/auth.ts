import { Request, Response, NextFunction } from 'express';

/**
 * Verify Clerk authentication token from request header
 * Extracts clerkUserId from token and adds it to req
 * 
 * Note: This decodes the JWT token to extract the user ID.
 * For production, you may want to add proper JWT verification using Clerk's backend SDK.
 */
export interface AuthenticatedRequest extends Request {
  clerkUserId?: string;
}

export async function verifyClerkAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = authHeader.substring(7);

  try {
    // Decode JWT token to extract user ID
    // Note: In production, you should verify the token signature using Clerk's backend SDK
    const parts = token.split('.');
    if (parts.length !== 3) {
      res.status(401).json({ error: 'Invalid token format' });
      return;
    }

    // Decode the payload (second part of JWT)
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    const clerkUserId = payload.sub;

    if (!clerkUserId) {
      res.status(401).json({ error: 'Invalid token: missing user ID' });
      return;
    }

    // Verify token is from Clerk (check issuer)
    if (payload.iss && !payload.iss.includes('clerk')) {
      console.warn('Token issuer is not Clerk:', payload.iss);
      // Still allow it for development, but log a warning
    }

    req.clerkUserId = clerkUserId;
    next();
  } catch (error) {
    console.error('Error decoding token:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
}
