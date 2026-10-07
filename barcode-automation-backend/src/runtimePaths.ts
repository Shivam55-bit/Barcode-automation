import path from 'node:path';
import { existsSync } from 'node:fs';

export function getDataDirectory(): string {
  return path.resolve(process.env.BARCODEFLOW_DATA_DIR || path.join(process.cwd(), 'barcode-automation-backend', 'data'));
}

export function getDesktopDataDirectory(userDataDirectory: string, projectDirectory: string, isPackaged: boolean,
  environment: NodeJS.ProcessEnv = process.env): string {
  if (environment.BARCODEFLOW_USER_DATA_DIR) return path.resolve(environment.BARCODEFLOW_USER_DATA_DIR, 'data');
  if (environment.BARCODEFLOW_DATA_DIR) return path.resolve(environment.BARCODEFLOW_DATA_DIR);
  const workspaceData = path.join(projectDirectory, 'barcode-automation-backend', 'data');
  if (!isPackaged && existsSync(path.join(workspaceData, 'users.json'))) return workspaceData;
  return path.join(userDataDirectory, 'data');
}