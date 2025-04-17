const { ipcRenderer } = require('electron');
const path = require('path');

const editor        = document.getElementById('editor');
const tabsContainer = document.getElementById('tabs');
const newTabButton  = document.getElementById('new-tab');
const openButton    = document.getElementById('openFile');
const saveButton    = document.getElementById('save');
const saveAsButton  = document.getElementById('saveAs');

let tabCounter    = 1;
let currentTabId  = null;
const tabData     = {};

/** Crée et active un onglet */
function createTab(title = `Nouveau fichier ${tabCounter++}`, content = "", filePath = null) {
  const tabId = `tab-${Date.now()}`;
  const tab   = document.createElement('div');
  tab.classList.add('tab');
  tab.dataset.id = tabId;

  // Label
  const label = document.createElement('span');
  label.classList.add('tab-label');
  label.textContent = title;
  tab.appendChild(label);

  // Croix de fermeture
  const closeBtn = document.createElement('span');
  closeBtn.classList.add('close-btn');
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', e => {
    e.stopPropagation();
    closeTab(tabId);
  });
  tab.appendChild(closeBtn);

  // Clic pour activer
  tab.addEventListener('click', () => switchTab(tabId));

  // Insère AVANT le bouton "+", qui reste en dernier
  tabsContainer.insertBefore(tab, newTabButton);

  // Stocke les données de l'onglet
  tabData[tabId] = {
    title,
    content,
    originalContent: content,
    filePath,
    isModified: false
  };

  switchTab(tabId);
}

/** Active un onglet existant */
function switchTab(tabId) {
    if (tabId === currentTabId) return;
  
    // 🔒 Si l’ancien onglet n’existe plus, on skippe la sauvegarde
    if (currentTabId && tabData[currentTabId]) {
      const prev = tabData[currentTabId];
      prev.content = editor.value;
      updateTabTitle(currentTabId);
      tabsContainer
        .querySelector(`.tab[data-id="${currentTabId}"]`)
        .classList.remove('active');
    }
  
    currentTabId = tabId;
    const data = tabData[tabId];
    editor.value = data.content;
    tabsContainer
      .querySelector(`.tab[data-id="${tabId}"]`)
      .classList.add('active');
  }

/** Met à jour l’apparence du titre (astérisque si modifié) */
function updateTabTitle(tabId) {
  const data = tabData[tabId];
  const tab  = tabsContainer.querySelector(`.tab[data-id="${tabId}"]`);
  const label = tab.querySelector('.tab-label');
  label.textContent = data.title;
  tab.classList.toggle('modified', data.isModified);
}

/** Ferme un onglet et, s’il n’en reste plus, ferme l’app */
function closeTab(tabId) {
    // Liste les onglets visibles (hors "+")
    const allTabs = Array.from(tabsContainer.querySelectorAll('.tab'))
                         .filter(t => t.id !== 'new-tab');
    const idx       = allTabs.findIndex(t => t.dataset.id === tabId);
    const wasActive = (tabId === currentTabId);
  
    let nextTabId = null;
    if (wasActive) {
      // Essaie le suivant, sinon le précédent
      if (allTabs[idx + 1])      nextTabId = allTabs[idx + 1].dataset.id;
      else if (allTabs[idx - 1]) nextTabId = allTabs[idx - 1].dataset.id;
  
      if (nextTabId) {
        // Switch **avant** suppression
        switchTab(nextTabId);
      } else {
        // Pas de suivant → on quitte
        ipcRenderer.send('close-app');
        return;
      }
    }
  
    // Ensuite on supprime l’onglet fermé
    const tabElem = tabsContainer.querySelector(`.tab[data-id="${tabId}"]`);
    if (tabElem) tabElem.remove();
    delete tabData[tabId];
  }  

// Détecte les modifs dans l’éditeur
editor.addEventListener('input', () => {
  if (!currentTabId) return;
  const data = tabData[currentTabId];
  data.content = editor.value;
  data.isModified = data.content !== data.originalContent;
  updateTabTitle(currentTabId);
});

// Boutons
newTabButton.addEventListener('click',  () => createTab());
openButton.addEventListener('click',    () => ipcRenderer.send('open-file'));
saveButton.addEventListener('click',    () => {
  if (!currentTabId) return;
  ipcRenderer.invoke('save-file', tabData[currentTabId].content);
});
saveAsButton.addEventListener('click',  () => {
  if (!currentTabId) return;
  ipcRenderer.send('save-as', tabData[currentTabId].content);
});

// À la réception d'un fichier (ou d’un nouveau)
ipcRenderer.on('file-opened', (e, content, filePath) => {
  const title = filePath
    ? path.basename(filePath)
    : `Nouveau fichier ${tabCounter++}`;
  createTab(title, content, filePath);
});

// À la réception d’un enregistrement
ipcRenderer.on('file-saved', (e, savedPath) => {
  if (!currentTabId) return;
  const data = tabData[currentTabId];
  data.originalContent = data.content;
  data.filePath = savedPath;
  data.title = path.basename(savedPath);
  data.isModified = false;
  updateTabTitle(currentTabId);
});
