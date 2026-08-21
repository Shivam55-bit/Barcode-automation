var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var import_electron = require("electron");
var import_path = __toESM(require("path"), 1);
var import_child_process = require("child_process");
let mainWindow = null;
let serverProcess = null;
const PORT = process.env.PORT || 5050;
const isDev = process.env.NODE_ENV === "development";
function startBackendServer() {
  const serverPath = isDev ? import_path.default.join(__dirname, "../server.ts") : import_path.default.join(__dirname, "../dist/server.js");
  try {
    serverProcess = (0, import_child_process.fork)(serverPath, [], {
      env: { ...process.env, PORT: String(PORT), NODE_ENV: isDev ? "development" : "production" }
    });
    console.log(`[Electron Main] Launched local Express backend process on port ${PORT}`);
  } catch (err) {
    console.error("[Electron Main] Failed to spawn backend server process:", err);
  }
}
function createWindow() {
  mainWindow = new import_electron.BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: "BarcodeFlow Enterprise Suite",
    icon: import_path.default.join(__dirname, "../assets/icon.png"),
    webPreferences: {
      preload: import_path.default.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false
    },
    autoHideMenuBar: true,
    show: false
  });
  const loadUrl = isDev ? `http://127.0.0.1:${PORT}` : `http://127.0.0.1:${PORT}`;
  setTimeout(() => {
    mainWindow?.loadURL(loadUrl).catch(() => {
      mainWindow?.loadURL(`http://localhost:${PORT}`);
    });
  }, 1e3);
  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
    mainWindow?.maximize();
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    import_electron.shell.openExternal(url);
    return { action: "deny" };
  });
}
import_electron.app.whenReady().then(() => {
  startBackendServer();
  createWindow();
  import_electron.app.on("activate", () => {
    if (import_electron.BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
import_electron.app.on("window-all-closed", () => {
  if (serverProcess) {
    serverProcess.kill();
  }
  if (process.platform !== "darwin") {
    import_electron.app.quit();
  }
});
