// Importation des modules Electron et Node.js nécessaires
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;       // Fenêtre principale (Accueil)
let editorWindow = null;     // Fenêtre d'édition
let currentFilePath = null;  // Stocke le chemin du fichier actuellement ouvert

// 🔹 Fonction pour créer la fenêtre principale (Accueil)
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 600,
    height: 400,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 🔹 Fonction pour créer la fenêtre de l'éditeur
function createEditorWindow(filePath = null, content = "") {
  editorWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  editorWindow.loadFile('editor.html');

  // Une fois le chargement terminé, envoyer le contenu au renderer
  editorWindow.webContents.once('did-finish-load', () => {
    editorWindow.webContents.send('file-opened', content, filePath);
  });

  editorWindow.on('closed', () => {
    editorWindow = null;
  });

  // Fermer la fenêtre principale après création de l'éditeur (si elle existe)
  if (mainWindow) {
    mainWindow.close();
    mainWindow = null;
  }
}

// 📂 Gestion de l'ouverture d'un fichier
ipcMain.on('open-file', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Text Files', extensions: ['txt'] }]
  });

  if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
    currentFilePath = result.filePaths[0];
    const fileContent = fs.readFileSync(currentFilePath, 'utf8');

    if (editorWindow) {
      // Si l'éditeur est déjà ouvert, envoyer le contenu du fichier
      editorWindow.webContents.send('file-opened', fileContent, currentFilePath);
    } else {
      // Sinon, créer l'éditeur avec le fichier ouvert
      createEditorWindow(currentFilePath, fileContent);
    }
  }
});

// 📝 Gestion de la création d'un nouveau fichier
ipcMain.on('new-file', () => {
  createEditorWindow(null, "");
});

// 💾 Gestion de la sauvegarde simple des fichiers
ipcMain.handle('save-file', async (event, content) => {
  if (currentFilePath) {
    // Fichier existant : on écrit directement
    fs.writeFileSync(currentFilePath, content, 'utf8');
    event.sender.send('file-saved', currentFilePath);
  } else {
    // Pour un nouveau fichier, déclencher "Enregistrer sous..."
    const win = editorWindow || BrowserWindow.getFocusedWindow();
    const result = await dialog.showSaveDialog(win, {
      filters: [{ name: 'Text Files', extensions: ['txt'] }]
    });
    if (!result.canceled && result.filePath) {
      currentFilePath = result.filePath;
      fs.writeFileSync(currentFilePath, content, 'utf8');
      event.sender.send('file-saved', currentFilePath);
    }
  }
});

// 💾 Gestion d'"Enregistrer sous..."
ipcMain.on('save-as', async (event, content) => {
  const win = editorWindow || BrowserWindow.getFocusedWindow();
  const result = await dialog.showSaveDialog(win, {
    title: 'Enregistrer sous...',
    defaultPath: 'nouveau_fichier.txt',
    filters: [{ name: 'Text Files', extensions: ['txt'] }]
  });
  if (!result.canceled && result.filePath) {
    fs.writeFileSync(result.filePath, content, 'utf8');
    currentFilePath = result.filePath;
    event.sender.send('file-saved', result.filePath);
  }
});

// 📌 Réception du message pour fermer l'application (par exemple, quand le dernier onglet se ferme)
ipcMain.on('close-app', () => {
  console.log("close-app reçu, fermeture de l'application.");
  app.quit();
});

// (Optionnel) Autre canal pour quitter explicitement
ipcMain.on('quit-app', (event, shouldQuit) => {
  if (shouldQuit) app.quit();
});

// ⚡ Lancer l'application lorsque Electron est prêt
app.whenReady().then(createMainWindow);

// Quitter l'application lorsque toutes les fenêtres sont fermées (sauf sur macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Sur macOS, recréer une fenêtre si l'app est activée et qu'aucune fenêtre n'est ouverte
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});
