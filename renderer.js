const { ipcRenderer } = require('electron');

let currentFilePath = null;
let isModified = false; // Indique si le texte a changé

// Variables pour gérer les onglets
let tabs = []; // Tableau pour suivre les onglets ouverts

// Fonction pour créer un nouvel onglet
function createTab(filePath) {
    const tabContainer = document.getElementById('tabs');
    const tab = document.createElement('div');
    tab.classList.add('tab');
    tab.textContent = filePath ? filePath.split("\\").pop() : "Nouveau fichier";
    tabContainer.appendChild(tab);
    
    // Cliquer sur un onglet pour afficher son contenu
    tab.addEventListener('click', () => {
        setActiveTab(filePath);
    });

    tabs.push({ filePath, tab });
    setActiveTab(filePath);
}

// Fonction pour définir l'onglet actif
function setActiveTab(filePath) {
    tabs.forEach(tab => {
        if (tab.filePath === filePath) {
            tab.tab.classList.add('active');
            currentFilePath = filePath;
            document.getElementById('editor').value = ''; // Vider l'éditeur avant de charger
            loadFileContent(filePath);
        } else {
            tab.tab.classList.remove('active');
        }
    });
}

// Fonction pour charger le contenu d'un fichier
function loadFileContent(filePath) {
    const content = localStorage.getItem(filePath) || ''; // Utilisation de localStorage pour gérer le contenu
    document.getElementById('editor').value = content;
    document.title = `Bloc-Notes - ${filePath}`;
}

// Détecter les modifications dans l'éditeur
document.getElementById('editor').addEventListener('input', () => {
    isModified = true; 
    if (currentFilePath) {
        localStorage.setItem(currentFilePath, document.getElementById('editor').value);
    }
});

// 📂 Recevoir le fichier ouvert depuis main.js
ipcRenderer.on('file-opened', (event, content, filePath) => {
    createTab(filePath);
    document.getElementById('editor').value = content;
    localStorage.setItem(filePath, content); // Sauvegarder le contenu localement
    currentFilePath = filePath; 
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
    document.title = `Bloc-Notes - ${filePath}`;
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
