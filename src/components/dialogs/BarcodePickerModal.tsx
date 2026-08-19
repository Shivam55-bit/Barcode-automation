import React, { useState, useEffect, useRef } from 'react';
import { SYMBOLOGY_CATALOG, SymbologyMetadata, renderBarcodeToCanvas } from '../../services/barcodeEngine';
import { BarcodeSymbology, BarcodeElement } from '../../types';
import { Search, Folder, ChevronRight, ChevronDown, X, Minus, Square } from 'lucide-react';

interface BarcodePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSymbology: (symbology: BarcodeSymbology) => void;
  currentSymbology?: BarcodeSymbology;
}

export const BarcodePickerModal: React.FC<BarcodePickerModalProps> = ({
  isOpen,
  onClose,
  onSelectSymbology,
  currentSymbology = 'posicode-b',
}) => {
  const [selectedFolder, setSelectedFolder] = useState<string>('General Purpose');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    'GS1 (by Application)': false,
    'GS1 (by Symbology)': false,
    'Health Care': false,
  });
  const [selectedSymbologyId, setSelectedSymbologyId] = useState<BarcodeSymbology>(currentSymbology);
  const [search, setSearch] = useState('');
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  // Folder categories matching BarTender exactly
  const folders = [
    { id: 'General Purpose', name: 'General Purpose', hasChildren: false },
    { id: 'Disc / CD / DVD', name: 'Disc / CD / DVD', hasChildren: false },
    { id: 'GS1 (by Application)', name: 'GS1 (by Application)', hasChildren: true },
    { id: 'GS1 (by Symbology)', name: 'GS1 (by Symbology)', hasChildren: true },
    { id: 'Health Care', name: 'Health Care', hasChildren: true },
    { id: 'Pharmaceutical', name: 'Pharmaceutical', hasChildren: false },
    { id: 'Postal / Shipping', name: 'Postal / Shipping', hasChildren: false },
    { id: 'TLC', name: 'TLC', hasChildren: false },
    { id: 'All Symbologies', name: `All Symbologies (${SYMBOLOGY_CATALOG.length})`, hasChildren: false },
  ];

  // Set initial selected when opened
  useEffect(() => {
    if (isOpen) {
      setSelectedSymbologyId(currentSymbology || 'posicode-b');
    }
  }, [isOpen, currentSymbology]);

  // Filter symbologies by folder and search term
  const filteredList = SYMBOLOGY_CATALOG.filter((item) => {
    const matchSearch =
      !search ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.description.toLowerCase().includes(search.toLowerCase());

    if (search) return matchSearch;

    if (selectedFolder === 'All Symbologies') return true;
    return item.folderCategories.includes(selectedFolder);
  });

  // Active selected symbology metadata
  const selectedMeta =
    SYMBOLOGY_CATALOG.find((s) => s.id === selectedSymbologyId) ||
    filteredList[0] ||
    SYMBOLOGY_CATALOG[0];

  // Render preview barcode on canvas
  useEffect(() => {
    if (previewCanvasRef.current && selectedMeta) {
      const mockElement: BarcodeElement = {
        id: 'preview',
        name: 'Preview',
        type: 'barcode',
        x: 0,
        y: 0,
        width: 80,
        height: 35,
        rotation: 0,
        opacity: 1,
        locked: false,
        visible: true,
        zIndex: 1,
        symbology: selectedMeta.id,
        value: selectedMeta.defaultSample || '12345678',
        includeText: true,
        textPosition: 'below',
        barWidth: 2,
        barHeight: 30,
        quietZone: true,
        foregroundColor: '#000000',
        backgroundColor: '#ffffff',
        checkDigit: true,
      };

      renderBarcodeToCanvas(previewCanvasRef.current, mockElement, 2.5);
    }
  }, [selectedMeta, isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (selectedMeta) {
      onSelectSymbology(selectedMeta.id);
    }
    onClose();
  };

  const toggleFolder = (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedFolders((prev) => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 select-none">
      {/* Classic BarTender "Select Barcode" Window */}
      <div className="w-[660px] max-w-full bg-[#f0f2f5] border-2 border-[#0284c7] rounded-lg shadow-2xl overflow-hidden flex flex-col font-sans text-xs">
        {/* Window Title Bar */}
        <div className="flex items-center justify-between px-2.5 py-1.5 bg-gradient-to-r from-[#e0f2fe] via-[#f0f9ff] to-[#e0f2fe] border-b border-[#cbd5e1]">
          <div className="flex items-center gap-2">
            {/* Window Icon (Orange/Blue Sheet Icon) */}
            <div className="w-4 h-4 rounded-xs bg-cyan-600 flex items-center justify-center text-white text-[9px] font-bold shadow-xs">
              <svg viewBox="0 0 24 24" className="w-3 h-3 fill-current">
                <path d="M4 2h11l5 5v15H4V2z" fill="#f97316" />
                <path d="M14 2v6h6" fill="#0284c7" />
              </svg>
            </div>
            <span className="font-semibold text-slate-800 text-[13px]">Select Barcode</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={onClose}
              className="w-5 h-5 flex items-center justify-center hover:bg-slate-300 rounded text-slate-600 text-xs"
              title="Minimize"
            >
              <Minus className="w-3 h-3" />
            </button>
            <button
              className="w-5 h-5 flex items-center justify-center hover:bg-slate-300 rounded text-slate-600 text-xs"
              title="Maximize"
            >
              <Square className="w-2.5 h-2.5" />
            </button>
            <button
              onClick={onClose}
              className="w-5 h-5 flex items-center justify-center hover:bg-red-500 hover:text-white rounded text-slate-600 text-xs transition-colors"
              title="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Main Content Body */}
        <div className="p-2.5 flex gap-2.5 bg-[#f0f2f5]">
          {/* Left Pane: Categories Folder Tree */}
          <div className="w-52 bg-white border border-[#94a3b8] rounded-xs h-[370px] overflow-y-auto p-1 text-[11.5px]">
            {folders.map((folder) => {
              const isSelected = selectedFolder === folder.id;
              const isExpanded = expandedFolders[folder.id];

              return (
                <div key={folder.id}>
                  <div
                    onClick={() => {
                      setSelectedFolder(folder.id);
                      setSearch('');
                    }}
                    className={`flex items-center gap-1.5 px-1.5 py-1 rounded-xs cursor-pointer ${
                      isSelected
                        ? 'bg-[#dbeafe] text-blue-900 font-medium'
                        : 'hover:bg-slate-100 text-slate-800'
                    }`}
                  >
                    {folder.hasChildren ? (
                      <button
                        onClick={(e) => toggleFolder(folder.id, e)}
                        className="w-3 h-3 flex items-center justify-center text-slate-500 hover:text-slate-900"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-3 h-3" />
                        ) : (
                          <ChevronRight className="w-3 h-3" />
                        )}
                      </button>
                    ) : (
                      <span className="w-3" />
                    )}

                    {/* Classic Yellow Folder Icon */}
                    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-amber-400 text-amber-600 shrink-0">
                      <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                    </svg>

                    <span className="truncate">{folder.name}</span>
                  </div>

                  {/* Sub-tree expansion if applicable */}
                  {folder.hasChildren && isExpanded && (
                    <div className="pl-6 space-y-0.5 py-0.5">
                      <div
                        onClick={() => setSelectedFolder(folder.id)}
                        className="px-1.5 py-0.5 rounded-xs text-[11px] hover:bg-slate-100 text-slate-600 cursor-pointer flex items-center gap-1"
                      >
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
                        <span>All {folder.name}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right Pane: Search, Barcode List & Live High-DPI Preview */}
          <div className="flex-1 flex flex-col gap-2 h-[370px]">
            {/* Top Search Input with Magnifier */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-white border border-[#94a3b8] rounded-xs px-2.5 py-1 pr-7 text-xs text-slate-900 placeholder:italic placeholder:text-slate-400 outline-none focus:border-blue-500"
              />
              <Search className="w-3.5 h-3.5 absolute right-2 top-2 text-slate-500 pointer-events-none" />
            </div>

            {/* Middle: Symbologies List View */}
            <div className="h-[145px] bg-white border border-[#94a3b8] rounded-xs overflow-y-auto p-0.5">
              {filteredList.length === 0 ? (
                <div className="p-4 text-center text-slate-500 text-xs">
                  No matching symbologies found for &quot;{search}&quot;
                </div>
              ) : (
                filteredList.map((item) => {
                  const isSelected = selectedSymbologyId === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedSymbologyId(item.id)}
                      onDoubleClick={() => {
                        setSelectedSymbologyId(item.id);
                        onSelectSymbology(item.id);
                        onClose();
                      }}
                      className={`flex items-center gap-3 px-2 py-1 cursor-pointer select-none transition-colors ${
                        isSelected
                          ? 'bg-gradient-to-b from-[#fff7a0] to-[#fde047] text-slate-900 border border-dashed border-amber-500 font-medium'
                          : 'hover:bg-slate-100 text-slate-800'
                      }`}
                    >
                      {/* Barcode Mini Preview Icon */}
                      <div className="w-10 h-6 shrink-0 bg-white border border-slate-300 rounded-xs flex items-center justify-center p-0.5 overflow-hidden">
                        {item.is2D ? (
                          <div className="grid grid-cols-3 gap-0.5 w-4 h-4">
                            <div className="bg-black" />
                            <div className="bg-transparent" />
                            <div className="bg-black" />
                            <div className="bg-black" />
                            <div className="bg-black" />
                            <div className="bg-transparent" />
                            <div className="bg-transparent" />
                            <div className="bg-black" />
                            <div className="bg-black" />
                          </div>
                        ) : (
                          <div className="flex items-end gap-px h-4 w-8">
                            <span className="w-0.5 h-4 bg-black" />
                            <span className="w-1 h-3.5 bg-black" />
                            <span className="w-0.5 h-4 bg-black" />
                            <span className="w-1.5 h-3 bg-black" />
                            <span className="w-0.5 h-4 bg-black" />
                            <span className="w-1 h-3.5 bg-black" />
                          </div>
                        )}
                      </div>

                      {/* Symbology Name */}
                      <span className="text-[12px]">{item.name}</span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom: Preview Panel with Live Barcode */}
            <div className="flex-1 bg-white border border-[#94a3b8] rounded-xs flex flex-col p-1.5 overflow-hidden">
              <div className="text-[11px] text-slate-700 font-medium pb-1 border-b border-slate-100">
                Preview: {selectedMeta?.name || 'PosiCode B'}
              </div>

              <div className="flex-1 flex flex-col items-center justify-center p-1 bg-white overflow-hidden">
                <canvas
                  ref={previewCanvasRef}
                  className="max-h-[110px] max-w-[280px] object-contain"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Dialog Bottom Action Buttons */}
        <div className="flex items-center justify-end gap-2 px-3 py-2 bg-[#e4ebf5] border-t border-[#cbd5e1]">
          <button
            onClick={handleConfirm}
            className="px-6 py-1 bg-[#f0f9ff] hover:bg-sky-100 active:bg-sky-200 border border-[#0284c7] text-slate-900 rounded-xs text-[11.5px] font-medium shadow-xs focus:ring-1 focus:ring-sky-500"
          >
            Select
          </button>
          <button
            onClick={onClose}
            className="px-6 py-1 bg-white hover:bg-slate-100 active:bg-slate-200 border border-[#94a3b8] text-slate-800 rounded-xs text-[11.5px] shadow-xs"
          >
            Cancel
          </button>
          <button
            onClick={() =>
              alert(
                `${selectedMeta?.name}:\n\n${selectedMeta?.description}\n\nStandard Category: ${selectedMeta?.category}\nSample: ${selectedMeta?.defaultSample}`
              )
            }
            className="px-6 py-1 bg-white hover:bg-slate-100 active:bg-slate-200 border border-[#94a3b8] text-slate-800 rounded-xs text-[11.5px] shadow-xs"
          >
            Help
          </button>
        </div>
      </div>
    </div>
  );
};
