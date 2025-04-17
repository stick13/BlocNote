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

  const label = document.createElement('span');
  label.classList.add('tab-label');
  label.textContent = title;
  tab.appendChild(label);

  const closeBtn = document.createElement('span');
  closeBtn.classList.add('close-btn');
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', e => {
    e.stopPropagation();
    closeTab(tabId);
  });
  tab.appendChild(closeBtn);

  tab.addEventListener('click', () => switchTab(tabId));
  tabsContainer.insertBefore(tab, newTabButton);

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

  if (currentTabId && tabData[currentTabId]) {
    tabData[currentTabId].content = editor.value;
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

/** Met à jour le titre de l’onglet (astérisque si modifié) */
function updateTabTitle(tabId) {
  const data = tabData[tabId];
  const tab  = tabsContainer.querySelector(`.tab[data-id="${tabId}"]`);
  const label = tab.querySelector('.tab-label');
  label.textContent = data.title;
  tab.classList.toggle('modified', data.isModified);
}

/** Ferme un onglet */
function closeTab(tabId) {
  const allTabs = Array.from(tabsContainer.querySelectorAll('.tab'))
                        .filter(tab => tab.id !== 'new-tab');
  const idx = allTabs.findIndex(tab => tab.dataset.id === tabId);
  const wasActive = (tabId === currentTabId);

  let nextTabId = null;
  if (wasActive) {
    if (allTabs[idx + 1]) {
      nextTabId = allTabs[idx + 1].dataset.id;
    } else if (allTabs[idx - 1]) {
      nextTabId = allTabs[idx - 1].dataset.id;
    }
  }

  const tabElem = tabsContainer.querySelector(`.tab[data-id="${tabId}"]`);
  if (tabElem) tabElem.remove();
  delete tabData[tabId];

  if (wasActive) {
    if (nextTabId) {
      switchTab(nextTabId);
    } else {
      ipcRenderer.send('close-app');
    }
  }
}

// Écouteur de modifications
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

// Réception fichier ouvert
ipcRenderer.on('file-opened', (e, content, filePath) => {
  const title = filePath
    ? path.basename(filePath)
    : `Nouveau fichier ${tabCounter++}`;
  createTab(title, content, filePath);
});

// Réception fichier sauvegardé
ipcRenderer.on('file-saved', (e, savedPath) => {
  if (!currentTabId) return;
  const data = tabData[currentTabId];
  data.originalContent = data.content;
  data.filePath = savedPath;
  data.title = path.basename(savedPath);
  data.isModified = false;
  updateTabTitle(currentTabId);
});
