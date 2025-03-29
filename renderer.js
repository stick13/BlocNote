const { ipcRenderer } = require('electron');

let currentFilePath = null;
let isModified = false; // Indique si le texte a changé

// Détecter les modifications dans l'éditeur
document.getElementById('editor').addEventListener('input', () => {
    isModified = true; 
});

// 📂 Recevoir le fichier ouvert depuis main.js
ipcRenderer.on('file-opened', (event, content, filePath) => {
    document.getElementById('editor').value = content;
    currentFilePath = filePath; // Mise à jour du fichier actuel
    document.title = `Bloc-Notes - ${filePath}`;
});

// 📂 Ouvrir un fichier
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('openFile').addEventListener('click', () => {
        ipcRenderer.send('open-file');
    });
});

// 💾 Sauvegarde du fichier
document.getElementById('save').addEventListener('click', () => {
    const content = document.getElementById('editor').value;
    ipcRenderer.invoke('save-file', content);
});

// ✅ Mise à jour de l'affichage après sauvegarde
ipcRenderer.on('file-saved', (event, filePath) => {
    currentFilePath = filePath;
    document.getElementById('file-path').textContent = `Fichier enregistré: ${filePath}`;
});

// 💾 Enregistrer sous...
document.getElementById('saveAs').addEventListener('click', () => {
    const content = document.getElementById('editor').value;
    ipcRenderer.send('save-as', content); // Envoie le texte au processus principal
});

// Corriger l'événement file-saved pour éviter la répétition
ipcRenderer.on('file-saved', (event, filePath) => {
    currentFilePath = filePath;
    document.title = `Bloc-Notes - ${filePath}`;
});
