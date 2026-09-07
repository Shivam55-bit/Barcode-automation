import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { DatabaseService } from '../db/databaseService';
import { logBackendAudit } from '../services/auditService';

export const apiTokensRouter = Router();

export interface ApiTokenRecord {
  id: string;
  name: string;
  tokenHash: string;
  prefix: string;
  role: string;
  scopes: string[];
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  isActive: boolean;
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Middleware: Validates X-API-Key or Authorization Bearer token
 */
export function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const apiKeyHeader = req.headers['x-api-key'] as string;

  let rawToken: string | undefined = apiKeyHeader;
  if (!rawToken && authHeader && authHeader.startsWith('Bearer ')) {
    rawToken = authHeader.slice(7).trim();
  }

  // If no token provided, continue (optional auth) or block if endpoint requires strict token
  if (!rawToken) {
    return next();
  }

  try {
    const db = DatabaseService.getInstance();
    const tokens = db.read<ApiTokenRecord>('api_tokens', []);
    const tokenH = hashToken(rawToken);

    const match = tokens.find((t) => t.tokenHash === tokenH && t.isActive);
    if (!match) {
      return res.status(401).json({ success: false, error: 'Invalid or revoked API Key' });
    }

    if (match.expiresAt && new Date(match.expiresAt).getTime() < Date.now()) {
      return res.status(401).json({ success: false, error: 'API Key has expired' });
    }

    // Update lastUsedAt
    match.lastUsedAt = new Date().toISOString();
    db.upsert('api_tokens', match);

    (req as any).apiUser = {
      tokenId: match.id,
      name: match.name,
      role: match.role,
      scopes: match.scopes,
    };

    next();
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * GET /api/api-tokens
 * List all generated API tokens (hashed for security)
 */
apiTokensRouter.get('/', (req: Request, res: Response) => {
  try {
    const db = DatabaseService.getInstance();
    const tokens = db.read<ApiTokenRecord>('api_tokens', []);
    // Do not return tokenHash in list response
    const safeTokens = tokens.map((t) => ({
      id: t.id,
      name: t.name,
      prefix: t.prefix,
      role: t.role,
      scopes: t.scopes,
      createdAt: t.createdAt,
      expiresAt: t.expiresAt,
      lastUsedAt: t.lastUsedAt,
      isActive: t.isActive,
    }));
    res.json({ success: true, tokens: safeTokens });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/api-tokens
 * Generate a new API token with scopes
 */
apiTokensRouter.post('/', (req: Request, res: Response) => {
  try {
    const { name, role = 'Operator', scopes = ['print', 'templates:read'], expiresInDays } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Token name is required' });
    }

    const rawSecret = `bf_${crypto.randomBytes(24).toString('hex')}`;
    const tokenHash = hashToken(rawSecret);
    const prefix = rawSecret.slice(0, 8) + '...';

    let expiresAt: string | null = null;
    if (expiresInDays && Number(expiresInDays) > 0) {
      expiresAt = new Date(Date.now() + Number(expiresInDays) * 86400000).toISOString();
    }

    const id = `tok-${Date.now()}`;
    const newRecord: ApiTokenRecord = {
      id,
      name: name.trim(),
      tokenHash,
      prefix,
      role,
      scopes,
      createdAt: new Date().toISOString(),
      expiresAt,
      lastUsedAt: null,
      isActive: true,
    };

    const db = DatabaseService.getInstance();
    db.upsert('api_tokens', newRecord);

    logBackendAudit(
      'System Admin',
      'Admin',
      'API_TOKEN_CREATED',
      `Generated API Token "${name}" with scopes [${scopes.join(', ')}]`,
      id,
      name
    );

    // Return the raw token ONCE only upon creation
    res.status(201).json({
      success: true,
      token: rawSecret,
      record: {
        id: newRecord.id,
        name: newRecord.name,
        prefix: newRecord.prefix,
        role: newRecord.role,
        scopes: newRecord.scopes,
        createdAt: newRecord.createdAt,
        expiresAt: newRecord.expiresAt,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/api-tokens/:id
 * Revoke an API token
 */
apiTokensRouter.delete('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const db = DatabaseService.getInstance();
    const tokens = db.read<ApiTokenRecord>('api_tokens', []);
    const match = tokens.find((t) => t.id === id);

    if (!match) {
      return res.status(404).json({ success: false, error: 'Token not found' });
    }

    match.isActive = false;
    db.upsert('api_tokens', match);

    logBackendAudit(
      'System Admin',
      'Admin',
      'API_TOKEN_REVOKED',
      `Revoked API Token "${match.name}" (${match.prefix})`,
      match.id,
      match.name
    );

    res.json({ success: true, message: `Token "${match.name}" revoked successfully` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
