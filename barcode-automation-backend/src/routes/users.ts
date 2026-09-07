import { Router, Request, Response } from 'express';
import { StorageService } from '../services/storageService';
import { logBackendAudit } from '../services/auditService';
import { INITIAL_USERS } from '../../../src/services/mockDataService';

export const usersRouter = Router();
const storage = StorageService.getInstance();

export function getUsers(): any[] {
  const list = storage.read<any>('users', INITIAL_USERS);
  // Ensure Super Admin always exists
  const hasSuperAdmin = list.some((u: any) => u.email?.toLowerCase() === 'superadmin@gmail.com');
  if (!hasSuperAdmin) {
    const superAdmin = INITIAL_USERS.find((u: any) => u.email?.toLowerCase() === 'superadmin@gmail.com') || {
      id: 'usr-super-admin',
      name: 'Super Administrator',
      email: 'superadmin@gmail.com',
      password: 'superadmin@gmail.com',
      role: 'Super Admin',
      department: 'Enterprise Security & Governance',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces',
      status: 'approved',
      isApproved: true,
      createdAt: '2026-08-01T00:00:00Z',
      permissions: {
        canDesignTemplates: true,
        canCreateTemplates: true,
        canDeleteTemplates: true,
        canApproveWorkflow: true,
        canPrintAndSpool: true,
        canManageDatasets: true,
        canCalibratePrinters: true,
        canManageLicense: true,
        canDownloadDesktopApp: true,
        canViewAuditLogs: true,
      },
    };
    list.unshift(superAdmin);
    storage.write('users', list);
  }
  return list;
}

// Handler: List users
const handleListUsers = (req: Request, res: Response) => {
  try {
    const users = getUsers();
    const sanitized = users.map((u: any) => {
      const { password, ...rest } = u;
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
    const cleanEmail = email?.trim().toLowerCase();
    const cleanPassword = password?.trim();

    if (!cleanEmail) {
      return res.status(400).json({ success: false, message: 'Email address is required.' });
    }

    const users = getUsers();

    // 1. Super Admin Hardened Check
    if (cleanEmail === 'superadmin@gmail.com') {
      if (cleanPassword && cleanPassword !== 'superadmin@gmail.com') {
        return res.status(401).json({
          success: false,
          message: 'Invalid Super Admin credentials. Password must match superadmin@gmail.com.',
        });
      }

      const superAdmin = users.find((u: any) => u.email?.toLowerCase() === 'superadmin@gmail.com') || {
        id: 'usr-super-admin',
        name: 'Super Administrator',
        email: 'superadmin@gmail.com',
        role: 'Super Admin',
        department: 'Enterprise Security & Governance',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop&crop=faces',
        status: 'approved',
        isApproved: true,
        permissions: {
          canDesignTemplates: true,
          canCreateTemplates: true,
          canDeleteTemplates: true,
          canApproveWorkflow: true,
          canPrintAndSpool: true,
          canManageDatasets: true,
          canCalibratePrinters: true,
          canManageLicense: true,
          canDownloadDesktopApp: true,
          canViewAuditLogs: true,
        },
      };

      logBackendAudit(
        superAdmin.name,
        'Super Admin',
        'USER_LOGIN',
        `Super Administrator logged into BarcodeFlow Enterprise Security Console`,
        superAdmin.id,
        superAdmin.name
      );

      const { password: _, ...safeUser } = superAdmin;
      return res.json({
        success: true,
        user: safeUser,
        token: `token-super-admin-${Date.now()}`,
        message: 'Welcome Super Administrator! Full system governance granted.',
      });
    }

    // 2. Lookup standard User / Admin
    let user = users.find((u: any) => u.email?.toLowerCase() === cleanEmail);

    if (!user) {
      const demoUser = INITIAL_USERS.find((u: any) => u.email?.toLowerCase() === cleanEmail);
      if (demoUser) {
        user = demoUser;
      } else {
        return res.status(401).json({
          success: false,
          message: 'User account not found. Please register or check your email.',
        });
      }
    }

    // Verify Password
    if (user.password && cleanPassword && user.password !== cleanPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid password. Please check your credentials.',
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

    // Authenticated successfully
    logBackendAudit(
      user.name,
      user.role || 'Admin',
      'USER_LOGIN',
      `User ${user.name} (${user.role || 'Admin'}) logged in successfully`,
      user.id,
      user.name
    );

    const { password: _, ...safeUser } = user;
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
    const cleanEmail = email?.trim().toLowerCase();

    if (!cleanEmail || !name) {
      return res.status(400).json({ success: false, message: 'Name and email are required.' });
    }

    const users = getUsers();

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
      password: password?.trim() || 'password123',
      role: 'Admin',
      department: department?.trim() || 'Packaging Operations',
      avatar: `https://images.unsplash.com/photo-${1534528741775 + (users.length % 1000)}?w=100&h=100&fit=crop&crop=faces`,
      status: 'pending_approval',
      isApproved: false,
      createdAt: new Date().toISOString(),
      permissions: {
        canDesignTemplates: true,
        canCreateTemplates: true,
        canDeleteTemplates: false,
        canApproveWorkflow: true,
        canPrintAndSpool: true,
        canManageDatasets: true,
        canCalibratePrinters: false,
        canManageLicense: false,
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

    const { password: _, ...safeUser } = newUser;

    res.status(201).json({
      success: true,
      message:
        'Admin registration submitted successfully! Your account is now pending approval by the Super Admin (superadmin@gmail.com). You will be able to log in once approved.',
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

    const { password: _, ...safeUser } = users[userIndex];
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

    const { password: _, ...safeUser } = users[userIndex];
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
    if (password) users[userIndex].password = password.trim();
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

    const { password: _, ...safeUser } = users[userIndex];
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
