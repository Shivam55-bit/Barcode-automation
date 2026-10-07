import { Router, Request, Response } from 'express';
import { StorageService } from '../services/storageService';
import { logBackendAudit } from '../services/auditService';
import { INITIAL_USERS } from '../../../src/services/mockDataService';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export const usersRouter = Router();
const storage = StorageService.getInstance();

export function getUsers(): any[] {
  return storage.read<any>('users', process.env.BARCODEFLOW_DESKTOP === '1' ? [] : INITIAL_USERS);
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  return `scrypt$${salt}$${scryptSync(password, salt, 64).toString('hex')}`;
}

function verifyPassword(user: any, password: string): boolean {
  if (typeof user.passwordHash === 'string') {
    const match = /^scrypt\$([a-f0-9]{32})\$([a-f0-9]{128})$/.exec(user.passwordHash);
    return !!match && timingSafeEqual(scryptSync(password, match[1], 64), Buffer.from(match[2], 'hex'));
  }
  if (typeof user.password !== 'string' || !user.password) return false;
  const stored = Buffer.from(user.password, 'utf8');
  const supplied = Buffer.from(password, 'utf8');
  return stored.length === supplied.length && timingSafeEqual(stored, supplied);
}

function canInitializeLegacyPassword(user: any): boolean {
  return user.password === undefined && user.passwordHash === undefined &&
    user.isApproved !== false && !['pending_approval', 'suspended', 'rejected'].includes(user.status);
}

export function getLegacyPasswordAccounts(): Array<{ email: string; name: string }> {
  if (process.env.BARCODEFLOW_DESKTOP !== '1') return [];
  return getUsers().filter(canInitializeLegacyPassword).map(user => ({ email: user.email, name: user.name }));
}

export function initializeLegacyPassword(email: string, password: string): void {
  if (process.env.BARCODEFLOW_DESKTOP !== '1') throw new Error('Password setup requires the local desktop application.');
  if (typeof email !== 'string' || typeof password !== 'string' || password.length < 12 || password.length > 1024) {
    throw new Error('Password must contain between 12 and 1024 characters.');
  }
  const users = getUsers();
  const matchingUsers = users.filter(user => user.email?.toLowerCase() === email.trim().toLowerCase());
  if (matchingUsers.length !== 1 || !canInitializeLegacyPassword(matchingUsers[0])) {
    throw new Error('This account is not eligible for initial password setup.');
  }
  const user = matchingUsers[0];
  user.passwordHash = hashPassword(password);
  if (!storage.write('users', users)) throw new Error('Password could not be saved.');
  logBackendAudit('Local desktop owner', user.role || 'Admin', 'LEGACY_PASSWORD_SETUP',
    `Initial password set for legacy account ${user.email}`, user.id, user.name);
}

