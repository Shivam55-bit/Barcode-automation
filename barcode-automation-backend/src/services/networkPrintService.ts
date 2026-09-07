import net from 'net';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface PrintTransmissionResult {
  success: boolean;
  bytesWritten: number;
  message: string;
  error?: string;
  destination: 'tcp' | 'spooler' | 'virtual';
}

export interface DiscoveredPrinter {
  name: string;
  isDefault: boolean;
  status: 'online' | 'busy' | 'offline';
  driverName?: string;
  portName?: string;
  protocol: 'zpl' | 'tspl' | 'epl' | 'escpos' | 'pdf';
  isThermal: boolean;
}

export class NetworkPrintService {
  private static instance: NetworkPrintService;

  public static getInstance(): NetworkPrintService {
    if (!NetworkPrintService.instance) {
      NetworkPrintService.instance = new NetworkPrintService();
    }
    return NetworkPrintService.instance;
  }

  /**
   * Directly transmits raw print instructions (ZPL, TSPL, EPL, ESC/POS) over raw TCP socket
   * Standard industrial barcode printer port is 9100 (HP JetDirect / Raw TCP protocol)
   */
  public async sendRawToTcp(
    ip: string,
    port: number = 9100,
    data: string | Buffer,
    timeoutMs: number = 4000
  ): Promise<PrintTransmissionResult> {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf-8');

    return new Promise<PrintTransmissionResult>((resolve) => {
      let isSettled = false;
      const socket = new net.Socket();

      const finish = (result: PrintTransmissionResult) => {
        if (!isSettled) {
          isSettled = true;
          try {
            socket.destroy();
          } catch (_) {
            // ignore cleanup errors
          }
          resolve(result);
        }
      };

      socket.setTimeout(timeoutMs);

      socket.connect(port, ip, () => {
        socket.write(buffer, () => {
          socket.end();
          finish({
            success: true,
            bytesWritten: buffer.length,
            message: `Successfully transmitted ${buffer.length} bytes to ${ip}:${port}`,
            destination: 'tcp',
          });
        });
      });

      socket.on('timeout', () => {
        finish({
          success: false,
          bytesWritten: 0,
          error: `Connection to printer at ${ip}:${port} timed out after ${timeoutMs}ms`,
          message: `Printer hardware at ${ip}:${port} did not acknowledge connection within ${timeoutMs}ms.`,
          destination: 'tcp',
        });
      });

      socket.on('error', (err: any) => {
        finish({
          success: false,
          bytesWritten: 0,
          error: err.code || err.message,
          message: `Network transmission failed to ${ip}:${port} (${err.code || err.message})`,
          destination: 'tcp',
        });
      });
    });
  }

  /**
   * Cross-platform check whether a network printer socket is actively listening
   */
  public async probeTcpPrinterStatus(
    ip: string,
    port: number = 9100,
    timeoutMs: number = 1500
  ): Promise<'online' | 'offline' | 'busy'> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      let resolved = false;

      const finish = (status: 'online' | 'offline' | 'busy') => {
        if (!resolved) {
          resolved = true;
          socket.destroy();
          resolve(status);
        }
      };

      socket.setTimeout(timeoutMs);

      socket.connect(port, ip, () => {
        finish('online');
      });

      socket.on('timeout', () => {
        finish('offline');
      });

