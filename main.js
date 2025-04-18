// main.js
const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

let mainWindow;

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

  // === Prévention de la fermeture de l'app (croix de fenêtre) ===
  mainWindow.on('close', async (e) => {
    e.preventDefault();

    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      buttons: ['Enregistrer', 'Quitter sans enregistrer', 'Annuler'],
      defaultId: 0,
      cancelId: 2,
      message: 'Vous avez peut-être des fichiers non enregistrés. Que souhaitez‑vous faire ?',
    });

    if (response === 0) {
      // Enregistrer : on demande au renderer de tout sauvegarder
      mainWindow.webContents.send('app-close-save');
    } else if (response === 1) {
      // Quitter sans enregistrer : on force la fermeture
      mainWindow.removeAllListeners('close');
      mainWindow.close();
    }
    // response === 2 (Annuler) → rien
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// === IPC: OUVERTURE DE FICHIER ===
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
        const url = mainWindow.webContents.getURL();
        if (!url.endsWith('editor.html')) {
          await mainWindow.loadFile('editor.html');
        }
        mainWindow.webContents.send('file-opened', data, filePath);
      }
    });
  }
});

// === IPC: SAUVEGARDE SIMPLE ===
ipcMain.on('save-file', (event, filePath, content) => {
  fs.writeFile(filePath, content, 'utf8', (err) => {
    if (!err) event.sender.send('file-saved', filePath);
  });
});

// === IPC: SAUVEGARDE "Enregistrer sous..." ===
ipcMain.on('save-file-as', async (event, content) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Enregistrer sous...',
    defaultPath: 'nouveau.txt',
    filters: [{ name: 'Textes', extensions: ['txt','md','js','json','html','css'] }]
  });
  if (!canceled && filePath) {
    fs.writeFile(filePath, content, 'utf8', (err) => {
      if (!err) event.sender.send('file-saved', filePath);
    });
  }
});

// === IPC: NOUVEAU FICHIER ===
ipcMain.on('new-file', () => {
  mainWindow.loadFile('editor.html');
});

// === IPC: FERMETURE APRÈS SAVING GLOBAL ===
ipcMain.on('app-close-saved', () => {
  if (!mainWindow) return;
  mainWindow.removeAllListeners('close');
  mainWindow.close();
});

// === IPC: FERMETURE QUAND TOUS LES ONGLETS SONT FERMÉS ===
ipcMain.on('close-all-tabs', () => {
  if (!mainWindow) return;
  // On retire l'intercepteur pour ne pas bloquer la fermeture
  mainWindow.removeAllListeners('close');
  mainWindow.close();
});
