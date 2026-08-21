import { Router, Request, Response } from 'express';
import { StorageService } from '../services/storageService';
import { logBackendAudit } from '../services/auditService';

export const templatesRouter = Router();
const storage = StorageService.getInstance();

// Helper to calculate version bump e.g. "1.0" -> "1.1"
function bumpMinorVersion(version: string = '1.0'): string {
  const parts = version.split('.');
  if (parts.length >= 2) {
    const major = parseInt(parts[0], 10) || 1;
    const minor = parseInt(parts[1], 10) || 0;
    return `${major}.${minor + 1}`;
  }
  return `${version}.1`;
}

// GET /api/templates
templatesRouter.get('/', (req: Request, res: Response) => {
  const { category, search, status } = req.query;
  let templates = storage.read<any>('templates', []);

  if (category && category !== 'all') {
    templates = templates.filter(
      (t) => t.category && t.category.toLowerCase() === (category as string).toLowerCase()
    );
  }
  if (status && status !== 'all') {
    templates = templates.filter((t) => t.status === status);
  }
  if (search) {
    const q = (search as string).toLowerCase();
    templates = templates.filter(
      (t) =>
        t.name?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.tags?.some((tag: string) => tag.toLowerCase().includes(q))
    );
  }

  res.json(templates);
});

// GET /api/templates/:id
templatesRouter.get('/:id', (req: Request, res: Response) => {
  const templates = storage.read<any>('templates', []);
  const template = templates.find((t) => t.id === req.params.id);
  if (!template) {
    return res.status(404).json({ error: 'Template not found' });
  }
  res.json(template);
});

// POST /api/templates (Create/Save)
templatesRouter.post('/', (req: Request, res: Response) => {
  const templates = storage.read<any>('templates', []);
  const newTemplate = req.body;

  if (!newTemplate.id) {
    newTemplate.id = `tmpl-${Date.now()}`;
  }
  newTemplate.createdAt = newTemplate.createdAt || new Date().toISOString();
  newTemplate.updatedAt = new Date().toISOString();
  newTemplate.status = newTemplate.status || 'draft';

  // Check if template with this ID already exists -> update it
  const existingIndex = templates.findIndex((t) => t.id === newTemplate.id);
  if (existingIndex >= 0) {
    const existing = templates[existingIndex];

    // VERSION FREEZE CHECK:
    // If the template is submitted or approved and the user modifies elements/layout,
    // automatically branch a new Draft version (e.g. v1.1 Draft) while the frozen version stays intact
    const isFrozen = existing.status === 'pending_level_1' || existing.status === 'pending_level_2' || existing.status === 'approved';
    const isLayoutModified = JSON.stringify(existing.elements) !== JSON.stringify(newTemplate.elements);

    if (isFrozen && isLayoutModified && newTemplate.status === 'draft') {
      const branchedVersion = bumpMinorVersion(existing.version);
      const branchedTemplate = {
        ...newTemplate,
        version: branchedVersion,
        status: 'draft',
        updatedAt: new Date().toISOString(),
        tags: Array.from(new Set([...(newTemplate.tags || []), 'Draft Revision'])),
      };

      templates[existingIndex] = branchedTemplate;
      storage.write('templates', templates);

      logBackendAudit(
        req.body.modifiedBy || 'Designer',
        'Label Designer',
        'EDIT_TEMPLATE',
        `Auto-branched template "${branchedTemplate.name}" to Draft Version v${branchedVersion} (Frozen v${existing.version} continues in approval)`,
        branchedTemplate.id,
        branchedTemplate.name
      );

      return res.json({
        ...branchedTemplate,
        _versionBranched: true,
        _previousFrozenVersion: existing.version,
      });
    }

    templates[existingIndex] = {
      ...templates[existingIndex],
      ...newTemplate,
      updatedAt: new Date().toISOString(),
    };
    storage.write('templates', templates);
    logBackendAudit(
      req.body.modifiedBy || 'Designer',
      'Label Designer',
      'EDIT_TEMPLATE',
      `Updated template "${newTemplate.name}" (v${newTemplate.version || '1.0'})`,
      newTemplate.id,
      newTemplate.name
    );
    return res.json(templates[existingIndex]);
  }

  templates.unshift(newTemplate);
  storage.write('templates', templates);

  logBackendAudit(
    req.body.createdBy || 'Designer',
    'Label Designer',
    'CREATE_TEMPLATE',
    `Created new label template "${newTemplate.name}" (v${newTemplate.version || '1.0'})`,
    newTemplate.id,
    newTemplate.name
  );

  res.status(201).json(newTemplate);
});

