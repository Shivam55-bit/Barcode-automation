import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

export const STANDARD_FONT_SIZES = [
  6, 7, 8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72,
];

interface FontSizeComboBoxProps {
  value: number;
  onChange: (newSize: number) => void;
  options?: number[];
  className?: string;
  title?: string;
  disabled?: boolean;
}

export const FontSizeComboBox: React.FC<FontSizeComboBoxProps> = ({
  value,
  onChange,
  options = STANDARD_FONT_SIZES,
  className = '',
  title = 'Font Size',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState<string>(String(Math.round(value * 10) / 10));
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [menuCoords, setMenuCoords] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 54,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Sync external value changes to input when dropdown is not actively being edited
  useEffect(() => {
    if (!isOpen) {
      setInputValue(String(Math.round(value * 10) / 10));
    }
  }, [value, isOpen]);

  // Update popup coordinates when opened or on scroll/resize
  const updateCoords = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setMenuCoords({
        top: rect.bottom + 1,
        left: rect.left,
        width: rect.width || 54,
      });
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      updateCoords();
      window.addEventListener('resize', updateCoords);
      window.addEventListener('scroll', updateCoords, true);
      return () => {
        window.removeEventListener('resize', updateCoords);
        window.removeEventListener('scroll', updateCoords, true);
      };
    }
  }, [isOpen, updateCoords]);

  // Click outside listener
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        listRef.current &&
        !listRef.current.contains(target)
      ) {
        if (isOpen) {
          commitInputValue();
          setIsOpen(false);
        }
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick, true);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick, true);
    };
  }, [isOpen, inputValue]);

  // Auto scroll to current or highlighted item on open
  useEffect(() => {
    if (isOpen && listRef.current) {
      const matchIndex = options.findIndex((s) => Math.abs(s - value) < 0.05);
      const targetIndex = highlightedIndex >= 0 ? highlightedIndex : matchIndex;
      if (targetIndex >= 0) {
        const itemEl = listRef.current.children[targetIndex] as HTMLElement;
        if (itemEl) {
          itemEl.scrollIntoView({ block: 'nearest' });
        }
      }
    }
  }, [isOpen]);

  const commitInputValue = useCallback(() => {
    const parsed = parseFloat(inputValue.trim());
    if (!isNaN(parsed) && parsed > 0 && parsed <= 720) {
      const formatted = Math.round(parsed * 10) / 10;
      setInputValue(String(formatted));
      onChange(formatted);
    } else {
      setInputValue(String(Math.round(value * 10) / 10));
    }
  }, [inputValue, onChange, value]);

  const handleSelectOption = (size: number) => {
    setInputValue(String(size));
    onChange(size);
    setIsOpen(false);
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        const idx = options.findIndex((s) => Math.abs(s - value) < 0.05);
        setHighlightedIndex(idx >= 0 ? Math.min(options.length - 1, idx + 1) : 0);
      } else {
        setHighlightedIndex((prev) => {
          const next = prev < options.length - 1 ? prev + 1 : 0;
          const itemEl = listRef.current?.children[next] as HTMLElement;
          itemEl?.scrollIntoView({ block: 'nearest' });
          return next;
        });
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        const idx = options.findIndex((s) => Math.abs(s - value) < 0.05);
        setHighlightedIndex(idx > 0 ? idx - 1 : 0);
      } else {
        setHighlightedIndex((prev) => {
          const next = prev > 0 ? prev - 1 : options.length - 1;
          const itemEl = listRef.current?.children[next] as HTMLElement;
          itemEl?.scrollIntoView({ block: 'nearest' });
          return next;
        });
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen && highlightedIndex >= 0 && highlightedIndex < options.length) {
        handleSelectOption(options[highlightedIndex]);
      } else {
        commitInputValue();
        setIsOpen(false);
      }
      inputRef.current?.blur();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setInputValue(String(Math.round(value * 10) / 10));
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-stretch select-none shrink-0 ${className}`}
      title={title}
    >
      {/* Combobox frame - classic desktop styling with gold border on focus/open */}
      <div
        className={`h-6.5 flex items-stretch bg-white rounded-[2px] transition-colors shadow-2xs border ${
          isOpen
            ? 'border-[#E5C365] ring-1 ring-[#F2C744]/40'
            : 'border-slate-300 hover:border-slate-400'
        } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
        style={{ width: '54px' }}
      >
        {/* Editable input */}
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={inputValue}
          disabled={disabled}
          onChange={(e) => setInputValue(e.target.value)}
          onClick={() => {
            inputRef.current?.select();
          }}
          onFocus={() => {
            inputRef.current?.select();
          }}
          onBlur={() => {
            if (!isOpen) {
              commitInputValue();
            }
          }}
          onKeyDown={handleKeyDown}
          className="w-[34px] px-1 text-center text-xs font-sans text-slate-900 bg-transparent outline-none cursor-text font-normal selection:bg-[#0078D7] selection:text-white"
        />

        {/* Dropdown toggle button with classic desktop gold accent */}
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={() => {
            if (!isOpen) {
              const idx = options.findIndex((s) => Math.abs(s - value) < 0.05);
              setHighlightedIndex(idx >= 0 ? idx : -1);
              updateCoords();
              setIsOpen(true);
              inputRef.current?.focus();
              inputRef.current?.select();
            } else {
              setIsOpen(false);
            }
          }}
          className={`w-[18px] flex items-center justify-center cursor-pointer transition-colors border-l ${
            isOpen
              ? 'bg-[#FFF6D6] border-[#E5C365] text-amber-950'
              : 'bg-slate-50/80 hover:bg-[#FFF9E6] hover:border-[#E5C365] border-slate-200 text-slate-800'
          }`}
          title="Toggle font size dropdown"
        >
          {/* Classic down arrow */}
          <svg
            className="w-2.5 h-2 fill-current"
            viewBox="0 0 10 6"
            xmlns="http://www.w3.org/2000/svg"
          >
            <polygon points="1,1 9,1 5,5" />
          </svg>
        </button>
      </div>

      {/* Classic Desktop Dropdown Menu matching user screenshot using React Portal */}
      {isOpen &&
        createPortal(
          <div
            ref={listRef}
            className="fixed max-h-[220px] overflow-y-auto bg-white border border-[#7F9DB9] shadow-lg z-[999999] py-0.5 rounded-[1px] text-[12px] font-sans"
            style={{
              top: `${menuCoords.top}px`,
              left: `${menuCoords.left}px`,
              width: `${menuCoords.width}px`,
              scrollbarWidth: 'thin',
              scrollbarColor: '#A0A0A0 #F1F1F1',
            }}
          >
            {options.map((opt, idx) => {
              const isSelected = Math.abs(opt - value) < 0.05;
              const isHovered = highlightedIndex === idx;
              const active = isHovered || (highlightedIndex === -1 && isSelected);

              return (
                <div
                  key={opt}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  onClick={() => handleSelectOption(opt)}
                  className={`px-2 py-[2.5px] cursor-pointer text-left text-[12px] leading-tight select-none transition-none ${
                    active
                      ? 'bg-[#0078D7] text-white font-normal'
                      : 'text-black bg-white hover:bg-[#0078D7] hover:text-white'
                  }`}
                >
                  {opt}
                </div>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
};
