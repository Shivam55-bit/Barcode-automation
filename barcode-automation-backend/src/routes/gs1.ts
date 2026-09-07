import { Router, Request, Response } from 'express';
import { parseGS1BracketedString, validateGS1CheckDigit, calculateGS1CheckDigit } from '../../../src/services/gs1Engine';

export const gs1Router = Router();

// POST /api/gs1/parse
gs1Router.post('/parse', (req: Request, res: Response) => {
  const { input } = req.body;
  const result = parseGS1BracketedString(input || '');
  res.json(result);
});

// POST /api/gs1/check-digit
gs1Router.post('/check-digit', (req: Request, res: Response) => {
  const { digits } = req.body;
  if (!digits) {
    return res.status(400).json({ error: 'Digits required' });
  }
  const checkDigit = calculateGS1CheckDigit(digits);
  const isValid = validateGS1CheckDigit(digits);
  res.json({ digits, checkDigit, isValidWithCurrentCheckDigit: isValid });
});
