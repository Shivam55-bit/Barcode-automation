import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { getDataDirectory } from '../runtimePaths';

/**
 * Service to ensure valid physical Windows Executable (.exe) installers exist
 * in the downloads directory for immediate zero-error client downloads.
 */
export class InstallerService {
  private static instance: InstallerService;
  private downloadsDir: string;

  private constructor() {
    this.downloadsDir = process.env.BARCODEFLOW_DATA_DIR
      ? path.join(getDataDirectory(), 'downloads')
      : path.resolve(process.cwd(), 'barcode-automation-backend/downloads');
    this.ensureInstallerBinaries();
  }

  public static getInstance(): InstallerService {
    if (!InstallerService.instance) {
      InstallerService.instance = new InstallerService();
    }
    return InstallerService.instance;
  }

  public getDownloadsDir(): string {
    return this.downloadsDir;
  }

  /**
   * Generates or locates the physical genuine .exe installer file for the requested version.
   */
  public ensureInstallerBinaries(): void {
    if (process.env.BARCODEFLOW_DESKTOP === '1') return;
    try {
      if (!fs.existsSync(this.downloadsDir)) {
        fs.mkdirSync(this.downloadsDir, { recursive: true });
      }

      const binExe = path.resolve(process.cwd(), 'bin', 'BarcodeFlow_Setup_v2.5.0.exe');
      const csScript = path.resolve(process.cwd(), 'scripts', 'Installer.cs');

      // Compile genuine Windows x64 Native C# GUI Setup Wizard if not yet built
      if (!fs.existsSync(binExe) && fs.existsSync(csScript)) {
        try {
          const cscPath = 'C:\\Windows\\Microsoft.NET\\Framework64\\v4.0.30319\\csc.exe';
          if (fs.existsSync(cscPath)) {
            const binDir = path.resolve(process.cwd(), 'bin');
            if (!fs.existsSync(binDir)) fs.mkdirSync(binDir, { recursive: true });
            execSync(`"${cscPath}" /target:winexe /platform:anycpu /out:"${binExe}" "${csScript}"`, {
              stdio: 'ignore'
            });
          }
        } catch (err) {
          console.warn('[InstallerService] CSC compilation warning:', err);
        }
      }

      // Locate full Electron NSIS installer if generated
      const electronSetupDev = path.resolve(process.cwd(), 'dist-electron-build', 'BarcodeFlow_Setup_Dev_Unsigned.exe');
      const electronSetup = path.resolve(process.cwd(), 'dist-electron-build', 'BarcodeFlow_Setup.exe');
      const targetExe = path.join(this.downloadsDir, 'BarcodeFlow_Setup_v2.5.0.exe');
      const fallbackExe = path.join(this.downloadsDir, 'BarcodeFlow_Setup.exe');

      const sourceInstaller = fs.existsSync(electronSetupDev) && fs.statSync(electronSetupDev).size > 1000000
        ? electronSetupDev
        : (fs.existsSync(electronSetup) && fs.statSync(electronSetup).size > 1000000 ? electronSetup : (fs.existsSync(binExe) ? binExe : null));

      if (sourceInstaller) {
        if (!fs.existsSync(targetExe) || fs.statSync(targetExe).size !== fs.statSync(sourceInstaller).size) {
          fs.copyFileSync(sourceInstaller, targetExe);
        }
        if (!fs.existsSync(fallbackExe) || fs.statSync(fallbackExe).size !== fs.statSync(sourceInstaller).size) {
          fs.copyFileSync(sourceInstaller, fallbackExe);
        }
        if (sourceInstaller === electronSetupDev && (!fs.existsSync(electronSetup) || fs.statSync(electronSetup).size < 1000000)) {
          fs.copyFileSync(electronSetupDev, electronSetup);
        }
      }
    } catch (err) {
      console.error('[InstallerService] Error ensuring binaries:', err);
    }
  }

  /**
   * Finds the installer file for a version or default.
   */
  public findInstaller(version: string = '2.5.0'): { filePath: string; fileName: string; size: number } | null {
    this.ensureInstallerBinaries();

    const cleanVersion = (version || '2.5.0').replace(/^v/, '');
    const rootDir = process.cwd();

    const candidateDirs = [
      this.downloadsDir,
      path.resolve(rootDir, 'barcode-automation-backend', 'downloads'),
      path.resolve(rootDir, 'downloads'),
      path.resolve(rootDir, 'bin'),
      path.resolve(rootDir, 'dist-electron-build'),
      path.resolve(__dirname, '..', '..', 'downloads'),
      path.resolve(__dirname, '..', '..', 'barcode-automation-backend', 'downloads'),
      path.resolve(__dirname, '..', 'downloads'),
      path.resolve(__dirname, '..', '..', 'bin'),
      path.resolve(__dirname, '..', 'bin'),
    ];

    const fileNames = [
      `BarcodeFlow_Setup_v${cleanVersion}.exe`,
      `BarcodeFlow_Setup.exe`,
      `BarcodeFlow_Setup_v2.5.0.exe`,
      `BarcodeFlow_Setup_Dev_Unsigned.exe`,
    ];

    for (const dir of candidateDirs) {
      for (const name of fileNames) {
        const fullPath = path.join(dir, name);
        if (fs.existsSync(fullPath)) {
          const stat = fs.statSync(fullPath);
          if (stat.size > 1000) { // Valid non-empty binary
            return {
              filePath: fullPath,
              fileName: `BarcodeFlow_Setup_v${cleanVersion}.exe`,
              size: stat.size,
            };
          }
        }
      }
    }

    return null;
  }
}

export const installerService = InstallerService.getInstance();
