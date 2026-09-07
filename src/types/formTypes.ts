export type FormControlType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'dropdown'
  | 'date'
  | 'checkbox'
  | 'scanner'
  | 'datasetPicker';

export interface FormControlValidation {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  patternErrorMessage?: string;
}

export interface FormControlOption {
  label: string;
  value: string;
}

export interface DataEntryFormControl {
  id: string;
  type: FormControlType;
  label: string;
  boundField: string; // The variable name or element name/id to update
  placeholder?: string;
  defaultValue?: string | number | boolean;
  helpText?: string;
  options?: FormControlOption[]; // For dropdown
  readOnly?: boolean;
  colSpan?: 1 | 2; // 1 = half width, 2 = full width in a 2-column layout
  order: number;
  validation?: FormControlValidation;
  autoFocus?: boolean;
}

export interface DataEntryFormDefinition {
  id: string;
  title: string;
  description?: string;
  controls: DataEntryFormControl[];
  showPreview: boolean;
  promptBeforePrint: boolean;
  autoSubmitOnScan: boolean;
  defaultCopies: number;
}
