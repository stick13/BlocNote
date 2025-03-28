const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

// Emplacement pour stocker les données utilisateur (fichier de configuration)
const userDataPath = app.getPath('userData');
const savedPathFile = path.join(userDataPath, 'lastSavePath.json');

// Initialiser les variables pour le chemin du fichier et le répertoire
let mainWindow;
let currentFilePath = null;
let currentDirectory = null;

// Vérifier si un chemin de fichier précédent existe
if (fs.existsSync(savedPathFile)) {
    const savedData = JSON.parse(fs.readFileSync(savedPathFile));
    currentFilePath = savedData.filePath || null;
    currentDirectory = savedData.directory || null;
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    mainWindow.loadFile('index.html');

    // Si un fichier est enregistré, envoyer son chemin au renderer
    if (currentFilePath) {
        mainWindow.webContents.on('did-finish-load', () => {
            mainWindow.webContents.send('file-path', currentFilePath);
        });
    }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
