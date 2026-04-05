const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development';

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    backgroundColor: '#000000',
    title: "Visiqon Player Pro",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs'),
    },
    autoHideMenuBar: true,
  });

  win.maximize(); // Start maximized for production feel

  // Safety: Ensure title is set correctly
  win.on('page-title-updated', (e) => e.preventDefault());
  win.setTitle("Visiqon Player Pro");

  if (isDev) {
    win.loadURL('http://localhost:3000');
  } else {
    // 🛡️ STABILIZED PRODUCTION PATHING
    // Using app.getAppPath() to resolve absolute location within the asar bundle
    const rootPath = app.getAppPath();
    const indexPath = path.join(rootPath, 'dist', 'index.html');
    
    // Check if file exists to provide a helpful error instead of a white screen
    const fs = require('fs');
    if (!fs.existsSync(indexPath)) {
      dialog.showErrorBox(
        "Critical Initialization Error", 
        `Visiqon cannot find the player bundle. \nLooking at: ${indexPath} \nRoot: ${rootPath}`
      );
      app.quit();
      return;
    }

    win.loadFile(indexPath).catch(err => {
      dialog.showErrorBox("Startup Failure", "Failed to load Visiqon Core: " + err.message);
    });

    // 🔬 DEBUG: Open DevTools ONLY if we are still seeing white screens
    // Keep this for this build so the user can see if there are JS errors
    win.webContents.once('did-finish-load', () => {
      // If we see a white screen, opening DevTools will show the console 
      // win.webContents.openDevTools(); 
    });
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
