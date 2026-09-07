import React from 'react';
import { UnitType } from '../../types';

interface RulersProps {
  widthMm: number;
  heightMm: number;
  zoom: number;
  unit: UnitType;
  cursorX: number; // in mm
  cursorY: number; // in mm
  panX: number;
  panY: number;
  onAddGuide?: (type: 'horizontal' | 'vertical', position: number) => void;
}

export const HorizontalRuler: React.FC<RulersProps> = ({
  widthMm,
  zoom,
  cursorX,
  panX,
  onAddGuide,
}) => {
  // 1mm in base screen px at 100% zoom is approx 3.78px (96 DPI / 25.4)
  const pxPerMm = 3.7795 * zoom;
  const totalLengthMm = Math.max(widthMm + 60, 240);

  const ticks: React.ReactNode[] = [];

  for (let mm = -30; mm <= totalLengthMm; mm += 1) {
    const isMajor = mm % 10 === 0;
    const isMedium = mm % 5 === 0;
    const pos = mm * pxPerMm + panX;

    if (pos < -50 || pos > window.innerWidth) continue;

    ticks.push(
      <div
        key={`h-tick-${mm}`}
        className="absolute bottom-0 border-l border-slate-400 select-none pointer-events-none"
        style={{
          left: `${pos}px`,
          height: isMajor ? '13px' : isMedium ? '8px' : '4px',
        }}
      >
        {isMajor && (
          <span className="absolute left-0.5 top-0 text-[8.5px] font-sans font-medium text-slate-700 select-none">
            {mm}
          </span>
        )}
      </div>
    );
  }

  const cursorScreenPos = cursorX * pxPerMm + panX;

  return (
    <div
      className="h-5 bg-[#e4ebf5] border-b border-[#cbd5e1] relative overflow-hidden select-none cursor-crosshair"
      title="Click and drag to pull a vertical guide"
      onClick={(e) => {
        if (onAddGuide) {
          const rect = e.currentTarget.getBoundingClientRect();
          const clickMm = (e.clientX - rect.left - panX) / pxPerMm;
          onAddGuide('vertical', Math.round(clickMm));
        }
      }}
    >
      {ticks}
      {/* Dynamic Cursor Marker */}
      <div
        className="absolute top-0 bottom-0 w-px bg-red-600 z-10 pointer-events-none"
        style={{ left: `${cursorScreenPos}px` }}
      />
      {/* mm indicator badge on top right */}
      <div className="absolute right-1 top-0.5 text-[8.5px] font-bold text-slate-600 bg-[#d5e0ee] px-1 rounded-2xs pointer-events-none select-none">
        mm
      </div>
    </div>
  );
};

export const VerticalRuler: React.FC<RulersProps> = ({
  heightMm,
  zoom,
  cursorY,
  panY,
  onAddGuide,
}) => {
  const pxPerMm = 3.7795 * zoom;
  const totalLengthMm = Math.max(heightMm + 60, 200);

  const ticks: React.ReactNode[] = [];

  for (let mm = -30; mm <= totalLengthMm; mm += 1) {
    const isMajor = mm % 10 === 0;
    const isMedium = mm % 5 === 0;
    const pos = mm * pxPerMm + panY;

    if (pos < -50 || pos > window.innerHeight) continue;

    ticks.push(
      <div
        key={`v-tick-${mm}`}
        className="absolute right-0 border-t border-slate-400 select-none pointer-events-none"
        style={{
          top: `${pos}px`,
          width: isMajor ? '13px' : isMedium ? '8px' : '4px',
        }}
      >
        {isMajor && (
          <span className="absolute left-0.5 -top-2.5 text-[8.5px] font-sans font-medium text-slate-700 select-none origin-top-left">
            {mm}
          </span>
        )}
      </div>
    );
  }

  const cursorScreenPos = cursorY * pxPerMm + panY;

  return (
    <div
      className="w-5 bg-[#e4ebf5] border-r border-[#cbd5e1] relative overflow-hidden select-none cursor-crosshair shrink-0"
      title="Click and drag to pull a horizontal guide"
      onClick={(e) => {
        if (onAddGuide) {
          const rect = e.currentTarget.getBoundingClientRect();
          const clickMm = (e.clientY - rect.top - panY) / pxPerMm;
          onAddGuide('horizontal', Math.round(clickMm));
        }
      }}
    >
      {ticks}
      {/* Dynamic Cursor Marker */}
      <div
        className="absolute left-0 right-0 h-px bg-red-600 z-10 pointer-events-none"
        style={{ top: `${cursorScreenPos}px` }}
      />
    </div>
  );
};
