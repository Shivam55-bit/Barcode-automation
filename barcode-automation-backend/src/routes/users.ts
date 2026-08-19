import { Router, Request, Response } from 'express';
import { StorageService } from '../services/storageService';
import { logBackendAudit } from '../services/auditService';

export const usersRouter = Router();
const storage = StorageService.getInstance();

// GET /api/users
usersRouter.get('/', (req: Request, res: Response) => {
  const users = storage.read<any>('users', []);
  res.json(users);
});

// POST /api/auth/login
usersRouter.post('/login', (req: Request, res: Response) => {
  const { email } = req.body;
  const users = storage.read<any>('users', []);

  // Simple authentication lookup
  const user = users.find(
    (u) => u.email?.toLowerCase() === email?.toLowerCase()
  );

  if (user) {
    logBackendAudit(
      user.name,
      user.role,
      'USER_LOGIN',
      `User ${user.name} logged into BarcodeFlow Enterprise Studio`,
      user.id,
      user.name
    );
    return res.json({
      success: true,
      user,
      token: `token-${user.id}-${Date.now()}`,
    });
  }

  // If mock credentials or new user, authenticate with default profile
  const fallbackUser = users[0] || {
    id: `usr-${Date.now()}`,
    name: email?.split('@')[0] || 'Operator',
    email: email || 'user@example.com',
    role: 'Designer',
    department: 'Label Management',
  };

  logBackendAudit(
    fallbackUser.name,
    fallbackUser.role,
    'USER_LOGIN',
    `User ${fallbackUser.name} logged in`,
    fallbackUser.id,
    fallbackUser.name
  );

  res.json({
    success: true,
    user: fallbackUser,
    token: `token-${fallbackUser.id}-${Date.now()}`,
  });
});
