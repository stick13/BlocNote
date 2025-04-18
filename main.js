// main.js
const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

let mainWindow;
// flag suivi depuis le renderer
let hasUnsaved = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, 
    },
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('close', async (e) => {
    const currentURL = mainWindow.webContents.getURL();
    const page = path.basename(new URL(currentURL).pathname);

    // si on est sur la page d'accueil, ou rien à sauvegarder, on laisse fermer
    if (page === 'index.html' || !hasUnsaved) {
      return;
    }

    // sinon, on intercepte et on demande à l'utilisateur
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
    // si Annuler, on ne fait rien
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// on met à jour le flag from renderer
ipcMain.on('has-unsaved', (event, flag) => {
  hasUnsaved = flag;
});

// === OUVERTURE / SAUVEGARDE / NOUVEAU FICHIER ===
ipcMain.on('open-file', async (event) => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Ouvrir un fichier',
    properties: ['openFile'],
    filters: [{ name: 'Textes', extensions: ['txt','md','js','json','html','css'] }]
  });
  if (!canceled && filePaths.length > 0) {
    const filePath = filePaths[0];
    fs.readFile(filePath, 'utf8', async (err, data) => {
      if (!err) {
        const page = path.basename(new URL(mainWindow.webContents.getURL()).pathname);
        if (page !== 'editor.html') {
          await mainWindow.loadFile('editor.html');
        }
        mainWindow.webContents.send('file-opened', data, filePath);
      }
    });
  }
});
ipcMain.on('save-file', (event, filePath, content) => {
  fs.writeFile(filePath, content, 'utf8', () => {
    event.sender.send('file-saved', filePath);
  });
});
ipcMain.on('save-file-as', async (event, content) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Enregistrer sous...',
    defaultPath: 'nouveau.txt',
    filters: [{ name: 'Textes', extensions: ['txt','md','js','json','html','css'] }]
  });
  if (!canceled && filePath) {
    fs.writeFile(filePath, content, 'utf8', () => {
      event.sender.send('file-saved', filePath);
    });
  }
});
ipcMain.on('new-file', () => {
  mainWindow.loadFile('editor.html');
});

// après une sauvegarde globale, on ferme
ipcMain.on('app-close-saved', () => {
  if (!mainWindow) return;
  mainWindow.removeAllListeners('close');
  mainWindow.close();
});

// fermeture quand tous les onglets sont fermés
ipcMain.on('close-all-tabs', () => {
  if (!mainWindow) return;
  mainWindow.removeAllListeners('close');
  mainWindow.close();
});
