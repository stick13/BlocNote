const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// Variables globales
let mainWindow = null;
let editorWindow = null;
let currentFilePath = null;

// Fonction pour créer la fenêtre principale
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

// Fonction pour créer la fenêtre d'édition
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

  editorWindow.webContents.once('did-finish-load', () => {
    editorWindow.webContents.send('file-opened', content, filePath);
  });

  editorWindow.on('closed', () => {
    editorWindow = null;
  });

  if (mainWindow) {
    mainWindow.close();
    mainWindow = null;
  }
}

// Gestionnaires IPC
ipcMain.on('open-file', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'Text Files', extensions: ['txt'] }]
  });

  if (!result.canceled && result.filePaths?.length > 0) {
    currentFilePath = result.filePaths[0];
    const fileContent = fs.readFileSync(currentFilePath, 'utf8');

    if (editorWindow) {
      editorWindow.webContents.send('file-opened', fileContent, currentFilePath);
    } else {
      createEditorWindow(currentFilePath, fileContent);
    }
  }
});

ipcMain.on('new-file', () => {
  createEditorWindow(null, "");
});

ipcMain.handle('save-file', async (event, content) => {
  if (currentFilePath) {
    fs.writeFileSync(currentFilePath, content, 'utf8');
    event.sender.send('file-saved', currentFilePath);
    return { success: true, path: currentFilePath };
  } else {
    const win = editorWindow || BrowserWindow.getFocusedWindow();
    const result = await dialog.showSaveDialog(win, {
      filters: [{ name: 'Text Files', extensions: ['txt'] }]
    });
    
    if (!result.canceled && result.filePath) {
      currentFilePath = result.filePath;
      fs.writeFileSync(currentFilePath, content, 'utf8');
      event.sender.send('file-saved', currentFilePath);
      return { success: true, path: currentFilePath };
    }
    return { success: false };
  }
});

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

ipcMain.handle('show-close-confirmation', async (event, fileTitle) => {
  const result = await dialog.showMessageBox({
    type: 'question',
    buttons: ['Enregistrer', 'Quitter sans enregistrer', 'Annuler'],
    defaultId: 0,
    cancelId: 2,
    title: 'Fermer l\'onglet',
    message: `Souhaitez-vous enregistrer les modifications dans "${fileTitle}" avant de fermer ?`
  });
  return result.response;
});

ipcMain.handle('show-save-dialog', async () => {
  const result = await dialog.showSaveDialog({
    title: 'Enregistrer sous...',
    defaultPath: 'nouveau_fichier.txt',
    filters: [{ name: 'Text Files', extensions: ['txt'] }]
  });
  return result.canceled ? null : result.filePath;
});

ipcMain.handle('save-direct', async (event, filePath, content) => {
  fs.writeFileSync(filePath, content, 'utf8');
  event.sender.send('file-saved', filePath);
});

ipcMain.on('close-app', () => {
  if (editorWindow) editorWindow.close();
  if (mainWindow) mainWindow.close();
  app.quit();
});

ipcMain.on('force-close', () => {
  app.exit(0);
});

ipcMain.on("no-tabs-left", () => {
  const windows = BrowserWindow.getAllWindows();
  if (windows.length > 0) {
    windows[0].close();
  }
});

// Configuration de l'application
app.whenReady().then(() => {
  createMainWindow();
  
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});