      socket.on('error', () => {
        finish('offline');
      });
    });
  }

  /**
   * Sends raw print bytes to the local OS Print Spooler (macOS/Linux CUPS or Windows Spooler)
   */
  public async sendToOsSpooler(
    printerName: string,
    data: string | Buffer
  ): Promise<PrintTransmissionResult> {
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf-8');
    const tempFilePath = path.join(
      os.tmpdir(),
      `barcodeflow_spool_${Date.now()}_${Math.floor(Math.random() * 10000)}.prn`
    );

    try {
      await fs.promises.writeFile(tempFilePath, buffer);

      if (process.platform === 'win32') {
        // Windows raw printing via PowerShell
        const escapedName = printerName.replace(/'/g, "''");
        const escapedFile = tempFilePath.replace(/'/g, "''");
        const psCmd = `powershell -Command "Get-Content -Path '${escapedFile}' -Raw -Encoding Byte | Out-Printer -Name '${escapedName}'"`;
        await execAsync(psCmd);
      } else {
        // macOS and Linux via CUPS 'lp' command with raw passthrough flag
        const escapedName = printerName.replace(/"/g, '\\"');
        const lpCmd = `lp -d "${escapedName}" -o raw "${tempFilePath}"`;
        await execAsync(lpCmd);
      }

      return {
        success: true,
        bytesWritten: buffer.length,
        message: `Successfully spooled ${buffer.length} bytes to local printer "${printerName}"`,
        destination: 'spooler',
      };
    } catch (err: any) {
      return {
        success: false,
        bytesWritten: 0,
        error: err.message,
        message: `Local OS spooling failed for printer "${printerName}": ${err.message}`,
        destination: 'spooler',
      };
    } finally {
      // Clean up temp file
      fs.promises.unlink(tempFilePath).catch(() => {});
    }
  }

  /**
   * Discovers installed printers across Windows, macOS, and Linux
   */
  public async discoverInstalledPrinters(): Promise<DiscoveredPrinter[]> {
    const results: DiscoveredPrinter[] = [];

    if (process.platform === 'win32') {
      try {
        const psCommand = `powershell -Command "Get-Printer | Select-Object Name, PrinterStatus, DriverName, PortName, IsDefault | ConvertTo-Json"`;
        const { stdout } = await execAsync(psCommand);
        if (stdout.trim()) {
          const parsed = JSON.parse(stdout);
          const list = Array.isArray(parsed) ? parsed : [parsed];

          for (const p of list) {
            const name = p.Name || 'Printer';
            const lower = name.toLowerCase();
            const isZebra = lower.includes('zebra') || lower.includes('zt') || lower.includes('zd');
            const isTsc = lower.includes('tsc');
            const isBrother = lower.includes('brother');
            const isThermal = isZebra || isTsc || isBrother || lower.includes('thermal') || lower.includes('label');

            let protocol: 'zpl' | 'tspl' | 'epl' | 'escpos' | 'pdf' = 'zpl';
            if (isTsc) protocol = 'tspl';
            else if (lower.includes('epl')) protocol = 'epl';
            else if (lower.includes('pos') || lower.includes('receipt')) protocol = 'escpos';
            else if (lower.includes('pdf')) protocol = 'pdf';

            results.push({
              name,
              isDefault: !!p.IsDefault,
              status: p.PrinterStatus === 0 || p.PrinterStatus === 3 ? 'online' : 'offline',
              driverName: p.DriverName,
              portName: p.PortName,
              protocol,
              isThermal,
            });
          }
        }
      } catch (err) {
        console.warn('[NetworkPrintService] Windows printer discovery error:', err);
      }
    } else {
      // macOS and Linux CUPS lpstat
      try {
        const { stdout: statOut } = await execAsync('lpstat -p -d');
        const lines = statOut.split('\n');

        let defaultPrinterName = '';
        for (const line of lines) {
          if (line.startsWith('system default destination:')) {
            defaultPrinterName = line.replace('system default destination:', '').trim();
          }
        }

        for (const line of lines) {
          if (line.startsWith('printer ')) {
            const parts = line.split(' ');
            const printerName = parts[1];
            if (!printerName) continue;

            const isIdle = line.includes('is idle');
            const isPrinting = line.includes('is printing') || line.includes('processing');
            const status: 'online' | 'busy' | 'offline' = isPrinting ? 'busy' : isIdle ? 'online' : 'offline';

            const lower = printerName.toLowerCase();
            const isZebra = lower.includes('zebra') || lower.includes('zt') || lower.includes('zd');
            const isTsc = lower.includes('tsc');
            const isBrother = lower.includes('brother');
            const isThermal = isZebra || isTsc || isBrother || lower.includes('label') || lower.includes('thermal');

            let protocol: 'zpl' | 'tspl' | 'epl' | 'escpos' | 'pdf' = 'zpl';
            if (isTsc) protocol = 'tspl';
            else if (lower.includes('epl')) protocol = 'epl';
            else if (lower.includes('pos') || lower.includes('receipt')) protocol = 'escpos';
            else if (lower.includes('pdf')) protocol = 'pdf';

            results.push({
              name: printerName,
              isDefault: printerName === defaultPrinterName,
              status,
              protocol,
              isThermal,
            });
          }
        }
      } catch (err) {
        console.warn('[NetworkPrintService] Unix/macOS lpstat discovery error:', err);
      }
    }

    return results;
  }

  /**
   * Intelligently routes and transmits a print job to the target printer
   */
  public async dispatchJob(
    printer: any,
    rawOutput: string | Buffer
  ): Promise<PrintTransmissionResult> {
    const isIpDefined =
      printer.ipAddress &&
      printer.ipAddress !== '127.0.0.1' &&
      printer.ipAddress !== 'localhost' &&
      !printer.ipAddress.startsWith('Virtual') &&
      !printer.ipAddress.startsWith('USB');

    // Case 1: Direct Network TCP Printer (port 9100)
    if (isIpDefined && printer.port) {
      const tcpResult = await this.sendRawToTcp(printer.ipAddress, Number(printer.port), rawOutput);
      return tcpResult;
    }

    // Case 2: Local OS Spooler Printer (driverName or OS discovered printer)
    if (printer.driverName || printer.name) {
      const spoolResult = await this.sendToOsSpooler(printer.name, rawOutput);
      return spoolResult;
    }

    // Case 3: Virtual Spooler (file write / dry run)
    const length = Buffer.isBuffer(rawOutput) ? rawOutput.length : Buffer.from(rawOutput).length;
    return {
      success: true,
      bytesWritten: length,
      message: `Spooled ${length} bytes to virtual printer engine (${printer.name || 'Default'})`,
      destination: 'virtual',
    };
  }
}
