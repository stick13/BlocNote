// main.js
const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

let mainWindow;

// --- Path to the JSON store for recent files ---
const storeFile = path.join(app.getPath('userData'), 'recent.json');

// Load the recent list, or return [] if none
function loadRecent() {
  try {
    return JSON.parse(fs.readFileSync(storeFile, 'utf8'));
  } catch {
    return [];
  }
}

// Save up to 10 entries
function saveRecent(list) {
  fs.writeFileSync(storeFile,
    JSON.stringify(list.slice(0, 10), null, 2),
    'utf8'
  );
}

// Add or bump a file in the recent list
function addToRecent(filePath) {
  const now = Date.now();
  const rec = loadRecent().filter(item => item.path !== filePath);
  rec.unshift({ path: filePath, timestamp: now });
  saveRecent(rec);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000, height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');

  // Intercept window close to warn if unsaved changes exist
  let hasUnsaved = false;
  ipcMain.on('has-unsaved', (event, flag) => {
    hasUnsaved = flag;
  });

  mainWindow.on('close', async (e) => {
    const currentURL = mainWindow.webContents.getURL();
    const basename = path.basename(new URL(currentURL).pathname);

    if (basename === 'index.html' || !hasUnsaved) {
      return;
    }

    e.preventDefault();
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      buttons: ['Enregistrer', 'Quitter sans enregistrer', 'Annuler'],
      defaultId: 0,
      cancelId: 2,
      message: 'Vous avez peut‑être des fichiers non enregistrés. Que souhaitez‑vous faire ?',
    });

    if (response === 0) {
      mainWindow.webContents.send('app-close-save');
    } else if (response === 1) {
      mainWindow.removeAllListeners('close');
      mainWindow.close();
    }
  });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

// --- IPC Handlers ---

// Open file dialog
ipcMain.on('open-file', async (event) => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Textes', extensions: ['txt','md','js','json','html','css'] }]
  });
  if (!canceled && filePaths.length) {
    const fp = filePaths[0];
    fs.readFile(fp, 'utf8', async (err, data) => {
      if (err) return;
      const currentPage = path.basename(new URL(mainWindow.webContents.getURL()).pathname);
      if (currentPage !== 'editor.html') {
        await mainWindow.loadFile('editor.html');
      }
      mainWindow.webContents.send('file-opened', data, fp);
      addToRecent(fp);
    });
  }
});

// Save file
ipcMain.on('save-file', (event, filePath, content) => {
  fs.writeFile(filePath, content, 'utf8', (err) => {
    if (!err) {
      event.sender.send('file-saved', filePath);
      addToRecent(filePath);
    }
  });
});

// Save as dialog
ipcMain.on('save-file-as', async (event, content) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: 'nouveau.txt',
    filters: [{ name: 'Textes', extensions: ['txt','md','js','json','html','css'] }]
  });
  if (!canceled && filePath) {
    fs.writeFile(filePath, content, 'utf8', () => {
      event.sender.send('file-saved', filePath);
      addToRecent(filePath);
    });
  }
});

// New file
ipcMain.on('new-file', () => {
  mainWindow.loadFile('editor.html');
});

// Open a specific path (from recent list), with existence check
ipcMain.on('open-file-path', (event, filePath) => {
  if (!fs.existsSync(filePath)) {
    // Remove from recents
    const updated = loadRecent().filter(item => item.path !== filePath);
    saveRecent(updated);
    // Notify renderer
    mainWindow.webContents.send('file-not-found', filePath);
    return;
  }
  fs.readFile(filePath, 'utf8', async (err, data) => {
    if (err) {
      mainWindow.webContents.send('file-not-found', filePath);
      return;
    }
    const currentPage = path.basename(new URL(mainWindow.webContents.getURL()).pathname);
    if (currentPage !== 'editor.html') {
      await mainWindow.loadFile('editor.html');
    }
    mainWindow.webContents.send('file-opened', data, filePath);
    addToRecent(filePath);
  });
});

// Provide recent list, filtering out non-existent files at load
ipcMain.handle('get-recent', () => {
  const rec = loadRecent();
  const valid = rec.filter(item => fs.existsSync(item.path));
  if (valid.length < rec.length) saveRecent(valid);
  return valid;
});

// Remove one entry from recent list
ipcMain.handle('remove-recent', (event, filePath) => {
  const updated = loadRecent().filter(item => item.path !== filePath);
  saveRecent(updated);
  return updated;
});

// After global save, close window
ipcMain.on('app-close-saved', () => {
  if (mainWindow) {
    mainWindow.removeAllListeners('close');
    mainWindow.close();
  }
});

// Close when all tabs closed
ipcMain.on('close-all-tabs', () => {
  if (mainWindow) {
    mainWindow.removeAllListeners('close');
    mainWindow.close();
  }
});
