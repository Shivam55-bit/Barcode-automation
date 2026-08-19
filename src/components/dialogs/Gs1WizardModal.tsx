import React, { useState } from 'react';
import { Modal } from '../common/Modal';
import { GS1_AI_DICTIONARY, calculateGS1CheckDigit, validateGS1CheckDigit, parseGS1BracketedString } from '../../services/gs1Engine';
import { ShieldCheck, Plus, Trash2, CheckCircle2, AlertCircle, Copy, Check, Sparkles, Binary } from 'lucide-react';

interface Gs1WizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyGS1: (formattedString: string, symbology: 'gs1-128' | 'gs1-datamatrix') => void;
  initialValue?: string;
}

export const Gs1WizardModal: React.FC<Gs1WizardModalProps> = ({
  isOpen,
  onClose,
  onApplyGS1,
  initialValue = '(01)00850006531234(17)261231(10)LOT456(21)SN789',
}) => {
  const [targetSymbology, setTargetSymbology] = useState<'gs1-128' | 'gs1-datamatrix'>('gs1-datamatrix');
  const [aiEntries, setAiEntries] = useState<{ ai: string; value: string }[]>([
    { ai: '01', value: '00850006531234' },
    { ai: '17', value: '261231' },
    { ai: '10', value: 'LOT-9024' },
    { ai: '21', value: 'SN-04982' },
  ]);

  const addAiEntry = (aiCode: string = '10') => {
    setAiEntries([...aiEntries, { ai: aiCode, value: '' }]);
  };

  const removeAiEntry = (index: number) => {
    setAiEntries(aiEntries.filter((_, i) => i !== index));
  };

  const updateAiEntry = (index: number, ai: string, value: string) => {
    const next = [...aiEntries];
    next[index] = { ai, value };
    setAiEntries(next);
  };

  const computedGS1String = aiEntries
    .filter((e) => e.ai && e.value)
    .map((e) => `(${e.ai})${e.value}`)
    .join('');

  const parsed = parseGS1BracketedString(computedGS1String);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="GS1 Application Identifier (AI) Builder & Validator (BarTender Standard)" maxWidth="max-w-2xl">
      <div className="space-y-4 text-xs text-slate-700">
        {/* Output Symbology Switch */}
        <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <div>
            <span className="font-bold text-slate-900 block text-xs">Target Standard Symbology</span>
            <span className="text-[10px] text-slate-500">
              GS1-128 Linear (Logistics/Pallet) or GS1 DataMatrix (FDA UDI / Healthcare)
            </span>
          </div>

          <div className="flex items-center gap-1 bg-white p-1 rounded-md border border-slate-300">
            <button
              onClick={() => setTargetSymbology('gs1-datamatrix')}
              className={`px-3 py-1 rounded text-xs font-bold transition-colors ${
                targetSymbology === 'gs1-datamatrix' ? 'bg-blue-600 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              GS1 DataMatrix (2D UDI)
            </button>
            <button
              onClick={() => setTargetSymbology('gs1-128')}
              className={`px-3 py-1 rounded text-xs font-bold transition-colors ${
                targetSymbology === 'gs1-128' ? 'bg-slate-900 text-white shadow-2xs' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              GS1-128 (1D Linear)
            </button>
          </div>
        </div>

        {/* AI Entries List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
              <Binary className="w-3.5 h-3.5 text-blue-600" />
              Configured Application Identifiers (AIs)
            </span>
            <button
              onClick={() => addAiEntry()}
              className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Identifier</span>
            </button>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto p-1">
            {aiEntries.map((entry, index) => {
              const aiSpec = GS1_AI_DICTIONARY[entry.ai];
              const isGtin = entry.ai === '01' || entry.ai === '02';
              const isCheckDigitValid = isGtin && entry.value.length === 14 ? validateGS1CheckDigit(entry.value) : true;

              return (
                <div key={index} className="flex items-start gap-2 p-2.5 bg-white border border-slate-200 rounded-lg shadow-2xs">
                  <div className="w-48">
                    <label className="text-[10px] text-slate-500 font-medium block mb-0.5">AI Code & Standard</label>
                    <select
                      value={entry.ai}
                      onChange={(e) => updateAiEntry(index, e.target.value, entry.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-mono outline-none font-bold text-blue-800"
                    >
                      {Object.values(GS1_AI_DICTIONARY).map((spec) => (
                        <option key={spec.ai} value={spec.ai}>
                          ({spec.ai}) {spec.dataTitle} - {spec.description.slice(0, 24)}...
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-0.5">
                      <label className="text-[10px] text-slate-500 font-medium">
                        Encoded Value ({aiSpec?.dataTitle || 'Data'}) • {aiSpec?.format || 'Alphanumeric'}
                      </label>
                      {isGtin && entry.value.length === 13 && (
                        <button
                          onClick={() => {
                            const cd = calculateGS1CheckDigit(entry.value);
                            updateAiEntry(index, entry.ai, `${entry.value}${cd}`);
                          }}
                          className="text-[10px] text-blue-600 hover:underline font-bold"
                        >
                          Auto-Calculate Modulo 10 Check Digit
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      value={entry.value}
                      placeholder={aiSpec ? `Format: ${aiSpec.format} (e.g. ${aiSpec.minLength === aiSpec.maxLength ? `${aiSpec.minLength} chars` : `${aiSpec.minLength}-${aiSpec.maxLength} chars`})` : 'Enter value'}
                      onChange={(e) => updateAiEntry(index, entry.ai, e.target.value)}
                      className={`w-full border rounded px-2 py-1 text-xs font-mono outline-none ${
                        !isCheckDigitValid ? 'bg-red-50 border-red-400 text-red-900' : 'bg-slate-50 border-slate-300 focus:bg-white'
                      }`}
                    />
                  </div>

                  <button
                    onClick={() => removeAiEntry(index)}
                    className="p-1 text-slate-400 hover:text-red-600 mt-4 rounded"
                    title="Remove Identifier"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Live Validation & Decoder Panel */}
        <div className="p-3 bg-slate-900 text-white rounded-lg space-y-2">
          <div className="flex items-center justify-between text-[10px] text-slate-400">
            <span>GS1 Encoded String (FNC1 Compliant):</span>
            <span className="font-mono bg-slate-800 px-2 py-0.5 rounded text-emerald-400 font-bold">{targetSymbology.toUpperCase()}</span>
          </div>
          <div className="font-mono text-sm text-emerald-400 font-bold break-all select-text">
            {computedGS1String || '(No identifiers added)'}
          </div>
          {parsed.errors.length > 0 ? (
            <div className="text-[10px] text-red-400 flex items-center gap-1.5 pt-1 border-t border-slate-800">
              <AlertCircle className="w-3.5 h-3.5 text-red-400" />
              <span>{parsed.errors.join(' | ')}</span>
            </div>
          ) : (
            <div className="text-[10px] text-emerald-400 flex items-center gap-1.5 pt-1 border-t border-slate-800">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>GS1 Standard Checksum & AI Structure 100% Valid</span>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-1.5 border border-slate-300 hover:bg-slate-100 rounded text-slate-700 font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onApplyGS1(computedGS1String, targetSymbology);
              onClose();
            }}
            disabled={!computedGS1String}
            className="flex items-center gap-1.5 px-5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold shadow-xs transition-colors"
          >
            <Check className="w-4 h-4" />
            <span>Apply to Selected Barcode</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
