import http from 'http';
import { createBackendApp } from '../barcode-automation-backend/src/app';

function makeRequest(options: http.RequestOptions, postData?: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTest() {
  console.log('--- 🧪 STARTING SUPER ADMIN & ADMIN PERMISSIONS AUTOMATED QA TEST ---');

  // Start in-process express server for fresh test isolation
  const app = createBackendApp();
  const testPort = 3099;
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(testPort, () => {
      console.log(`Test server running on port ${testPort}`);
      resolve();
    });
  });

  try {
    // Test 1: Super Admin Login
    console.log('\n[TEST 1] Logging in as Super Admin (superadmin@gmail.com)...');
    const loginRes1 = await makeRequest({
      hostname: 'localhost',
      port: testPort,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, { email: 'superadmin@gmail.com', password: 'superadmin@gmail.com' });

    console.log('Response Status:', loginRes1.status);
    console.log('Success:', loginRes1.body?.success);
    console.log('User Role:', loginRes1.body?.user?.role);
    if (loginRes1.status === 200 && loginRes1.body?.user?.role === 'Super Admin') {
      console.log('✅ TEST 1 PASSED: Super Admin authenticated successfully with master access.');
    } else {
      throw new Error(`TEST 1 FAILED: ${JSON.stringify(loginRes1.body)}`);
    }

    // Test 2: Register New Admin
    const testEmail = `admin_${Date.now()}@apex-pharma.com`;
    console.log(`\n[TEST 2] Registering new Admin (${testEmail})...`);
    const regRes = await makeRequest({
      hostname: 'localhost',
      port: testPort,
      path: '/api/auth/register',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, {
      name: 'Vikram Patel',
      email: testEmail,
      password: 'password123',
      department: 'Packaging & Serialization',
      role: 'Admin',
    });

    console.log('Registration Status:', regRes.status);
    console.log('User Status:', regRes.body?.user?.status);
    console.log('Is Approved:', regRes.body?.user?.isApproved);
    const newUserId = regRes.body?.user?.id;

    if (regRes.status === 201 && regRes.body?.user?.status === 'pending_approval' && regRes.body?.user?.isApproved === false) {
      console.log('✅ TEST 2 PASSED: Admin registered with status "pending_approval" (isApproved: false).');
    } else {
      throw new Error(`TEST 2 FAILED: ${JSON.stringify(regRes.body)}`);
    }

    // Test 3: Attempt Login with Unapproved Admin
    console.log('\n[TEST 3] Attempting login before Super Admin approval...');
    const blockedLogin = await makeRequest({
      hostname: 'localhost',
      port: testPort,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, { email: testEmail, password: 'password123' });

    console.log('Blocked Login Status:', blockedLogin.status);
    console.log('Blocked Message:', blockedLogin.body?.message);
    if (blockedLogin.status === 403 && blockedLogin.body?.pendingApproval) {
      console.log('✅ TEST 3 PASSED: System blocked unapproved Admin with 403 Forbidden ("pending approval").');
    } else {
      throw new Error(`TEST 3 FAILED: ${JSON.stringify(blockedLogin.body)}`);
    }

    // Test 4: Super Admin Approves Admin
    console.log(`\n[TEST 4] Super Admin approving user ${newUserId}...`);
    const approveRes = await makeRequest({
      hostname: 'localhost',
      port: testPort,
      path: `/api/users/${newUserId}/status`,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
    }, { status: 'approved', approvedBy: 'Super Administrator' });

    console.log('Approval Status:', approveRes.status);
    console.log('Updated User Status:', approveRes.body?.user?.status);
    console.log('Is Approved:', approveRes.body?.user?.isApproved);
    if (approveRes.status === 200 && approveRes.body?.user?.status === 'approved' && approveRes.body?.user?.isApproved === true) {
      console.log('✅ TEST 4 PASSED: Super Admin successfully approved Admin account.');
    } else {
      throw new Error(`TEST 4 FAILED: ${JSON.stringify(approveRes.body)}`);
    }

    // Test 5: Login Succeeds After Approval
    console.log('\n[TEST 5] Re-attempting login after Super Admin approval...');
    const approvedLogin = await makeRequest({
      hostname: 'localhost',
      port: testPort,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }, { email: testEmail, password: 'password123' });

    console.log('Login Status:', approvedLogin.status);
    console.log('User Name:', approvedLogin.body?.user?.name);
    if (approvedLogin.status === 200 && approvedLogin.body?.success) {
      console.log('✅ TEST 5 PASSED: Approved Admin logged in successfully.');
    } else {
      throw new Error(`TEST 5 FAILED: ${JSON.stringify(approvedLogin.body)}`);
    }

    // Test 6: Super Admin Configures Granular Permissions
    console.log(`\n[TEST 6] Super Admin configuring granular feature permissions for ${newUserId}...`);
    const permsPayload = {
      canDesignTemplates: true,
      canCreateTemplates: true,
      canDeleteTemplates: false,
      canApproveWorkflow: true,
      canPrintAndSpool: true,
      canManageDatasets: true,
      canCalibratePrinters: false,
      canManageLicense: false,
      canDownloadDesktopApp: true,
      canViewAuditLogs: false,
    };

    const permsRes = await makeRequest({
      hostname: 'localhost',
      port: testPort,
      path: `/api/users/${newUserId}/permissions`,
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
    }, { permissions: permsPayload, updatedBy: 'Super Administrator' });

    console.log('Permissions Update Status:', permsRes.status);
    console.log('Updated Permissions:', permsRes.body?.user?.permissions);
    if (
      permsRes.status === 200 &&
      permsRes.body?.user?.permissions?.canDeleteTemplates === false &&
      permsRes.body?.user?.permissions?.canCalibratePrinters === false
    ) {
      console.log('✅ TEST 6 PASSED: Granular permissions saved and verified.');
    } else {
      throw new Error(`TEST 6 FAILED: ${JSON.stringify(permsRes.body)}`);
    }

    console.log('\n🎉 ALL 6 SUPER ADMIN & RBAC WORKFLOW TESTS PASSED 100% PERFECTLY!\n');
  } finally {
    server.close();
  }
}

runTest().catch((err) => {
  console.error('Fatal Test Failure:', err);
  process.exit(1);
});
