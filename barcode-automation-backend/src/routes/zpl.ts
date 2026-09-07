import { Router, Request, Response } from 'express';
import { generateZPL, generateTSPL, generateEPL } from '../../../src/services/zplEngine';

export const zplRouter = Router();

// POST /api/zpl/generate
zplRouter.post('/generate', (req: Request, res: Response) => {
  const { template, record, format = 'zpl' } = req.body;
  if (!template) {
    return res.status(400).json({ error: 'Missing template definition' });
  }

  let code = '';
  if (format === 'tspl') {
    code = generateTSPL(template, record || {});
  } else if (format === 'epl') {
    code = generateEPL(template, record || {});
  } else {
    code = generateZPL(template, record || {});
  }

  res.json({ [format]: code, code });
});
