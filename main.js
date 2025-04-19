// main.js
const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const fs   = require('fs');
const path = require('path');
const { URL } = require('url');

let mainWindow;

// Chemins vers les fichiers de stockage
const recentStore  = path.join(app.getPath('userData'), 'recent.json');
const sessionStore = path.join(app.getPath('userData'), 'session.json');

// --- Fonctions pour gérer les fichiers récents ---
function loadRecent() {
  try {
    return JSON.parse(fs.readFileSync(recentStore, 'utf8'));
  } catch {
    return [];
  }
}
function saveRecent(list) {
  fs.writeFileSync(
    recentStore,
    JSON.stringify(list.slice(0, 10), null, 2),
    'utf8'
  );
}
function addToRecent(fp) {
  const maintenant = Date.now();
  let rec = loadRecent().filter(item => item.path !== fp);
  rec.unshift({ path: fp, timestamp: maintenant });
  saveRecent(rec);
}

// --- Fonctions pour gérer la session (onglets) ---
function loadSession() {
  try {
    return JSON.parse(fs.readFileSync(sessionStore, 'utf8'));
  } catch {
    return [];
  }
}
function saveSession(tabs) {
  fs.writeFileSync(
    sessionStore,
    JSON.stringify(tabs, null, 2),
    'utf8'
  );
}

// Création de la fenêtre principale
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // Toujours démarrer sur la page d'accueil
  mainWindow.loadFile('index.html');
}

app.whenReady().then(createWindow);

// Quitte quand toutes les fenêtres sont fermées (sauf sur macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// --- IPC pour persister la session ---
ipcMain.on('session-save', (_, tabs) => {
  saveSession(tabs);
});

// Indique si une session existe
ipcMain.handle('has-session', () => {
  return loadSession().length > 0;
});

// Reprendre la session depuis la page d'accueil
ipcMain.on('resume-session', () => {
  const sessionTabs = loadSession();
  if (sessionTabs.length > 0) {
    mainWindow.loadFile('editor.html')
      .then(() => mainWindow.webContents.send('session-data', sessionTabs));
  }
});

// --- IPC pour ouvrir un fichier et gérer l’éditeur ---
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
    const sessionTabs = loadSession();
    await mainWindow.loadFile('editor.html');
    if (sessionTabs.length) {
      mainWindow.webContents.send('session-data', sessionTabs);
    }
    mainWindow.webContents.send('file-opened', data, fp);
    addToRecent(fp);
  });
});

// Nouveau fichier brut
ipcMain.on('new-file', () => {
  const sessionTabs = loadSession();
  mainWindow.loadFile('editor.html').then(() => {
    if (sessionTabs.length) {
      mainWindow.webContents.send('session-data', sessionTabs);
    }
    mainWindow.webContents.send('create-new-tab');
  });
});

// Sauvegarde simple
ipcMain.on('save-file', (_, filePath, content) => {
  fs.writeFile(filePath, content, 'utf8', () => {
    mainWindow.webContents.send('file-saved', filePath);
    addToRecent(filePath);
  });
});

// « Enregistrer sous... »
ipcMain.on('save-file-as', async (_, content) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Enregistrer sous...',
    defaultPath: 'nouveau.txt',
    filters: [{ name: 'Textes', extensions: ['txt','md','js','json','html','css'] }]
  });
  if (canceled || !filePath) return;
  fs.writeFile(filePath, content, 'utf8', () => {
    mainWindow.webContents.send('file-saved', filePath);
    addToRecent(filePath);
  });
});

// Ouvrir un chemin spécifique depuis les récents
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
    const sessionTabs = loadSession();
    await mainWindow.loadFile('editor.html');
    if (sessionTabs.length) {
      mainWindow.webContents.send('session-data', sessionTabs);
    }
    mainWindow.webContents.send('file-opened', data, filePath);
    addToRecent(filePath);
  });
});

// Fermer tous les onglets => quitter l'application
ipcMain.on('close-all-tabs', () => {
  if (mainWindow) mainWindow.close();
});

// Fournir la liste des fichiers récents (existants)
ipcMain.handle('get-recent', () => {
  return loadRecent().filter(i => fs.existsSync(i.path));
});

// Supprimer un élément de la liste récente
ipcMain.handle('remove-recent', (_, filePath) => {
  const updated = loadRecent().filter(i => i.path !== filePath);
  saveRecent(updated);
  return updated;
});
