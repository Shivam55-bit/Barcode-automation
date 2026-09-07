import React, { useState, useMemo } from 'react';
import { DataSourceItem, GS1Field } from '../../types';
import { calculateGS1CheckDigit, validateGS1CheckDigit } from '../../services/gs1Engine';
import { X, Globe, Plus, Trash2, CheckCircle2, AlertCircle, Calendar, Hash, Database, Link as LinkIcon } from 'lucide-react';

export interface GS1ApplicationIdentifierWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (fields: GS1Field[], replaceMode: 'replace' | 'insert' | 'append') => void;
  availableVariables?: Array<{ name: string; label?: string }>;
}

export interface GS1AIDefItem {
  ai: string;
  description: string;
  format: string;
  dataTitle: string;
  minLength: number;
  maxLength: number;
  isVariableLength: boolean;
  type: 'numeric' | 'alphanumeric' | 'date';
  sample: string;
}

export const GS1_FULL_AI_LIST: GS1AIDefItem[] = [
  { ai: '00', description: 'SSCC-18 Serial Shipping Container Code', format: 'N18', dataTitle: 'SSCC', minLength: 18, maxLength: 18, isVariableLength: false, type: 'numeric', sample: '0000123456000000018' },
  { ai: '01', description: 'Global Trade Item Number (GTIN)', format: 'N14', dataTitle: 'GTIN', minLength: 14, maxLength: 14, isVariableLength: false, type: 'numeric', sample: '00850006531234' },
  { ai: '02', description: 'Item Number of Goods Contained Within Logistic Unit (GTIN)', format: 'N14', dataTitle: 'CONTENT', minLength: 14, maxLength: 14, isVariableLength: false, type: 'numeric', sample: '00850006531234' },
  { ai: '10', description: 'Batch or Lot Number', format: 'X..20', dataTitle: 'BATCH/LOT', minLength: 1, maxLength: 20, isVariableLength: true, type: 'alphanumeric', sample: 'LOT-2026-X89' },
  { ai: '11', description: 'Production Date (YYMMDD)', format: 'N6', dataTitle: 'PROD DATE', minLength: 6, maxLength: 6, isVariableLength: false, type: 'date', sample: '260819' },
  { ai: '12', description: 'Due Date (YYMMDD)', format: 'N6', dataTitle: 'DUE DATE', minLength: 6, maxLength: 6, isVariableLength: false, type: 'date', sample: '260930' },
  { ai: '13', description: 'Packaging Date (YYMMDD)', format: 'N6', dataTitle: 'PACK DATE', minLength: 6, maxLength: 6, isVariableLength: false, type: 'date', sample: '260820' },
  { ai: '15', description: 'Best Before Date (Quality) (YYMMDD)', format: 'N6', dataTitle: 'BEST BEFORE', minLength: 6, maxLength: 6, isVariableLength: false, type: 'date', sample: '270819' },
  { ai: '16', description: 'Sell By Date (YYMMDD)', format: 'N6', dataTitle: 'SELL BY', minLength: 6, maxLength: 6, isVariableLength: false, type: 'date', sample: '270115' },
  { ai: '17', description: 'Expiration Date (Safety) (YYMMDD)', format: 'N6', dataTitle: 'USE BY OR EXPIRY', minLength: 6, maxLength: 6, isVariableLength: false, type: 'date', sample: '271231' },
  { ai: '20', description: 'Product Variant', format: 'N2', dataTitle: 'VARIANT', minLength: 2, maxLength: 2, isVariableLength: false, type: 'numeric', sample: '01' },
  { ai: '21', description: 'Serial Number', format: 'X..20', dataTitle: 'SERIAL', minLength: 1, maxLength: 20, isVariableLength: true, type: 'alphanumeric', sample: 'SN-0004921' },
  { ai: '22', description: 'HIBC - Quantity, Expiration Date, and Lot Number', format: 'X..29', dataTitle: 'HIBC DATA', minLength: 1, maxLength: 29, isVariableLength: true, type: 'alphanumeric', sample: '14101234567890' },
  { ai: '23', description: 'Lot Number (Transition Use)', format: 'X..19', dataTitle: 'LOT', minLength: 1, maxLength: 19, isVariableLength: true, type: 'alphanumeric', sample: 'LOT-9921' },
  { ai: '240', description: 'Additional Product Identification Assigned by the Manufacturer', format: 'X..30', dataTitle: 'ADDITIONAL ID', minLength: 1, maxLength: 30, isVariableLength: true, type: 'alphanumeric', sample: 'PROD-EXT-9842' },
  { ai: '241', description: 'Customer Part Number', format: 'X..30', dataTitle: 'CUST. PART NO', minLength: 1, maxLength: 30, isVariableLength: true, type: 'alphanumeric', sample: 'CPN-44912' },
  { ai: '242', description: 'Made-to-Order Variation Number', format: 'N..6', dataTitle: 'MTO VARIATION', minLength: 1, maxLength: 6, isVariableLength: true, type: 'numeric', sample: '10492' },
  { ai: '243', description: 'Packaging Component Number', format: 'X..20', dataTitle: 'PCN', minLength: 1, maxLength: 20, isVariableLength: true, type: 'alphanumeric', sample: 'BOX-TYPE-A' },
  { ai: '250', description: 'Secondary Serial Number', format: 'X..30', dataTitle: 'SEC. SERIAL', minLength: 1, maxLength: 30, isVariableLength: true, type: 'alphanumeric', sample: 'SUB-SN-1102' },
  { ai: '251', description: 'Reference to Source Entity', format: 'X..30', dataTitle: 'REF. SOURCE', minLength: 1, maxLength: 30, isVariableLength: true, type: 'alphanumeric', sample: 'PLANT-NORTH-01' },
  { ai: '253', description: 'Global Document Type Identifier (GDTI)', format: 'N13+X..17', dataTitle: 'GDTI', minLength: 13, maxLength: 30, isVariableLength: true, type: 'alphanumeric', sample: '00850006531230001' },
  { ai: '254', description: 'GLN Extension Component', format: 'X..20', dataTitle: 'GLN EXT', minLength: 1, maxLength: 20, isVariableLength: true, type: 'alphanumeric', sample: 'DOCK-4B' },
  { ai: '255', description: 'Global Coupon Number (GCN)', format: 'N13+N..12', dataTitle: 'GCN', minLength: 13, maxLength: 25, isVariableLength: true, type: 'numeric', sample: '008500065312300123' },
  { ai: '30', description: 'Variable Count', format: 'N..8', dataTitle: 'VAR. COUNT', minLength: 1, maxLength: 8, isVariableLength: true, type: 'numeric', sample: '150' },
  { ai: '310n', description: 'Net Weight (Kilograms)', format: 'N6', dataTitle: 'NET WEIGHT(kg)', minLength: 6, maxLength: 6, isVariableLength: false, type: 'numeric', sample: '3103001500' },
  { ai: '311n', description: 'Length or 1st Dimension (Meters)', format: 'N6', dataTitle: 'NET LENGTH(m)', minLength: 6, maxLength: 6, isVariableLength: false, type: 'numeric', sample: '3112002500' },
  { ai: '312n', description: 'Width, Diameter or 2nd Dimension (Meters)', format: 'N6', dataTitle: 'NET WIDTH(m)', minLength: 6, maxLength: 6, isVariableLength: false, type: 'numeric', sample: '3122001200' },
  { ai: '313n', description: 'Depth, Thickness, Height or 3rd Dimension (Meters)', format: 'N6', dataTitle: 'NET DEPTH(m)', minLength: 6, maxLength: 6, isVariableLength: false, type: 'numeric', sample: '3132000850' },
  { ai: '314n', description: 'Area (Square Meters)', format: 'N6', dataTitle: 'NET AREA(m2)', minLength: 6, maxLength: 6, isVariableLength: false, type: 'numeric', sample: '3142003000' },
  { ai: '315n', description: 'Net Volume (Liters)', format: 'N6', dataTitle: 'NET VOL(l)', minLength: 6, maxLength: 6, isVariableLength: false, type: 'numeric', sample: '3151000750' },
  { ai: '316n', description: 'Net Volume (Cubic Meters)', format: 'N6', dataTitle: 'NET VOL(m3)', minLength: 6, maxLength: 6, isVariableLength: false, type: 'numeric', sample: '3163000025' },
  { ai: '320n', description: 'Net Weight (Pounds)', format: 'N6', dataTitle: 'NET WEIGHT(lb)', minLength: 6, maxLength: 6, isVariableLength: false, type: 'numeric', sample: '3202000550' },
  { ai: '321n', description: 'Length or 1st Dimension (Inches)', format: 'N6', dataTitle: 'NET LENGTH(in)', minLength: 6, maxLength: 6, isVariableLength: false, type: 'numeric', sample: '3212001000' },
  { ai: '322n', description: 'Length or 1st Dimension (Feet)', format: 'N6', dataTitle: 'NET LENGTH(ft)', minLength: 6, maxLength: 6, isVariableLength: false, type: 'numeric', sample: '3221000500' },
  { ai: '323n', description: 'Length or 1st Dimension (Yards)', format: 'N6', dataTitle: 'NET LENGTH(yd)', minLength: 6, maxLength: 6, isVariableLength: false, type: 'numeric', sample: '3233123456' },
  { ai: '330n', description: 'Gross Weight (Kilograms)', format: 'N6', dataTitle: 'GROSS WEIGHT(kg)', minLength: 6, maxLength: 6, isVariableLength: false, type: 'numeric', sample: '3303002200' },
  { ai: '340n', description: 'Gross Weight (Pounds)', format: 'N6', dataTitle: 'GROSS WEIGHT(lb)', minLength: 6, maxLength: 6, isVariableLength: false, type: 'numeric', sample: '3402004850' },
  { ai: '390n', description: 'Amount Payable (Single Monetary Area)', format: 'N..15', dataTitle: 'AMOUNT', minLength: 1, maxLength: 15, isVariableLength: true, type: 'numeric', sample: '39020002499' },
  { ai: '400', description: 'Customer Purchase Order Number', format: 'X..30', dataTitle: 'ORDER NUMBER', minLength: 1, maxLength: 30, isVariableLength: true, type: 'alphanumeric', sample: 'PO-2026-99482' },
  { ai: '414', description: 'GLN for Physical Location', format: 'N13', dataTitle: 'LOC No.', minLength: 13, maxLength: 13, isVariableLength: false, type: 'numeric', sample: '0085000653123' },
  { ai: '420', description: 'Deliver to / Ship to Postal Code', format: 'X..20', dataTitle: 'POSTAL', minLength: 1, maxLength: 20, isVariableLength: true, type: 'alphanumeric', sample: '90210-4821' },
  { ai: '422', description: 'Country of Origin (ISO 3166-1 Numeric)', format: 'N3', dataTitle: 'ORIGIN', minLength: 3, maxLength: 3, isVariableLength: false, type: 'numeric', sample: '840' },
  { ai: '7001', description: 'NATO Stock Number (NSN)', format: 'N13', dataTitle: 'NSN', minLength: 13, maxLength: 13, isVariableLength: false, type: 'numeric', sample: '5965011234567' },
  { ai: '8005', description: 'Price Per Unit of Measure', format: 'N6', dataTitle: 'PRICE/UOM', minLength: 6, maxLength: 6, isVariableLength: false, type: 'numeric', sample: '001250' },
  { ai: '91', description: 'Internal Company Use (1)', format: 'X..90', dataTitle: 'INTERNAL', minLength: 1, maxLength: 90, isVariableLength: true, type: 'alphanumeric', sample: 'INT-LOC-ALPHA' },
  { ai: '92', description: 'Internal Company Use (2)', format: 'X..90', dataTitle: 'INTERNAL', minLength: 1, maxLength: 90, isVariableLength: true, type: 'alphanumeric', sample: 'INT-DATA-BETA' },
];

