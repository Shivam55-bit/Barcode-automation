import React from 'react';
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  ArrowUpToLine,
  ArrowDownToLine,
  MoveVertical,
  MoveHorizontal,
  RotateCw,
  Layers,
  ArrowUp,
  ArrowDown,
  Lock,
  Unlock,
  Maximize,
  Minimize,
  Grid,
} from 'lucide-react';

interface RightVerticalToolbarProps {
  onAlign: (alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void;
  onDistribute: (axis: 'horizontal' | 'vertical') => void;
  onRotate: (deltaDeg: number) => void;
  onCenterPage: (axis: 'h' | 'v' | 'both') => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onLockToggle: () => void;
  hasSelection: boolean;
  isLocked?: boolean;
}

export const RightVerticalToolbar: React.FC<RightVerticalToolbarProps> = (props) => {
  return (
    <div className="w-8 bg-[#e8edf5] border-l border-[#cbd5e1] flex flex-col items-center py-1.5 gap-1 select-none z-20 text-slate-700 shadow-xs">
      {/* Up/Down ordering */}
      <VerticalBtn
        icon={<ArrowUp className="w-3.5 h-3.5" />}
        title="Bring Forward (Ctrl+])"
        disabled={!props.hasSelection}
        onClick={props.onBringToFront}
      />
      <VerticalBtn
        icon={<ArrowDown className="w-3.5 h-3.5" />}
        title="Send Backward (Ctrl+[)"
        disabled={!props.hasSelection}
        onClick={props.onSendToBack}
      />

      <VDivider />

      {/* Horizontal Alignment */}
      <VerticalBtn
        icon={<AlignLeft className="w-3.5 h-3.5 text-blue-700" />}
        title="Align Left Edges"
        disabled={!props.hasSelection}
        onClick={() => props.onAlign('left')}
      />
      <VerticalBtn
        icon={<AlignCenter className="w-3.5 h-3.5 text-blue-700" />}
        title="Align Horizontal Centers"
        disabled={!props.hasSelection}
        onClick={() => props.onAlign('center')}
      />
      <VerticalBtn
        icon={<AlignRight className="w-3.5 h-3.5 text-blue-700" />}
        title="Align Right Edges"
        disabled={!props.hasSelection}
        onClick={() => props.onAlign('right')}
      />

      <VDivider />

      {/* Vertical Alignment */}
      <VerticalBtn
        icon={<ArrowUpToLine className="w-3.5 h-3.5 text-indigo-700" />}
        title="Align Top Edges"
        disabled={!props.hasSelection}
        onClick={() => props.onAlign('top')}
      />
      <VerticalBtn
        icon={<MoveVertical className="w-3.5 h-3.5 text-indigo-700" />}
        title="Align Vertical Centers"
        disabled={!props.hasSelection}
        onClick={() => props.onAlign('middle')}
      />
      <VerticalBtn
        icon={<ArrowDownToLine className="w-3.5 h-3.5 text-indigo-700" />}
        title="Align Bottom Edges"
        disabled={!props.hasSelection}
        onClick={() => props.onAlign('bottom')}
      />

      <VDivider />

      {/* Center on Label */}
      <VerticalBtn
        icon={
          <div className="flex items-center justify-center font-mono text-[9px] font-bold text-slate-800">
            [ | ]
          </div>
        }
        title="Center Horizontally on Label"
        disabled={!props.hasSelection}
        onClick={() => props.onCenterPage('h')}
      />
      <VerticalBtn
        icon={
          <div className="flex items-center justify-center font-mono text-[9px] font-bold text-slate-800">
            [—]
          </div>
        }
        title="Center Vertically on Label"
        disabled={!props.hasSelection}
        onClick={() => props.onCenterPage('v')}
      />

      <VDivider />

      {/* Distribution */}
      <VerticalBtn
        icon={<MoveHorizontal className="w-3.5 h-3.5 text-emerald-700" />}
        title="Distribute Horizontally Across Label"
        disabled={!props.hasSelection}
        onClick={() => props.onDistribute('horizontal')}
      />
      <VerticalBtn
        icon={<MoveVertical className="w-3.5 h-3.5 text-emerald-700" />}
        title="Distribute Vertically Across Label"
        disabled={!props.hasSelection}
        onClick={() => props.onDistribute('vertical')}
      />

      <VDivider />

      {/* Rotation */}
      <VerticalBtn
        icon={<RotateCw className="w-3.5 h-3.5 text-amber-700" />}
        title="Rotate 90°"
        disabled={!props.hasSelection}
        onClick={() => props.onRotate(90)}
      />

      <VDivider />

      {/* Lock */}
      <VerticalBtn
        icon={props.isLocked ? <Lock className="w-3.5 h-3.5 text-red-600" /> : <Unlock className="w-3.5 h-3.5 text-slate-500" />}
        title="Lock / Unlock Object Position"
        disabled={!props.hasSelection}
        onClick={props.onLockToggle}
      />
    </div>
  );
};

const VerticalBtn: React.FC<{
  icon: React.ReactNode;
  title: string;
  disabled?: boolean;
  onClick: () => void;
}> = ({ icon, title, disabled, onClick }) => {
  return (
    <button
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`w-6 h-6 rounded-xs flex items-center justify-center transition-colors ${
        disabled ? 'opacity-30 cursor-not-allowed' : 'hover:bg-[#d5e0ee] active:bg-[#c4d4e6] text-slate-700'
      }`}
    >
      {icon}
    </button>
  );
};

const VDivider: React.FC = () => <div className="w-4 h-px bg-[#cbd5e1] my-0.5" />;
