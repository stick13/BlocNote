// main.js
const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const fs   = require('fs');
const path = require('path');
const { URL } = require('url');

let mainWindow;

const recentStore  = path.join(app.getPath('userData'), 'recent.json');
const sessionStore = path.join(app.getPath('userData'), 'session.json');

function loadRecent() {
  try { return JSON.parse(fs.readFileSync(recentStore, 'utf8')); }
  catch { return []; }
}
function saveRecent(list) {
  fs.writeFileSync(recentStore,
    JSON.stringify(list.slice(0,10), null,2),
    'utf8'
  );
}
function addToRecent(fp) {
  const now = Date.now();
  let rec = loadRecent().filter(i => i.path !== fp);
  rec.unshift({ path: fp, timestamp: now });
  saveRecent(rec);
}

function loadSession() {
  try { return JSON.parse(fs.readFileSync(sessionStore, 'utf8')); }
  catch { return []; }
}
function saveSession(tabs) {
  fs.writeFileSync(sessionStore,
    JSON.stringify(tabs, null,2),
    'utf8'
  );
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000, height: 800,
    webPreferences: { nodeIntegration: true, contextIsolation: false }
  });
  mainWindow.loadFile('index.html');
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

ipcMain.on('session-save', (_, tabs) => {
  saveSession(tabs);
});

ipcMain.handle('has-session', () => loadSession().length > 0);

ipcMain.on('resume-session', () => {
  const sessionTabs = loadSession();
  if (sessionTabs.length > 0) {
    mainWindow.loadFile('editor.html')
      .then(() => mainWindow.webContents.send('session-data', sessionTabs));
  }
});

ipcMain.on('open-file', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Ouvrir un fichier',
    properties: ['openFile'],
    filters: [{ name: 'Textes', extensions: ['txt','md','js','json','html','css'] }]
  });
  if (canceled || !filePaths.length) return;
  const fp = filePaths[0];
  fs.readFile(fp, 'utf8', async (err, data) => {
    if (err) return;
    const currentURL  = mainWindow.webContents.getURL();
    const page        = path.basename(new URL(currentURL).pathname);
    const sessionTabs = loadSession();
    if (page !== 'editor.html') {
      await mainWindow.loadFile('editor.html');
      if (sessionTabs.length) mainWindow.webContents.send('session-data', sessionTabs);
    }
    mainWindow.webContents.send('file-opened', data, fp);
    addToRecent(fp);
  });
});

ipcMain.on('new-file', () => {
  const currentURL  = mainWindow.webContents.getURL();
  const page        = path.basename(new URL(currentURL).pathname);
  const sessionTabs = loadSession();
  if (page !== 'editor.html') {
    mainWindow.loadFile('editor.html').then(() => {
      if (sessionTabs.length) mainWindow.webContents.send('session-data', sessionTabs);
      mainWindow.webContents.send('create-new-tab');
    });
  } else {
    mainWindow.webContents.send('create-new-tab');
  }
});

ipcMain.on('save-file', (_, filePath, content) => {
  // si content est null ou undefined, on écrit une chaîne vide
  const data = typeof content === 'string' ? content : '';
  fs.writeFile(filePath, data, 'utf8', (err) => {
    if (err) {
      console.error('Erreur lors de la sauvegarde :', err);
    } else {
      mainWindow.webContents.send('file-saved', filePath);
      addToRecent(filePath);
    }
  });
});

ipcMain.on('save-file-as', async (_, content) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Enregistrer sous…',
    defaultPath: 'nouveau.txt',
    filters: [{ name: 'Textes', extensions: ['txt','md','js','json','html','css'] }]
  });
  if (canceled || !filePath) return;
  const data = typeof content === 'string' ? content : '';
  fs.writeFile(filePath, data, 'utf8', (err) => {
    if (err) {
      console.error('Erreur lors de « Enregistrer sous » :', err);
    } else {
      mainWindow.webContents.send('file-saved', filePath);
      addToRecent(filePath);
    }
  });
});

ipcMain.on('open-file-path', (_, filePath) => {
  if (!fs.existsSync(filePath)) {
    const updated = loadRecent().filter(i => i.path !== filePath);
    saveRecent(updated);
    mainWindow.webContents.send('file-not-found', filePath);
    return;
  }
  fs.readFile(filePath, 'utf8', async (err, data) => {
    if (err) {
      mainWindow.webContents.send('file-not-found', filePath);
      return;
    }
    const currentURL  = mainWindow.webContents.getURL();
    const page        = path.basename(new URL(currentURL).pathname);
    const sessionTabs = loadSession();
    if (page !== 'editor.html') {
      await mainWindow.loadFile('editor.html');
      if (sessionTabs.length) mainWindow.webContents.send('session-data', sessionTabs);
    }
    mainWindow.webContents.send('file-opened', data, filePath);
    addToRecent(filePath);
  });
});

ipcMain.on('close-all-tabs', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('get-recent', () =>
  loadRecent().filter(i => fs.existsSync(i.path))
);
ipcMain.handle('remove-recent', (_, filePath) => {
  const updated = loadRecent().filter(i => i.path !== filePath);
  saveRecent(updated);
  return updated;
});
