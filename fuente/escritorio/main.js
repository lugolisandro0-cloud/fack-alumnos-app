const { app, BrowserWindow, shell, Menu } = require("electron");
const path = require("path");

if (!app.requestSingleInstanceLock()) { app.quit(); }

function crearVentana() {
  const win = new BrowserWindow({
    width: 1280, height: 860, minWidth: 380, minHeight: 560,
    title: "Alumnos y Cuotas",
    backgroundColor: "#0B0B12",
    icon: path.join(__dirname, "icono.png"),
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, spellcheck: false }
  });
  win.loadFile(path.join(__dirname, "www", "index.html"));
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: "deny" }; });
  win.webContents.on("will-navigate", (e, url) => { if (!url.startsWith("file:")) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); } });
  return win;
}

app.on("second-instance", () => { const w = BrowserWindow.getAllWindows()[0]; if (w) { if (w.isMinimized()) w.restore(); w.focus(); } });

app.whenReady().then(() => {
  const esMac = process.platform === "darwin";
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(esMac ? [{ label: "Alumnos y Cuotas", submenu: [{ role: "about", label: "Acerca de Alumnos y Cuotas" }, { type: "separator" }, { role: "hide", label: "Ocultar" }, { role: "quit", label: "Salir" }] }] : []),
    { label: "Edición", submenu: [{ role: "undo", label: "Deshacer" }, { role: "redo", label: "Rehacer" }, { type: "separator" }, { role: "cut", label: "Cortar" }, { role: "copy", label: "Copiar" }, { role: "paste", label: "Pegar" }, { role: "selectAll", label: "Seleccionar todo" }] },
    { label: "Ver", submenu: [{ role: "reload", label: "Recargar" }, { role: "resetZoom", label: "Tamaño normal" }, { role: "zoomIn", label: "Agrandar" }, { role: "zoomOut", label: "Achicar" }, { type: "separator" }, { role: "togglefullscreen", label: "Pantalla completa" }] },
    { label: "Ventana", submenu: [{ role: "minimize", label: "Minimizar" }, { role: "close", label: "Cerrar" }] }
  ]));
  crearVentana();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) crearVentana(); });
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
