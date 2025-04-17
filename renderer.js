const { ipcRenderer } = require('electron');
const path = require('path');

let currentFilePath = null;
let isModified = false; // Indique si le contenu de l'éditeur a changé

// Tableau pour gérer les onglets ouverts ; chaque objet aura les clés { filePath, tab, tabLabel }
let tabs = [];

/**
 * Crée un nouvel onglet ou active celui existant.
 * Chaque onglet est composé d'un libellé et d'un bouton de fermeture.
 */
function createTab(filePath) {
  // Si un onglet avec ce filePath existe déjà, le simple activer
  const existingTab = tabs.find(tabObj => tabObj.filePath === filePath);
  if (existingTab) {
    setActiveTab(filePath);
    return;
  }

  const tabContainer = document.getElementById('tabs');
  const tab = document.createElement('div');
  tab.classList.add('tab');

  // Création du libellé de l'onglet (affiche le nom de fichier)
  const tabLabel = document.createElement('span');
  tabLabel.classList.add('tab-label');
  tabLabel.textContent = filePath ? path.basename(filePath) : "Nouveau fichier";
  tab.appendChild(tabLabel);

  // Création du bouton de fermeture
  const closeBtn = document.createElement('span');
  closeBtn.classList.add('close-btn');
  closeBtn.textContent = '❌';
  tab.appendChild(closeBtn);

  // Insérer cet onglet AVANT le bouton "nouvel onglet"
  const newTabElem = document.getElementById('new-tab');
  tabContainer.insertBefore(tab, newTabElem);

  // Activation de l'onglet au clic sur celui-ci
  tab.addEventListener('click', () => {
    setActiveTab(filePath);
  });

  // Gestion de la fermeture de l'onglet
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Empêcher l'activation lors du clic sur la croix
    removeTab(filePath);
  });

  // Ajouter cet onglet à la liste des onglets et l'activer
  tabs.push({ filePath, tab, tabLabel });
  setActiveTab(filePath);
}

/**
 * Supprime l'onglet identifié par filePath.
 * Si l'onglet fermé était actif et que plus aucun onglet n'existe, envoie un message pour fermer l'application.
 */
function removeTab(filePath) {
  const index = tabs.findIndex(tabObj => tabObj.filePath === filePath);
  if (index === -1) return;

  // Supprimer l'élément DOM correspondant et le retirer du tableau
  const tabObj = tabs[index];
  tabObj.tab.remove();
  tabs.splice(index, 1);

  // Si l'onglet supprimé était actif
  if (currentFilePath === filePath) {
    if (tabs.length > 0) {
      // Active l'onglet précédent (si possible) ou le premier onglet restant
      const newActiveTab = tabs[index - 1] || tabs[0];
      setActiveTab(newActiveTab.filePath);
    } else {
      // Aucun onglet restant : demander la fermeture de l'application
      ipcRenderer.send('close-app');
    }
  }
}

/**
 * Définit l'onglet actif et charge son contenu.
 * En cas de modifications non sauvegardées dans l'onglet courant, une confirmation est demandée.
 */
function setActiveTab(filePath) {
  if (isModified && currentFilePath && currentFilePath !== filePath) {
    const confirmation = confirm("Le fichier en cours contient des modifications non sauvegardées. Voulez-vous continuer ?");
    if (!confirmation) return;
  }

  tabs.forEach(tabObj => {
    if (tabObj.filePath === filePath) {
      tabObj.tab.classList.add('active');
      currentFilePath = filePath;
      loadFileContent(filePath);
      isModified = false;
    } else {
      tabObj.tab.classList.remove('active');
    }
  });
}

/**
 * Charge le contenu d'un fichier à partir du localStorage.
 */
function loadFileContent(filePath) {
  const content = localStorage.getItem(filePath) || '';
  document.getElementById('editor').value = content;
  document.title = `Bloc-Notes - ${filePath}`;
}

// Détection des modifications dans l'éditeur
document.getElementById('editor').addEventListener('input', () => {
  isModified = true;
  if (currentFilePath) {
    localStorage.setItem(currentFilePath, document.getElementById('editor').value);
  }
});

// Réception d'un fichier ouvert (depuis le main process)
ipcRenderer.on('file-opened', (event, content, filePath) => {
  createTab(filePath);
  document.getElementById('editor').value = content;
  localStorage.setItem(filePath, content);
  currentFilePath = filePath;

  const tabObj = tabs.find(tabObj => tabObj.filePath === filePath);
  if (tabObj) {
    tabObj.tabLabel.textContent = path.basename(filePath);
  }
  document.title = `Bloc-Notes - ${filePath}`;
});

// Activation du bouton "Ouvrir un fichier"
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('openFile').addEventListener('click', () => {
    ipcRenderer.send('open-file');
  });
});

// Gestion du bouton "Sauvegarder"
// Si le fichier est nouveau (ou temporaire), déclenche "Enregistrer sous...", sinon sauvegarde directement.
document.getElementById('save').addEventListener('click', () => {
  const content = document.getElementById('editor').value;
  if (!currentFilePath || currentFilePath.startsWith("Nouveau-")) {
    ipcRenderer.send('save-as', content);
  } else {
    ipcRenderer.invoke('save-file', content);
  }
});

// Mise à jour de l'onglet après sauvegarde
ipcRenderer.on('file-saved', (event, newFilePath) => {
  const activeTab = tabs.find(tabObj => tabObj.tab.classList.contains('active'));
  if (activeTab) {
    activeTab.filePath = newFilePath;
    activeTab.tabLabel.textContent = path.basename(newFilePath);
  }
  currentFilePath = newFilePath;
  document.title = `Bloc-Notes - ${newFilePath}`;
});

// Bouton "Enregistrer sous..."
document.getElementById('saveAs').addEventListener('click', () => {
  const content = document.getElementById('editor').value;
  ipcRenderer.send('save-as', content);
});

// Bouton pour créer un nouvel onglet (fichier temporaire)
document.getElementById('new-tab').addEventListener('click', () => {
  const tempFilePath = `Nouveau-${Date.now()}`;
  createTab(tempFilePath);
  localStorage.setItem(tempFilePath, '');
  document.getElementById('editor').value = '';
});
