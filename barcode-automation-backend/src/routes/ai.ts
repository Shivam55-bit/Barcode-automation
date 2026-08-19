import { Router, Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';

export const aiRouter = Router();

// POST /api/ai/suggest
aiRouter.post('/suggest', async (req: Request, res: Response) => {
  const { prompt, labelType, standard } = req.body;

  if (process.env.GEMINI_API_KEY) {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `You are an expert industrial barcode & label designer.
User prompt: "${prompt}".
Label context: Type="${labelType || 'General'}", Standard="${standard || 'GS1'}".
Please provide concise expert recommendations for:
1. Recommended Barcode Symbology & Dimensions (e.g. Code 128, GS1-128, QR, GS1 DataMatrix).
2. Essential Mandatory Fields & Application Identifiers (e.g. (01) GTIN, (10) Lot, (17) Expiry).
3. Recommended Thermal Printer Resolution (203 DPI vs 300 DPI vs 600 DPI) and Quiet Zone specs.
4. Suggested Variable Structure.
Keep the advice clear, professional, and actionable for an enterprise print engineer.`,
      });

      return res.json({ advice: response.text });
    } catch (err: any) {
      console.error('[AI Assistant] Gemini API error:', err);
    }
  }

  // Built-in intelligent rule fallback
  let advice = `### Industrial Label Specification Recommendations for: ${labelType || 'Custom Label'}\n\n`;
  advice += `**1. Barcode Symbology:**\n- For Logistics & Pallets: Use **GS1-128** with SSCC-18 (AI 00).\n- For Pharma & Medical Devices: Use **GS1 DataMatrix** (2D) for FDA UDI compliance + Code 128 human backup.\n- For High-Speed Sorting: Ensure minimum X-dimension of 0.33mm (203 DPI: 3 dots, 300 DPI: 4 dots).\n\n`;
  advice += `**2. Essential Data Elements:**\n- (01) GTIN-14 Item Code\n- (10) Batch / Lot Identifier\n- (17) Expiration Date (YYMMDD format)\n- (21) Serial Number\n\n`;
  advice += `**3. Printing Parameters:**\n- Recommended Resolution: **300 DPI (12 dots/mm)** for crisp 2D DataMatrix and micro-fonts.\n- Quiet Zone: Minimum 10x narrow bar width on both leading and trailing edges.`;

  res.json({ advice });
});