// Handler: List users
const handleListUsers = (req: Request, res: Response) => {
  try {
    const users = getUsers();
    const sanitized = users.map((u: any) => {
      const { password, passwordHash, ...rest } = u;
      return rest;
    });
    res.json(sanitized);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

// Handler: Login
const handleLogin = (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const cleanPassword = typeof password === 'string' ? password : '';

    if (!cleanEmail || !cleanPassword || cleanPassword.length > 1024) {
      return res.status(400).json({ success: false, message: 'Email address and password are required.' });
    }

    const users = getUsers();

    const user = users.find((u: any) => u.email?.toLowerCase() === cleanEmail);
    if (!user || !verifyPassword(user, cleanPassword)) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email address or password.',
      });
    }

    // 3. Super Admin Approval Verification
    if (user.status === 'pending_approval' || user.isApproved === false) {
      return res.status(403).json({
        success: false,
        message:
          'Your Admin registration is pending approval by the Super Admin. Please contact superadmin@gmail.com for activation.',
        pendingApproval: true,
      });
    }

    if (user.status === 'suspended' || user.status === 'rejected') {
      return res.status(403).json({
        success: false,
        message: 'Your Admin account has been suspended or rejected by the Super Administrator.',
        suspended: true,
      });
    }

    if (!user.passwordHash) {
      user.passwordHash = hashPassword(cleanPassword);
      delete user.password;
      storage.write('users', users);
    }
    logBackendAudit(
      user.name,
      user.role || 'Admin',
      'USER_LOGIN',
      `User ${user.name} (${user.role || 'Admin'}) logged in successfully`,
      user.id,
      user.name
    );

    const { password: omittedPassword, passwordHash: omittedPasswordHash, ...safeUser } = user;
    return res.json({
      success: true,
      user: safeUser,
      token: `token-${user.id}-${Date.now()}`,
      message: `Welcome back, ${user.name}!`,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Handler: Register
const handleRegister = (req: Request, res: Response) => {
  try {
    const { name, email, password, department, role = 'Admin' } = req.body;
    const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (!cleanEmail || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Name and email are required.' });
    }
    if (typeof password !== 'string' || password.length < 12 || password.length > 1024) {
      return res.status(400).json({ success: false, message: 'Password must contain between 12 and 1024 characters.' });
    }

    const users = getUsers();
    const initializing = users.length === 0;

    // Check if email already exists
    const existing = users.find((u: any) => u.email?.toLowerCase() === cleanEmail);
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email address already exists.',
      });
    }

    // Create new Admin record with pending approval status
    const newUser: any = {
      id: `usr-admin-${Date.now()}`,
      name: name.trim(),
      email: cleanEmail,
      passwordHash: hashPassword(password),
      role: initializing ? 'Super Admin' : 'Admin',
      department: department?.trim() || 'Packaging Operations',
      avatar: `https://images.unsplash.com/photo-${1534528741775 + (users.length % 1000)}?w=100&h=100&fit=crop&crop=faces`,
      status: initializing ? 'approved' : 'pending_approval',
      isApproved: initializing,
      createdAt: new Date().toISOString(),
      permissions: {
        canDesignTemplates: true,
        canCreateTemplates: true,
        canDeleteTemplates: initializing,
        canApproveWorkflow: true,
        canPrintAndSpool: true,
        canManageDatasets: true,
        canCalibratePrinters: initializing,
        canManageLicense: initializing,
        canDownloadDesktopApp: true,
        canViewAuditLogs: true,
      },
    };

    users.push(newUser);
    storage.write('users', users);

    logBackendAudit(
      newUser.name,
      'Admin Registration',
      'USER_REGISTER',
      `New Admin registration submitted for ${newUser.name} (${newUser.email}). Pending Super Admin approval.`,
      newUser.id,
      newUser.name
    );

    const { password: omittedPassword, passwordHash: omittedPasswordHash, ...safeUser } = newUser;

    res.status(201).json({
      success: true,
      message: initializing
        ? 'Initial administrator created. Sign in with your chosen credentials.'
        : 'Admin registration submitted. An existing administrator must approve the account before sign-in.',
      user: safeUser,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Route Definitions & Aliases
usersRouter.get('/', handleListUsers);
usersRouter.get('/list', handleListUsers);

usersRouter.post('/login', handleLogin);
usersRouter.post('/auth/login', handleLogin);

usersRouter.post('/register', handleRegister);
usersRouter.post('/auth/register', handleRegister);

// Status update
usersRouter.patch('/:id/status', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, approvedBy = 'Super Administrator' } = req.body;

    if (!['approved', 'rejected', 'suspended', 'pending_approval'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value.' });
    }

    const users = getUsers();
    const userIndex = users.findIndex((u: any) => u.id === id);

    if (userIndex === -1) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (users[userIndex].email?.toLowerCase() === 'superadmin@gmail.com') {
      return res.status(403).json({ success: false, message: 'Cannot modify Super Administrator status.' });
    }

    users[userIndex].status = status;
    users[userIndex].isApproved = status === 'approved';
    if (status === 'approved') {
      users[userIndex].approvedAt = new Date().toISOString();
      users[userIndex].approvedBy = approvedBy;
    }

    storage.write('users', users);

    logBackendAudit(
      approvedBy,
      'Super Admin',
      'ADMIN_STATUS_UPDATE',
      `Super Admin updated status for ${users[userIndex].name} (${users[userIndex].email}) to ${status.toUpperCase()}`,
      id,
      users[userIndex].name
    );

    const { password: omittedPassword, passwordHash: omittedPasswordHash, ...safeUser } = users[userIndex];
    res.json({
      success: true,
      message: `Admin ${users[userIndex].name} status updated to ${status.toUpperCase()}`,
      user: safeUser,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update permissions
usersRouter.put('/:id/permissions', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { permissions, updatedBy = 'Super Administrator' } = req.body;

    if (!permissions || typeof permissions !== 'object') {
      return res.status(400).json({ success: false, message: 'Invalid permissions payload.' });
    }

    const users = getUsers();
    const userIndex = users.findIndex((u: any) => u.id === id);

    if (userIndex === -1) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (users[userIndex].email?.toLowerCase() === 'superadmin@gmail.com') {
      return res.status(403).json({ success: false, message: 'Cannot modify Super Administrator permissions.' });
    }

    users[userIndex].permissions = {
      ...users[userIndex].permissions,
      ...permissions,
    };

    storage.write('users', users);

    logBackendAudit(
      updatedBy,
      'Super Admin',
      'PERMISSIONS_UPDATE',
      `Super Admin updated feature permissions for ${users[userIndex].name} (${users[userIndex].email})`,
      id,
      users[userIndex].name
    );

    const { password: omittedPassword, passwordHash: omittedPasswordHash, ...safeUser } = users[userIndex];
    res.json({
      success: true,
      message: `Permissions updated successfully for ${safeUser.name}`,
      user: safeUser,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Edit profile
usersRouter.put('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, email, role, department, password, status, permissions } = req.body;
    if (password !== undefined && (typeof password !== 'string' || password.length < 12 || password.length > 1024)) {
      return res.status(400).json({ success: false, message: 'Password must contain between 12 and 1024 characters.' });
    }

    const users = getUsers();
    const userIndex = users.findIndex((u: any) => u.id === id);

    if (userIndex === -1) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const isSuper = users[userIndex].email?.toLowerCase() === 'superadmin@gmail.com';

    if (name) users[userIndex].name = name.trim();
    if (email && !isSuper) users[userIndex].email = email.trim().toLowerCase();
    if (role && !isSuper) users[userIndex].role = role;
    if (department) users[userIndex].department = department.trim();
    if (password !== undefined) {
      users[userIndex].passwordHash = hashPassword(password);
      delete users[userIndex].password;
    }
    if (status && !isSuper) {
      users[userIndex].status = status;
      users[userIndex].isApproved = status === 'approved';
    }
    if (permissions && typeof permissions === 'object') {
      users[userIndex].permissions = { ...users[userIndex].permissions, ...permissions };
    }

    storage.write('users', users);

    logBackendAudit(
      'Super Administrator',
      'Super Admin',
      'USER_UPDATE',
      `Super Admin updated profile details for ${users[userIndex].name} (${users[userIndex].email})`,
      id,
      users[userIndex].name
    );

    const { password: omittedPassword, passwordHash: omittedPasswordHash, ...safeUser } = users[userIndex];
    res.json({
      success: true,
      message: `Account details updated for ${safeUser.name}`,
      user: safeUser,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete user
usersRouter.delete('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const users = getUsers();
    const target = users.find((u: any) => u.id === id);

    if (!target) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    if (target.email?.toLowerCase() === 'superadmin@gmail.com') {
      return res.status(403).json({ success: false, message: 'Cannot delete Super Administrator.' });
    }

    const filtered = users.filter((u: any) => u.id !== id);
    storage.write('users', filtered);

    logBackendAudit(
      'Super Administrator',
      'Super Admin',
      'USER_DELETE',
      `Super Admin deleted user ${target.name} (${target.email})`,
      id,
      target.name
    );

    res.json({ success: true, message: `User ${target.name} deleted successfully.` });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});
