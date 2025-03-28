const { ipcRenderer } = require('electron');

// Recevoir le chemin du fichier depuis main.js
ipcRenderer.on('file-path', (event, filePath) => {
    const filePathElement = document.getElementById('file-path');
    if (filePathElement) {
        filePathElement.textContent = `Fichier ouvert: ${filePath}`;
    }
});

// Sauvegarder le fichier
document.getElementById('save').addEventListener('click', () => {
    const content = document.getElementById('editor').value; // Récupérer le contenu de l'éditeur
    ipcRenderer.invoke('save-file', content); // Envoie le contenu du texte à main.js
});
