import { Router, Request, Response } from 'express';
import { StorageService } from '../services/storageService';
import { logBackendAudit } from '../services/auditService';

export const templatesRouter = Router();
const storage = StorageService.getInstance();

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

  // Check if template with this ID already exists -> update it instead
  const existingIndex = templates.findIndex((t) => t.id === newTemplate.id);
  if (existingIndex >= 0) {
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
      `Updated template "${newTemplate.name}"`,
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
    `Created new label template "${newTemplate.name}"`,
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

// POST /api/templates/:id/duplicate
templatesRouter.post('/:id/duplicate', (req: Request, res: Response) => {
  const templates = storage.read<any>('templates', []);
  const original = templates.find((t) => t.id === req.params.id);

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
  const index = templates.findIndex((t) => t.id === req.params.id);

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

// PATCH /api/templates/:id/status (Approval Workflow)
templatesRouter.patch('/:id/status', (req: Request, res: Response) => {
  const { status, comment, reviewerName, eSignature } = req.body;
  const templates = storage.read<any>('templates', []);
  const template = templates.find((t) => t.id === req.params.id);

  if (!template) {
    return res.status(404).json({ error: 'Template not found' });
  }

  template.status = status;
  template.updatedAt = new Date().toISOString();

  if (status === 'approved' || status === 'published') {
    template.approvedBy = eSignature || reviewerName || 'Quality Lead';
    template.approvedAt = new Date().toISOString();
  }

  if (comment) {
    template.comments = template.comments || [];
    template.comments.push({
      id: `cm-${Date.now()}`,
      author: reviewerName || 'Quality Reviewer',
      authorRole: 'Quality Reviewer',
      content: comment,
      createdAt: new Date().toISOString(),
      statusChange: status,
    });
  }

  storage.write('templates', templates);

  const actionMap: Record<string, string> = {
    submitted: 'SUBMIT_APPROVAL',
    pending_level_1: 'SUBMIT_APPROVAL',
    pending_level_2: 'APPROVE_TEMPLATE',
    approved: 'APPROVE_TEMPLATE',
    rejected: 'REJECT_TEMPLATE',
    published: 'PUBLISH_TEMPLATE',
  };

  logBackendAudit(
    reviewerName || 'Quality Reviewer',
    'Quality Reviewer',
    actionMap[status] || 'EDIT_TEMPLATE',
    `Workflow status changed for "${template.name}" to ${String(status).toUpperCase()}. Note: ${comment || 'N/A'}`,
    template.id,
    template.name
  );

  res.json(template);
});
