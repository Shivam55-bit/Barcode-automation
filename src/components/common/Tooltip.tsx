import React, { useState } from 'react';

interface TooltipProps {
  content: string;
  shortcut?: string;
  children: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
}

export const Tooltip: React.FC<TooltipProps> = ({
  content,
  shortcut,
  children,
  side = 'top',
}) => {
  const [visible, setVisible] = useState(false);

  const sideClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-1.5',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-1.5',
    left: 'right-full top-1/2 -translate-y-1/2 mr-1.5',
    right: 'left-full top-1/2 -translate-y-1/2 ml-1.5',
  }[side];

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <div
          className={`absolute z-50 pointer-events-none whitespace-nowrap bg-slate-900 text-white text-xs px-2 py-1 rounded shadow-md font-medium flex items-center gap-1.5 ${sideClasses}`}
        >
          <span>{content}</span>
          {shortcut && (
            <kbd className="px-1 py-0.2 bg-slate-800 text-[10px] text-slate-300 rounded border border-slate-700">
              {shortcut}
            </kbd>
          )}
        </div>
      )}
    </div>
  );
};
