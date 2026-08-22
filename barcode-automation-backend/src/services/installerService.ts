import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

/**
 * Service to ensure valid physical Windows Executable (.exe) installers exist
 * in the downloads directory for immediate zero-error client downloads.
 */
export class InstallerService {
  private static instance: InstallerService;
  private downloadsDir: string;

  private constructor() {
    this.downloadsDir = path.resolve(process.cwd(), 'barcode-automation-backend/downloads');
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

      // Copy genuine executable into downloads
      const targetExe = path.join(this.downloadsDir, 'BarcodeFlow_Setup_v2.5.0.exe');
      const fallbackExe = path.join(this.downloadsDir, 'BarcodeFlow_Setup.exe');

      if (fs.existsSync(binExe)) {
        if (!fs.existsSync(targetExe) || fs.statSync(targetExe).size !== fs.statSync(binExe).size) {
          fs.copyFileSync(binExe, targetExe);
        }
        if (!fs.existsSync(fallbackExe) || fs.statSync(fallbackExe).size !== fs.statSync(binExe).size) {
          fs.copyFileSync(binExe, fallbackExe);
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

    const candidates = [
      path.join(this.downloadsDir, `BarcodeFlow_Setup_v${version}.exe`),
      path.resolve(process.cwd(), 'bin', `BarcodeFlow_Setup_v${version}.exe`),
      path.join(this.downloadsDir, 'BarcodeFlow_Setup.exe'),
      path.resolve(process.cwd(), 'dist-electron-build', `BarcodeFlow_Setup_v${version}.exe`),
      path.resolve(process.cwd(), 'dist-electron-build', 'BarcodeFlow_Setup.exe'),
    ];

    for (const cand of candidates) {
      if (fs.existsSync(cand)) {
        const stat = fs.statSync(cand);
        return {
          filePath: cand,
          fileName: `BarcodeFlow_Setup_v${version}.exe`,
          size: stat.size,
        };
      }
    }

    return null;
  }
}

export const installerService = InstallerService.getInstance();