// PUT /api/templates/:id (Update)
templatesRouter.put('/:id', (req: Request, res: Response) => {
  const templates = storage.read<any>('templates', []);
  const index = templates.findIndex((t) => t.id === req.params.id);

  if (index === -1) {
    const newTemplate = {
      ...req.body,
      id: req.params.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    templates.unshift(newTemplate);
    storage.write('templates', templates);
    return res.status(201).json(newTemplate);
  }

  const existing = templates[index];
  const isFrozen = existing.status === 'pending_level_1' || existing.status === 'pending_level_2' || existing.status === 'approved';
  const isLayoutModified = JSON.stringify(existing.elements) !== JSON.stringify(req.body.elements);

  if (isFrozen && isLayoutModified && req.body.status === 'draft') {
    const branchedVersion = bumpMinorVersion(existing.version);
    const branchedTemplate = {
      ...req.body,
      id: req.params.id,
      version: branchedVersion,
      status: 'draft',
      updatedAt: new Date().toISOString(),
      tags: Array.from(new Set([...(req.body.tags || []), 'Draft Revision'])),
    };

    templates[index] = branchedTemplate;
    storage.write('templates', templates);

    logBackendAudit(
      req.body.modifiedBy || 'Designer',
      'Label Designer',
      'EDIT_TEMPLATE',
      `Auto-branched template "${branchedTemplate.name}" to Draft Version v${branchedVersion} (Frozen v${existing.version} snapshot preserved)`,
      branchedTemplate.id,
      branchedTemplate.name
    );

    return res.json({
      ...branchedTemplate,
      _versionBranched: true,
      _previousFrozenVersion: existing.version,
    });
  }

  const updated = {
    ...templates[index],
    ...req.body,
    updatedAt: new Date().toISOString(),
  };

  templates[index] = updated;
  storage.write('templates', templates);

  logBackendAudit(
    req.body.modifiedBy || 'Designer',
    'Label Designer',
    'EDIT_TEMPLATE',
    `Updated label template "${updated.name}" (${updated.elements?.length || 0} elements)`,
    updated.id,
    updated.name
  );

  res.json(updated);
});

// ==========================================
// ENTERPRISE APPROVAL & VERSION FREEZE REST API
// ==========================================

// POST /api/templates/submit (Submit for Approval & Create Immutable Snapshot)
templatesRouter.post('/submit', (req: Request, res: Response) => {
  const { templateId, submittedBy = 'Designer', comments = '', snapshot } = req.body;
  const templates = storage.read<any>('templates', []);
  const templateVersions = storage.read<any>('templateVersions', []);
  const templateIndex = templates.findIndex((t) => t.id === templateId);

  if (templateIndex === -1 && !snapshot) {
    return res.status(404).json({ error: 'Template not found for submission' });
  }

  const targetTemplate = templateIndex >= 0 ? templates[templateIndex] : snapshot.snapshotJson;
  const currentVersion = targetTemplate.version || '1.0';

  // Build full snapshot record
  const snapshotRecord = snapshot || {
    id: `snap-${targetTemplate.id}-v${currentVersion}-${Date.now()}`,
    version: currentVersion,
    templateId: targetTemplate.id,
    templateName: targetTemplate.name,
    snapshotJson: JSON.parse(JSON.stringify(targetTemplate)),
    canvasJson: {
      dimensions: targetTemplate.dimensions,
      margins: targetTemplate.margins,
      sheetGrid: targetTemplate.sheetGrid,
      scaleDpi: targetTemplate.dimensions?.dpi || 300,
      elementCount: targetTemplate.elements?.length || 0,
    },
    svgSnapshot: '',
    pngSnapshot: '',
    objectTree: (targetTemplate.elements || []).map((el: any) => ({
      id: el.id,
      name: el.name,
      type: el.type,
      locked: !!el.locked,
      editable: el.locked ? false : el.editable !== undefined ? el.editable : true,
    })),
    objectProperties: {},
    variableMapping: {},
    hash: `sha256-${Date.now()}`,
    checksum: `CRC32-${Date.now()}`,
    status: 'pending_level_1',
    submittedBy,
    submittedAt: new Date().toISOString(),
    approvalTimeline: [
      { id: `apr-1`, level: 1, role: 'Approver Level 1', status: 'pending' },
      { id: `apr-2`, level: 2, role: 'Approver Level 2', status: 'pending' },
    ],
    annotations: [],
    comments: [
      {
        id: `cm-${Date.now()}`,
        author: submittedBy,
        authorRole: 'Label Designer',
        content: comments || 'Submitted for Regulatory Review',
        createdAt: new Date().toISOString(),
        statusChange: 'pending_level_1',
      },
    ],
  };

  snapshotRecord.status = 'pending_level_1';
  snapshotRecord.submittedAt = new Date().toISOString();

  // Save immutable snapshot to templateVersions
  templateVersions.unshift(snapshotRecord);
  storage.write('templateVersions', templateVersions);

  // Freeze status in active template list
  if (templateIndex >= 0) {
    templates[templateIndex].status = 'pending_level_1';
    templates[templateIndex].updatedAt = new Date().toISOString();
    templates[templateIndex].versions = templates[templateIndex].versions || [];
    templates[templateIndex].versions.unshift({
      version: currentVersion,
      timestamp: new Date().toISOString(),
      author: submittedBy,
      comment: comments || 'Submitted for Regulatory Review',
      elementCount: templates[templateIndex].elements?.length || 0,
      templateSnapshot: templates[templateIndex],
    });
    storage.write('templates', templates);
  }

  logBackendAudit(
    submittedBy,
    'Label Designer',
    'SUBMIT_APPROVAL',
    `Submitted template "${targetTemplate.name}" (v${currentVersion}) for QA Approval. Version frozen with SHA-256 Hash.`,
    targetTemplate.id,
    targetTemplate.name
  );

  res.status(201).json({
    success: true,
    version: currentVersion,
    snapshot: snapshotRecord,
    template: templateIndex >= 0 ? templates[templateIndex] : targetTemplate,
  });
});

// POST /api/templates/approve (Approve Level 1 / Level 2 with e-Signature)
templatesRouter.post('/approve', (req: Request, res: Response) => {
  const { templateId, version, level = 1, reviewerName = 'Quality Lead', reviewerEmail, digitalSignature, comment = '' } = req.body;
  const templates = storage.read<any>('templates', []);
  const templateVersions = storage.read<any>('templateVersions', []);
  const approvals = storage.read<any>('approvals', []);

  const templateIndex = templates.findIndex((t) => t.id === templateId);
  const versionRecord = templateVersions.find((v: any) => v.templateId === templateId && (!version || v.version === version));

  // If approving level 1 and template requires level 2: move to pending_level_2, else approved
  const isFinalApproval = Number(level) === 2 || req.body.isFinal === true;
  const newStatus = isFinalApproval ? 'approved' : 'pending_level_2';

  const approvalRecord = {
    id: `apr-rec-${Date.now()}`,
    templateId,
    version: version || templateIndex >= 0 ? templates[templateIndex]?.version : '1.0',
    level,
    action: 'approve',
    reviewerName,
    reviewerEmail,
    digitalSignature: digitalSignature || `${reviewerName} (${new Date().toISOString()})`,
    comment,
    timestamp: new Date().toISOString(),
    status: newStatus,
  };

  approvals.unshift(approvalRecord);
  storage.write('approvals', approvals);

  // Update snapshot timeline if snapshot exists
  if (versionRecord) {
    versionRecord.status = newStatus;
    if (newStatus === 'approved') {
      versionRecord.approvedBy = reviewerName;
      versionRecord.approvedAt = new Date().toISOString();
    }
    versionRecord.approvalTimeline = versionRecord.approvalTimeline || [];
    const tier = versionRecord.approvalTimeline.find((t: any) => t.level === Number(level));
    if (tier) {
      tier.status = 'approved';
      tier.reviewerName = reviewerName;
      tier.reviewerEmail = reviewerEmail;
      tier.timestamp = new Date().toISOString();
      tier.digitalSignature = digitalSignature;
      tier.comment = comment;
    }
    if (comment) {
      versionRecord.comments = versionRecord.comments || [];
      versionRecord.comments.push({
        id: `cm-${Date.now()}`,
        author: reviewerName,
        authorRole: `Approver Level ${level}`,
        content: comment,
        createdAt: new Date().toISOString(),
        statusChange: newStatus,
      });
    }
    storage.write('templateVersions', templateVersions);
  }

  // Update active template status
  if (templateIndex >= 0) {
    templates[templateIndex].status = newStatus;
    templates[templateIndex].updatedAt = new Date().toISOString();
    if (newStatus === 'approved') {
      templates[templateIndex].approvedBy = reviewerName;
      templates[templateIndex].approvedAt = new Date().toISOString();
    }
    storage.write('templates', templates);
  }

  logBackendAudit(
    reviewerName,
    `Approver Level ${level}`,
    'APPROVE_TEMPLATE',
    `Approved Template "${templateIndex >= 0 ? templates[templateIndex].name : templateId}" at Level ${level}. Signed: ${digitalSignature || reviewerName}. New Status: ${newStatus.toUpperCase()}`,
    templateId,
    templateIndex >= 0 ? templates[templateIndex].name : templateId
  );

  res.json({
    success: true,
    status: newStatus,
    approvalRecord,
    snapshot: versionRecord,
    template: templateIndex >= 0 ? templates[templateIndex] : null,
  });
});

// POST /api/templates/reject (Reject Submission)
templatesRouter.post('/reject', (req: Request, res: Response) => {
  const { templateId, version, reviewerName = 'Quality Reviewer', reason = 'Quality rejection' } = req.body;
  const templates = storage.read<any>('templates', []);
  const templateVersions = storage.read<any>('templateVersions', []);
  const approvals = storage.read<any>('approvals', []);

  const templateIndex = templates.findIndex((t) => t.id === templateId);
  const versionRecord = templateVersions.find((v: any) => v.templateId === templateId && (!version || v.version === version));

  const rejectRecord = {
    id: `rej-${Date.now()}`,
    templateId,
    version,
    action: 'reject',
    reviewerName,
    comment: reason,
    timestamp: new Date().toISOString(),
    status: 'rejected',
  };

  approvals.unshift(rejectRecord);
  storage.write('approvals', approvals);

  if (versionRecord) {
    versionRecord.status = 'rejected';
    versionRecord.comments = versionRecord.comments || [];
    versionRecord.comments.push({
      id: `cm-${Date.now()}`,
      author: reviewerName,
      authorRole: 'Quality Reviewer',
      content: reason,
      createdAt: new Date().toISOString(),
      statusChange: 'rejected',
    });
    storage.write('templateVersions', templateVersions);
  }

  if (templateIndex >= 0) {
    templates[templateIndex].status = 'rejected';
    templates[templateIndex].updatedAt = new Date().toISOString();
    storage.write('templates', templates);
  }

  logBackendAudit(
    reviewerName,
    'Quality Reviewer',
    'REJECT_TEMPLATE',
    `Rejected Template "${templateIndex >= 0 ? templates[templateIndex].name : templateId}". Reason: ${reason}`,
    templateId,
    templateIndex >= 0 ? templates[templateIndex].name : templateId
  );

  res.json({
    success: true,
    status: 'rejected',
    rejectRecord,
    snapshot: versionRecord,
  });
});

// POST /api/templates/request-change (Request Changes with Annotations & Comments)
templatesRouter.post('/request-change', (req: Request, res: Response) => {
  const { templateId, version, reviewerName = 'Quality Reviewer', comment = '', annotations = [] } = req.body;
  const templates = storage.read<any>('templates', []);
  const templateVersions = storage.read<any>('templateVersions', []);

  const templateIndex = templates.findIndex((t) => t.id === templateId);
  const versionRecord = templateVersions.find((v: any) => v.templateId === templateId && (!version || v.version === version));

  if (versionRecord) {
    versionRecord.status = 'rejected';
    versionRecord.annotations = [...(versionRecord.annotations || []), ...annotations];
    versionRecord.comments = versionRecord.comments || [];
    versionRecord.comments.push({
      id: `cm-${Date.now()}`,
      author: reviewerName,
      authorRole: 'Quality Reviewer',
      content: `Change Requested: ${comment}`,
      createdAt: new Date().toISOString(),
      statusChange: 'rejected',
    });
    storage.write('templateVersions', templateVersions);
  }

  // Set template status back to draft for designer rework
  let updatedTemplate = null;
  if (templateIndex >= 0) {
    templates[templateIndex].status = 'draft';
    templates[templateIndex].updatedAt = new Date().toISOString();
    updatedTemplate = templates[templateIndex];
    storage.write('templates', templates);
  }

  logBackendAudit(
    reviewerName,
    'Quality Reviewer',
    'REQUEST_CHANGE',
    `Requested Changes on Template "${templateIndex >= 0 ? templates[templateIndex].name : templateId}" (${annotations.length} annotations attached). Note: ${comment}`,
    templateId,
    templateIndex >= 0 ? templates[templateIndex].name : templateId
  );

  res.json({
    success: true,
    status: 'draft',
    template: updatedTemplate,
    snapshot: versionRecord,
  });
});

// GET /api/templates/version/:id (Get Immutable Snapshot)
templatesRouter.get('/version/:id', (req: Request, res: Response) => {
  const templateVersions = storage.read<any>('templateVersions', []);
  const snapshot = templateVersions.find((v: any) => v.id === req.params.id || v.templateId === req.params.id);

  if (!snapshot) {
    return res.status(404).json({ error: 'Template version snapshot not found' });
  }

  res.json(snapshot);
});

// GET /api/templates/preview/:id (Get Preview Assets for Version)
templatesRouter.get('/preview/:id', (req: Request, res: Response) => {
  const templateVersions = storage.read<any>('templateVersions', []);
  const snapshot = templateVersions.find((v: any) => v.id === req.params.id || v.templateId === req.params.id);

  if (!snapshot) {
    return res.status(404).json({ error: 'Preview not found' });
  }

  res.json({
    id: snapshot.id,
    version: snapshot.version,
    templateId: snapshot.templateId,
    templateName: snapshot.templateName,
    svgSnapshot: snapshot.svgSnapshot,
    pngSnapshot: snapshot.pngSnapshot,
    canvasJson: snapshot.canvasJson,
    objectTree: snapshot.objectTree,
    hash: snapshot.hash,
    checksum: snapshot.checksum,
    status: snapshot.status,
  });
});

// GET /api/templates/history/:id (Get Full Revision & Approval History)
templatesRouter.get('/history/:id', (req: Request, res: Response) => {
  const templateVersions = storage.read<any>('templateVersions', []);
  const approvals = storage.read<any>('approvals', []);
  const templates = storage.read<any>('templates', []);

  const template = templates.find((t: any) => t.id === req.params.id);
  const versions = templateVersions.filter((v: any) => v.templateId === req.params.id);
  const templateApprovals = approvals.filter((a: any) => a.templateId === req.params.id);

  res.json({
    templateId: req.params.id,
    templateName: template?.name || req.params.id,
    currentVersion: template?.version || '1.0',
    currentStatus: template?.status || 'draft',
    versions,
    approvals: templateApprovals,
  });
});

// POST /api/templates/:id/duplicate
templatesRouter.post('/:id/duplicate', (req: Request, res: Response) => {
  const templates = storage.read<any>('templates', []);
  const original = templates.find((t: any) => t.id === req.params.id);

  if (!original) {
    return res.status(404).json({ error: 'Template not found' });
  }

  const copy = {
    ...original,
    id: `tmpl-${Date.now()}`,
    name: `${original.name} (Copy)`,
    version: '1.0',
    status: 'draft',
    tags: Array.from(new Set([...(original.tags || []), 'Draft'])),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    approvedBy: undefined,
    approvedAt: undefined,
  };

  templates.unshift(copy);
  storage.write('templates', templates);

  logBackendAudit(
    'Designer',
    'Label Designer',
    'CREATE_TEMPLATE',
    `Cloned template from "${original.name}" to "${copy.name}"`,
    copy.id,
    copy.name
  );

  res.status(201).json(copy);
});

// DELETE /api/templates/:id
templatesRouter.delete('/:id', (req: Request, res: Response) => {
  const templates = storage.read<any>('templates', []);
  const index = templates.findIndex((t: any) => t.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: 'Template not found' });
  }

  const removed = templates.splice(index, 1)[0];
  storage.write('templates', templates);

  logBackendAudit(
    'Admin',
    'Admin',
    'EDIT_TEMPLATE',
    `Archived/Deleted template "${removed.name}"`,
    removed.id,
    removed.name
  );

  res.json({ success: true, id: req.params.id });
});
