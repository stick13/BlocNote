// Importation des modules Electron et Node.js nécessaires
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;       // Fenêtre principale (Accueil)
let editorWindow;     // Fenêtre d'édition
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

    // Charger la page d’accueil
    mainWindow.loadFile('index.html');
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

    // Charger la page éditeur
    editorWindow.loadFile('editor.html');

    // Envoyer le contenu du fichier à l’éditeur après chargement
    editorWindow.webContents.once('did-finish-load', () => {
        editorWindow.webContents.send('file-opened', content, filePath);
    });

    // Fermer la fenêtre principale après ouverture de l'éditeur
    mainWindow.close();
}

// 📂 Gérer l’ouverture d’un fichier
ipcMain.on('open-file', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'Text Files', extensions: ['txt'] }]
    });

    if (!result.canceled) {
        currentFilePath = result.filePaths[0];
        const fileContent = fs.readFileSync(currentFilePath, 'utf8');
        
        if (editorWindow) {
            // Si l'éditeur est ouvert, charger directement le fichier
            editorWindow.webContents.send('file-opened', fileContent, currentFilePath);
        } else {
            // Sinon, ouvrir l'éditeur
            createEditorWindow(currentFilePath, fileContent);
        }
    }
});

// 📝 Gestion de la création d'un nouveau fichier
ipcMain.on('new-file', () => {
    createEditorWindow();
});

// 💾 Gestion de la sauvegarde des fichiers
ipcMain.handle('save-file', async (event, content) => {
    if (currentFilePath) {
        // Si un fichier est déjà ouvert, on l’écrase
        fs.writeFileSync(currentFilePath, content, 'utf8');
        event.sender.send('file-saved', currentFilePath);
    } else {
        // Sinon, on ouvre une boîte de dialogue pour demander un nom
        const result = await dialog.showSaveDialog(editorWindow, {
            filters: [{ name: 'Text Files', extensions: ['txt'] }]
        });

        if (!result.canceled) {
            currentFilePath = result.filePath;
            fs.writeFileSync(currentFilePath, content, 'utf8');
            event.sender.send('file-saved', currentFilePath);
        }
    }
});

// 💾 Enregistrer sous ...
ipcMain.on('save-as', async (event, content) => {
    const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Enregistrer sous...',
        defaultPath: 'nouveau_fichier.txt',
        filters: [{ name: 'Text Files', extensions: ['txt'] }]
    });

    if (!result.canceled) {
        fs.writeFileSync(result.filePath, content, 'utf8');
        currentFilePath = result.filePath; // Met à jour le chemin actuel
        event.sender.send('file-saved', result.filePath); // Informe le renderer
    }
});

// 📅 Intercepter la fermeture avant qu'elle ne se produise
app.on('before-quit', (event) => {
    // Empêche la fermeture immédiate de l'application
    if (mainWindow && !mainWindow.isDestroyed()) {  // Vérifie si mainWindow est encore actif
        event.preventDefault();  // Empêche la fermeture immédiate
        mainWindow.webContents.send('check-modifications');  // Envoie un message au renderer pour vérifier si des modifications sont présentes
    }
});

// 📦 Afficher la boîte de dialogue avant de quitter
ipcMain.handle('show-save-dialog', async () => {
    const result = await dialog.showMessageBox({
        type: 'warning',
        buttons: ['Enregistrer', 'Quitter sans enregistrer', 'Annuler'],
        defaultId: 0,
        cancelId: 2,
        title: 'Fichier non enregistré',
        message: 'Vous avez des modifications non enregistrées. Voulez-vous les sauvegarder ?'
    });

    return result.response;
});

// Quitter l'application si l'utilisateur le souhaite
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