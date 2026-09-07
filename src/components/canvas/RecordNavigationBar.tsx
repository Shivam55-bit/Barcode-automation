import React from 'react';
import { DatabaseConnectionConfig, LabelTemplate } from '../../types';
import { RecordNavigator } from './RecordNavigator';

export interface RecordNavigationBarProps {
  connection?: DatabaseConnectionConfig;
  template?: LabelTemplate;
  currentIndex?: number;
  currentRecordIndex?: number;
  totalRecords?: number;
  filteredCount?: number;
  unfilteredTotal?: number;
  isLoading?: boolean;
  selectedCount?: number;
  currentRecordData?: Record<string, any>;
  onSelectIndex?: (index: number) => void;
  onSelectRecordIndex?: (index: number) => void;
  onOpenDatabaseModal?: () => void;
  onOpenDataConnector?: () => void;
  onImportCSV?: () => void;
  onOpenRecordBrowser?: () => void;
  onRefresh?: () => void;
  onSearchFilterChange?: (query: string) => void;
  searchFilter?: string;
}

export const RecordNavigationBar: React.FC<RecordNavigationBarProps> = ({
  connection,
  template,
  currentIndex,
  currentRecordIndex,
  totalRecords,
  filteredCount,
  unfilteredTotal,
  isLoading = false,
  selectedCount = 0,
  currentRecordData,
  onSelectIndex,
  onSelectRecordIndex,
  onOpenDatabaseModal,
  onOpenDataConnector,
  onImportCSV,
  onOpenRecordBrowser,
  onRefresh,
  onSearchFilterChange,
  searchFilter,
}) => {
  const activeIndex = currentIndex ?? currentRecordIndex ?? 0;
  const handleSelect = onSelectIndex || onSelectRecordIndex || (() => {});
  const handleOpenDB = onOpenDataConnector || onOpenDatabaseModal || onImportCSV;

  const sampleRecs = template?.sampleRecords || [];
  const connRecords = connection?.records || [];
  const records = connRecords.length > 0 ? connRecords : sampleRecs;
  const total = totalRecords ?? records.length;
  const activeRecordData = currentRecordData || records[activeIndex] || {};

  return (
    <RecordNavigator
      currentRecordIndex={activeIndex}
      totalRecords={total}
      filteredCount={filteredCount}
      unfilteredTotal={unfilteredTotal}
      isLoading={isLoading}
      selectedCount={selectedCount}
      connection={connection}
      currentRecordData={activeRecordData}
      onFirst={() => handleSelect(0)}
      onPrevious={() => handleSelect(Math.max(0, activeIndex - 1))}
      onNext={() => handleSelect(Math.min(total - 1, activeIndex + 1))}
      onLast={() => handleSelect(Math.max(0, total - 1))}
      onGoToRecord={(humanNum) => handleSelect(humanNum - 1)}
      onRefresh={onRefresh}
      onOpenRecordBrowser={onOpenRecordBrowser}
      onOpenDataConnector={handleOpenDB}
      onSearchFilterChange={onSearchFilterChange}
      searchFilter={searchFilter}
    />
  );
};

export { RecordNavigator };
