// main.js
const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

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

  // === Interception de la fermeture de la fenêtre principale ===
  mainWindow.on('close', async (e) => {
    // On récupère la page (basename du file:// URL)
    const currentURL = mainWindow.webContents.getURL();
    const page = path.basename(new URL(currentURL).pathname);

    // Si on est sur la page d'accueil, on ferme sans rien bloquer
    if (page === 'index.html') {
      return;
    }

    // Sinon, on empêche la fermeture et on propose le choix à l'utilisateur
    e.preventDefault();

    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      buttons: ['Enregistrer', 'Quitter sans enregistrer', 'Annuler'],
      defaultId: 0,
      cancelId: 2,
      message: 'Vous avez peut‑être des fichiers non enregistrés. Que souhaitez‑vous faire ?',
    });

    if (response === 0) {
      // Enregistrer : on demande au renderer de tout sauvegarder
      mainWindow.webContents.send('app-close-save');
    } else if (response === 1) {
      // Quitter sans enregistrer : on retire le listener et on ferme
      mainWindow.removeAllListeners('close');
      mainWindow.close();
    }
    // response === 2 -> Annuler : on ne fait rien (on reste dans l'app)
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
        const currentPage = path.basename(new URL(mainWindow.webContents.getURL()).pathname);
        if (currentPage !== 'editor.html') {
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

// === IPC: FERMETURE APRÈS SAUVEGARDE GLOBALE ===
ipcMain.on('app-close-saved', () => {
  if (!mainWindow) return;
  mainWindow.removeAllListeners('close');
  mainWindow.close();
});

// === IPC: FERMETURE QUAND TOUS LES ONGLET SONT FERMÉS ===
ipcMain.on('close-all-tabs', () => {
  if (!mainWindow) return;
  mainWindow.removeAllListeners('close');
  mainWindow.close();
});