export const GS1ApplicationIdentifierWizardModal: React.FC<GS1ApplicationIdentifierWizardModalProps> = ({
  isOpen,
  onClose,
  onApply,
  availableVariables = [],
}) => {
  // Wizard steps: 1: Welcome, 2: Replace/Insert, 3: Select AI, 4: Configure AI Value, 5: Summary
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [skipWelcomeNextTime, setSkipWelcomeNextTime] = useState<boolean>(false);
  const [replaceMode, setReplaceMode] = useState<'replace' | 'insert' | 'append'>('replace');

  // AI Selection State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedAiCode, setSelectedAiCode] = useState<string>('01');

  // Current AI Editing State
  const [currentAiValue, setCurrentAiValue] = useState<string>('00850006531234');
  const [currentAiSourceType, setCurrentAiSourceType] = useState<'embedded' | 'database' | 'serial' | 'clock' | 'variable'>('embedded');

  // Accumulated Configured Fields List
  const [configuredFields, setConfiguredFields] = useState<GS1Field[]>([]);

  // Filtered AI List based on Search
  const filteredAIs = useMemo(() => {
    if (!searchQuery.trim()) return GS1_FULL_AI_LIST;
    const q = searchQuery.toLowerCase();
    return GS1_FULL_AI_LIST.filter(
      (item) => item.ai.toLowerCase().includes(q) || item.description.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const selectedAIDef = useMemo(() => {
    return GS1_FULL_AI_LIST.find((item) => item.ai === selectedAiCode) || GS1_FULL_AI_LIST[1];
  }, [selectedAiCode]);

  if (!isOpen) return null;

  const handleNext = () => {
    if (currentStep === 1) {
      setCurrentStep(2);
    } else if (currentStep === 2) {
      setCurrentStep(3);
    } else if (currentStep === 3) {
      // Initialize editing value from sample
      setCurrentAiValue(selectedAIDef.sample);
      setCurrentStep(4);
    } else if (currentStep === 4) {
      // Add or update current field in configured list
      const newField: GS1Field = {
        ai: selectedAIDef.ai,
        label: selectedAIDef.dataTitle,
        value: currentAiValue || selectedAIDef.sample,
        description: selectedAIDef.description,
        dataTitle: selectedAIDef.dataTitle,
      };

      const existingIdx = configuredFields.findIndex((f) => f.ai === selectedAIDef.ai);
      let updated: GS1Field[];
      if (existingIdx >= 0) {
        updated = [...configuredFields];
        updated[existingIdx] = newField;
      } else {
        updated = [...configuredFields, newField];
      }
      setConfiguredFields(updated);
      setCurrentStep(5);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleAddAnotherAI = () => {
    // Return to Step 3 to pick next AI
    setSelectedAiCode('10');
    setCurrentStep(3);
  };

  const handleFinish = () => {
    let finalFields = [...configuredFields];
    // If currently on step 4, include the active field
    if (currentStep === 4) {
      const newField: GS1Field = {
        ai: selectedAIDef.ai,
        label: selectedAIDef.dataTitle,
        value: currentAiValue || selectedAIDef.sample,
        description: selectedAIDef.description,
        dataTitle: selectedAIDef.dataTitle,
      };
      if (!finalFields.some((f) => f.ai === newField.ai)) {
        finalFields.push(newField);
      }
    }

    if (finalFields.length === 0) {
      finalFields = [
        { ai: '01', value: '00850006531234', dataTitle: 'GTIN', description: 'Global Trade Item Number' },
        { ai: '10', value: 'LOT456', dataTitle: 'BATCH/LOT', description: 'Batch or Lot Number' },
        { ai: '17', value: '261231', dataTitle: 'USE BY OR EXPIRY', description: 'Expiration Date' },
      ];
    }

    onApply(finalFields, replaceMode);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4 animate-in fade-in duration-150 font-sans select-none">
      {/* BarTender Wizard Window Frame matching Screenshots 1-5 */}
      <div
        className="w-[590px] max-w-full bg-[#f0f4f9] rounded-lg shadow-2xl border border-[#718096] flex flex-col overflow-hidden text-slate-800 text-[12px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title Bar */}
        <div className="bg-gradient-to-r from-[#d9e2ec] via-[#bcccdc] to-[#9fb3c8] border-b border-[#829ab1] px-2.5 py-1.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gradient-to-br from-amber-400 to-cyan-600 rounded-xs shadow-xs flex items-center justify-center p-0.5">
              <Globe className="w-3 h-3 text-cyan-900" />
            </div>
            <span className="font-semibold text-slate-900 text-[12.5px] tracking-tight">
              GS1 Application Identifier Data Source Wizard
            </span>
          </div>

          <button
            onClick={onClose}
            title="Close"
            className="w-6 h-5 flex items-center justify-center hover:bg-slate-300 text-slate-700 rounded-xs cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Top Graphic Banner with Barcode Texture matching Screenshots */}
        <div className="h-14 bg-gradient-to-r from-[#003b73] via-[#005f9e] to-[#0081c7] relative overflow-hidden flex items-center px-4 border-b border-[#002f5c]">
          <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-30 text-right pointer-events-none">
            <div className="font-mono text-xl font-bold tracking-widest text-white">|||||||||||||||||||||||</div>
            <div className="font-mono text-xs text-cyan-200">(01) 19421128901234</div>
          </div>

          <div className="z-10">
            <div className="font-bold text-white text-[13px] tracking-tight">
              {currentStep === 1 && 'Welcome!'}
              {currentStep === 2 && 'Replace or Insert?'}
              {currentStep === 3 && 'Application Identifiers'}
              {currentStep === 4 && `Configure AI (${selectedAIDef.ai}) ${selectedAIDef.dataTitle}`}
              {currentStep === 5 && 'Summary & Verification'}
            </div>
            <div className="text-cyan-100 text-[11px]">
              {currentStep === 1 && 'GS1 Standard Data Source Configuration'}
              {currentStep === 2 && 'Object Data Source Insertion Method'}
              {currentStep === 3 && 'Please select the Application Identifier (AI) to use.'}
              {currentStep === 4 && 'Define the data source value and validation format.'}
              {currentStep === 5 && 'Review and finish configuring Application Identifiers.'}
            </div>
          </div>
        </div>

        {/* Wizard Step Body */}
        <div className="p-5 bg-white min-h-[320px] max-h-[400px] overflow-y-auto flex flex-col justify-between">
          {/* ========================================================================= */}
          {/* SCREEN 1: WELCOME                                                         */}
          {/* ========================================================================= */}
          {currentStep === 1 && (
            <div className="space-y-3.5 text-slate-800 text-[11.5px] leading-relaxed">
              <p>
                This wizard helps you configure your Data Source to comply with the requirements of the{' '}
                <strong className="text-blue-700">GS1 Application Identifier standard (www.gs1.org)</strong>.
              </p>

              <p>
                An Application Identifier is generally a two to four digit sequence that identifies the data that
                follows it. Application identifiers can be concatenated together to form a larger string with more
                than one type of data in it.
              </p>

              <p>
                This wizard helps you set up one Application Identifier at a time. After each one, you will be given
                the opportunity to add another or finish the wizard.
              </p>

              <p className="font-medium pt-2 text-slate-900">To get started, press Next.</p>

              <div className="pt-4 border-t border-slate-200">
                <label className="flex items-center gap-2 text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={skipWelcomeNextTime}
                    onChange={(e) => setSkipWelcomeNextTime(e.target.checked)}
                    className="rounded-xs text-blue-600"
                  />
                  <span>Skip this page next time</span>
                </label>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SCREEN 2: REPLACE OR INSERT?                                              */}
          {/* ========================================================================= */}
          {currentStep === 2 && (
            <div className="space-y-4 text-slate-800 text-[11.5px]">
              <p className="leading-relaxed">
                This wizard will create a new data source. What would you like to do with this object's existing
                data sources?
              </p>

              <div className="space-y-3 pt-2 pl-4">
                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name="replace-mode"
                    checked={replaceMode === 'replace'}
                    onChange={() => setReplaceMode('replace')}
                    className="text-blue-600"
                  />
                  <span>Replace them all</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name="replace-mode"
                    checked={replaceMode === 'insert'}
                    onChange={() => setReplaceMode('insert')}
                    className="text-blue-600"
                  />
                  <span>Keep them and insert the new data source</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name="replace-mode"
                    checked={replaceMode === 'append'}
                    onChange={() => setReplaceMode('append')}
                    className="text-blue-600"
                  />
                  <span>Keep them and append the new data source to the end</span>
                </label>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SCREEN 3: APPLICATION IDENTIFIERS SELECTION                               */}
          {/* ========================================================================= */}
          {currentStep === 3 && (
            <div className="space-y-3">
              {/* Table / Listbox matching Screenshots 3-5 */}
              <div className="border border-[#94a3b8] rounded-xs bg-white h-[180px] overflow-y-auto font-sans text-[11.5px] select-none">
                <div className="bg-[#e2e8f0] border-b border-[#cbd5e1] px-2 py-1 flex items-center font-bold text-slate-700 sticky top-0">
                  <div className="w-14">AI</div>
                  <div className="flex-1">Description</div>
                </div>

                <div className="divide-y divide-slate-100">
                  {filteredAIs.map((item) => {
                    const isSelected = selectedAiCode === item.ai;
                    return (
                      <div
                        key={item.ai}
                        onClick={() => setSelectedAiCode(item.ai)}
                        className={`px-2 py-1 flex items-center cursor-pointer transition-colors ${
                          isSelected ? 'bg-[#0078d7] text-white font-medium' : 'hover:bg-slate-100 text-slate-800'
                        }`}
                      >
                        <div className="w-14 font-mono font-bold text-xs">{item.ai}</div>
                        <div className="flex-1 truncate">{item.description}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Filter Search Input */}
              <div className="flex items-center gap-2 text-[11.5px]">
                <label className="w-40 text-slate-700">Search (AI or Description):</label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="e.g. GTIN, Batch, 17, Serial"
                  className="flex-1 bg-white border border-[#94a3b8] rounded-xs px-2 py-0.8 text-slate-900 outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>

              {/* Sample Box */}
              <fieldset className="border border-[#cbd5e1] rounded-xs p-2 text-[11.5px]">
                <legend className="px-1 text-slate-700 font-medium">Sample</legend>
                <div className="p-1 bg-slate-50 border border-slate-300 rounded font-mono text-xs font-bold text-slate-900 select-all">
                  {selectedAIDef.sample}
                </div>
              </fieldset>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SCREEN 4: CONFIGURE AI VALUE & DATA SOURCE TYPE                           */}
          {/* ========================================================================= */}
          {currentStep === 4 && (
            <div className="space-y-3.5 text-[11.5px]">
              <div className="bg-emerald-50/70 border border-emerald-300 p-2.5 rounded flex items-center justify-between">
                <div>
                  <div className="font-bold text-emerald-950 text-xs">
                    Application Identifier ({selectedAIDef.ai}) — {selectedAIDef.dataTitle}
                  </div>
                  <div className="text-[11px] text-emerald-800">{selectedAIDef.description}</div>
                </div>
                <span className="font-mono text-xs bg-emerald-200 px-2 py-0.5 rounded text-emerald-950 font-bold">
                  Format: {selectedAIDef.format}
                </span>
              </div>

              {/* Source Type Selector */}
              <div className="flex items-center gap-3">
                <label className="w-24 text-slate-700 font-medium">Source Type:</label>
                <select
                  value={currentAiSourceType}
                  onChange={(e) => setCurrentAiSourceType(e.target.value as any)}
                  className="flex-1 bg-white border border-[#94a3b8] rounded-xs px-2.5 py-1 text-slate-900 font-medium"
                >
                  <option value="embedded">💾 Embedded Constant Value</option>
                  <option value="database">🗄️ Database Field</option>
                  <option value="serial">🔢 Serial Number / Counter</option>
                  <option value="clock">🕒 Dynamic Clock Date Offset</option>
                  <option value="variable">🔗 Named Template Variable</option>
                </select>
              </div>

              {/* Value Input */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-slate-700 font-medium">Data Value for ({selectedAIDef.ai}):</label>
                  {(selectedAIDef.ai === '01' || selectedAIDef.ai === '00' || selectedAIDef.ai === '02') && (
                    <button
                      type="button"
                      onClick={() => {
                        const clean = currentAiValue.replace(/\D/g, '');
                        if (clean.length >= 7) {
                          const body = clean.slice(0, -1);
                          const cd = calculateGS1CheckDigit(body);
                          setCurrentAiValue(`${body}${cd}`);
                        }
                      }}
                      className="text-xs text-blue-700 hover:underline font-bold"
                    >
                      Calculate Modulo-10 Check Digit
                    </button>
                  )}
                </div>

                <input
                  type="text"
                  value={currentAiValue}
                  onChange={(e) => setCurrentAiValue(e.target.value)}
                  className="w-full bg-white border border-[#94a3b8] rounded-xs p-2 font-mono text-xs font-bold text-slate-900 outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>

              {/* Preview */}
              <div className="p-2 bg-slate-50 border border-slate-200 rounded text-xs">
                <span className="font-bold text-slate-700">Resulting AI String: </span>
                <span className="font-mono font-bold text-blue-800">
                  ({selectedAIDef.ai}){currentAiValue || selectedAIDef.sample}
                </span>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* SCREEN 5: SUMMARY & CONFIGURED IDENTIFIERS LIST                            */}
          {/* ========================================================================= */}
          {currentStep === 5 && (
            <div className="space-y-3 text-[11.5px]">
              <div className="bg-blue-50 border border-blue-200 p-2.5 rounded">
                <div className="text-xs font-bold text-blue-950 mb-0.5">Compiled GS1 AI Data Source:</div>
                <div className="font-mono text-xs font-bold text-slate-900 select-all break-all">
                  {configuredFields.map((f) => `(${f.ai})${f.value}`).join('')}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">
                    Configured Identifiers ({configuredFields.length}):
                  </span>
                  <button
                    type="button"
                    onClick={handleAddAnotherAI}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium flex items-center gap-1 shadow-2xs cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Another Application Identifier</span>
                  </button>
                </div>

                <div className="border border-slate-300 rounded-xs bg-white divide-y divide-slate-200 max-h-[140px] overflow-y-auto">
                  {configuredFields.map((field, idx) => (
                    <div key={idx} className="p-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs bg-emerald-100 text-emerald-950 px-1.5 py-0.2 rounded border border-emerald-300">
                          ({field.ai})
                        </span>
                        <span className="font-bold text-slate-900">{field.dataTitle || `AI ${field.ai}`}</span>
                        <span className="font-mono text-slate-600 truncate max-w-[200px]">{field.value}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setConfiguredFields(configuredFields.filter((_, i) => i !== idx))}
                        className="p-1 hover:bg-red-50 text-red-600 rounded cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Wizard Bottom Buttons Bar matching Screenshots */}
        <div className="bg-[#e4ebf5] border-t border-[#cbd5e1] px-4 py-2 flex items-center justify-between">
          <div className="text-slate-500 text-[11px]">
            Step {currentStep} of 5
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleBack}
              disabled={currentStep === 1}
              className="px-3.5 py-1 bg-[#f8fafc] hover:bg-[#e2e8f0] disabled:opacity-40 border border-[#94a3b8] rounded-xs text-slate-800 text-[11.5px] font-medium shadow-2xs cursor-pointer min-w-[70px]"
            >
              &lt; Back
            </button>

            {currentStep < 5 ? (
              <button
                onClick={handleNext}
                className="px-3.5 py-1 bg-[#f8fafc] hover:bg-[#e2e8f0] border border-[#0078d7] ring-1 ring-[#0078d7] rounded-xs text-slate-900 text-[11.5px] font-bold shadow-2xs cursor-pointer min-w-[70px]"
              >
                Next &gt;
              </button>
            ) : (
              <button
                onClick={handleFinish}
                className="px-3.5 py-1 bg-[#0078d7] hover:bg-[#005a9e] border border-[#005a9e] rounded-xs text-white text-[11.5px] font-bold shadow-2xs cursor-pointer min-w-[70px]"
              >
                Finish
              </button>
            )}

            <button
              onClick={handleFinish}
              disabled={configuredFields.length === 0 && currentStep < 4}
              className="px-3.5 py-1 bg-[#f8fafc] hover:bg-[#e2e8f0] disabled:opacity-40 border border-[#94a3b8] rounded-xs text-slate-800 text-[11.5px] font-medium shadow-2xs cursor-pointer min-w-[70px]"
            >
              Finish
            </button>

            <button
              onClick={onClose}
              className="px-3.5 py-1 bg-[#f8fafc] hover:bg-[#e2e8f0] border border-[#94a3b8] rounded-xs text-slate-800 text-[11.5px] font-medium shadow-2xs cursor-pointer min-w-[70px]"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
