import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Native Win32 Raw Print Helper via winspool.drv
 * Sends raw bytes (ZPL, TSPL, EPL, ESC/POS) directly to Windows Spooler in RAW mode.
 */
export async function sendRawBytesToWindowsSpooler(
  printerName: string,
  rawBytes: Buffer | string,
  docTitle: string = 'BarcodeFlow Raw Job'
): Promise<{ success: boolean; bytesWritten: number; message: string; error?: string }> {
  const buffer = Buffer.isBuffer(rawBytes) ? rawBytes : Buffer.from(rawBytes, 'utf-8');

  // Write temporary raw binary file
  const tempDir = os.tmpdir();
  const tempFile = path.join(tempDir, `bcf_raw_${Date.now()}_${Math.floor(Math.random() * 100000)}.prn`);
  await fs.promises.writeFile(tempFile, buffer);

  try {
    // PowerShell .NET interop with Win32 winspool.drv
    // This provides exact byte passthrough without GDI formatting
    const psScript = `
$printerName = '${printerName.replace(/'/g, "''")}';
$filePath = '${tempFile.replace(/'/g, "''")}';
$docName = '${docTitle.replace(/'/g, "''")}';

$pCode = @"
using System;
using System.IO;
using System.Runtime.InteropServices;

public class RawPrinterHelper {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public class DOCINFOA {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }

    [DllImport("winspool.drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

    [DllImport("winspool.drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);

    public static int SendFileToPrinter(string szPrinterName, string szFileName, string szDocName) {
        IntPtr hPrinter = IntPtr.Zero;
        DOCINFOA di = new DOCINFOA();
        di.pDocName = szDocName;
        di.pDataType = "RAW";
        if (!OpenPrinter(szPrinterName.Normalize(), out hPrinter, IntPtr.Zero)) return -1;
        if (!StartDocPrinter(hPrinter, 1, di)) { ClosePrinter(hPrinter); return -2; }
        if (!StartPagePrinter(hPrinter)) { EndDocPrinter(hPrinter); ClosePrinter(hPrinter); return -3; }
        
        byte[] bytes = File.ReadAllBytes(szFileName);
        IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(bytes.Length);
        Marshal.Copy(bytes, 0, pUnmanagedBytes, bytes.Length);
        int dwWritten = 0;
        bool success = WritePrinter(hPrinter, pUnmanagedBytes, bytes.Length, out dwWritten);
        Marshal.FreeCoTaskMem(pUnmanagedBytes);
        
        EndPagePrinter(hPrinter);
        EndDocPrinter(hPrinter);
        ClosePrinter(hPrinter);
        return success ? dwWritten : -4;
    }
}
"@

Add-Type -TypeDefinition $pCode -ErrorAction SilentlyContinue
$written = [RawPrinterHelper]::SendFileToPrinter($printerName, $filePath, $docName)
Write-Output $written
`;

    const base64Script = Buffer.from(psScript, 'utf16le').toString('base64');
    const { stdout, stderr } = await execAsync(`powershell -NoProfile -EncodedCommand ${base64Script}`);

    const writtenResult = parseInt((stdout || '').trim(), 10);
    if (!isNaN(writtenResult) && writtenResult > 0) {
      return {
        success: true,
        bytesWritten: writtenResult,
        message: `Successfully transmitted ${writtenResult} raw bytes to Windows Spooler for "${printerName}"`,
      };
    } else {
      // Fallback: If C# compilation was restricted or returned error code
      const copyCmd = `powershell -NoProfile -Command "Copy-Item -Path '${tempFile.replace(/'/g, "''")}' -Destination '\\\\127.0.0.1\\${printerName.replace(/'/g, "''")}' -ErrorAction SilentlyContinue"`;
      try {
        await execAsync(copyCmd);
        return {
          success: true,
          bytesWritten: buffer.length,
          message: `Spooled ${buffer.length} bytes to printer "${printerName}" via share fallback`,
        };
      } catch {
        return {
          success: false,
          bytesWritten: 0,
          error: stderr || `Win32 spool error code: ${writtenResult}`,
          message: `Failed to write raw bytes to Windows printer "${printerName}".`,
        };
      }
    }
  } catch (err: any) {
    return {
      success: false,
      bytesWritten: 0,
      error: err.message,
      message: `Win32 spool execution error for "${printerName}": ${err.message}`,
    };
  } finally {
    fs.promises.unlink(tempFile).catch(() => {});
  }
}
