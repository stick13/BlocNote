const { ipcRenderer } = require('electron');

let currentFilePath = null;
let isModified = false; // Indique si le texte a changé

// Variables pour gérer les onglets
let tabs = []; // Tableau pour suivre les onglets ouverts

// Fonction pour créer un nouvel onglet
function createTab(filePath) {
    const existingTab = tabs.find(tab => tab.filePath === filePath);
    if (existingTab) {
        setActiveTab(filePath);
        return;
    }

    const tabContainer = document.getElementById('tabs');
    const tab = document.createElement('div');
    tab.classList.add('tab');
    tab.textContent = filePath ? filePath.split("\\").pop() : "Nouveau fichier";

    // 🔴 Ajouter le bouton de fermeture ❌
    const closeBtn = document.createElement('span');
    closeBtn.textContent = '❌';
    closeBtn.classList.add('close-btn');
    tab.appendChild(closeBtn);

    // ⬅️ Ajouter avant le "+" (donc à gauche du new-tab dans flex-row-reverse)
    tabContainer.insertBefore(tab, document.getElementById('new-tab'));

    // 📂 Clic pour activer l'onglet
    tab.addEventListener('click', () => {
        setActiveTab(filePath);
    });

    // ❌ Supprimer l'onglet
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Empêche le clic d'activer l'onglet
        tab.remove();
        tabs = tabs.filter(t => t.filePath !== filePath);

        // Si on ferme l'onglet actif
        if (currentFilePath === filePath) {
            document.getElementById('editor').value = '';
            document.title = 'Bloc-Notes';
            currentFilePath = null;
        }
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
    localStorage.setItem(filePath, content);
    currentFilePath = filePath;

    const filePathElement = document.getElementById('file-path');
    if (filePath) {
        filePathElement.textContent = `Fichier ouvert : ${filePath}`;
        filePathElement.style.display = 'block';
    } else {
        filePathElement.style.display = 'none';
    }
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
    const filePathElement = document.getElementById('file-path');

    if (filePath) {
        filePathElement.textContent = `Fichier enregistré : ${filePath}`;
        filePathElement.style.display = 'block';
        document.title = `Bloc-Notes - ${filePath}`;
    } else {
        filePathElement.style.display = 'none';
    }
});

// 💾 Enregistrer sous...
document.getElementById('saveAs').addEventListener('click', () => {
    const content = document.getElementById('editor').value;
    ipcRenderer.send('save-as', content); // Envoie le texte au processus principal
});

// Créer un nouvel onglet vide avec un fichier temporaire
document.getElementById('new-tab').addEventListener('click', () => {
    const tempFilePath = `Nouveau-${Date.now()}`; // nom temporaire unique
    createTab(tempFilePath);
    localStorage.setItem(tempFilePath, ''); // Contenu vide par défaut
});
