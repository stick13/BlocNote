// renderer.js
const { ipcRenderer } = require('electron');

let tabs = [];
let currentTabId = null;
let sessionRestored = false;

// Éléments du DOM
const editor               = document.getElementById("editor");
const saveBtn              = document.getElementById("save");
const saveAsBtn            = document.getElementById("saveAs");
const openBtn              = document.getElementById("openFile");
const modal                = document.getElementById("confirmation-modal");
const saveModalBtn         = document.getElementById("save-modal");
const quitWithoutSavingBtn = document.getElementById("quit-without-saving");
const cancelModalBtn       = document.getElementById("cancel-modal");

let pendingCloseTabId = null;
let hasUnsaved        = false;

// Informe le main du statut unsaved (pour le prompt de fermeture)
function updateUnsavedFlag() {
  ipcRenderer.send('has-unsaved', hasUnsaved);
}

// Persistance de la session : on n’enregistre que les onglets
// qui ont un fichier associé ou qui ont été modifiés
function updateSession() {
  const sessionTabs = tabs
    .filter(t => t.filePath || t.modified)   // ignore les onglets vierges non modifiés
    .map(t => ({
      filePath: t.filePath,
      content:  t.content,
      modified: t.modified
    }));
  ipcRenderer.send('session-save', sessionTabs);
}

// Création d’un onglet
function createTab(filePath = null, content = "", restore = false, restoredModified = false) {
  const id   = Date.now();
  const name = filePath ? path.basename(filePath) : "Nouveau fichier";
  const tab  = {
    id,
    name,
    filePath,
    content,
    modified: restore ? restoredModified : false
  };
  tabs.push(tab);
  currentTabId = id;
  renderTabs();
  loadTabContent(tab);
  if (!restore) updateSession();
}

// Charge le contenu dans l’éditeur
function loadTabContent(tab) {
  editor.value = tab.content || "";
  editor.focus();
}

// Affiche tous les onglets
function renderTabs() {
  const container = document.getElementById("tabs");
  container.innerHTML = "";
  tabs.forEach(tab => {
    const el = document.createElement("div");
    el.className = "tab"
      + (tab.id === currentTabId ? " active" : "")
      + (tab.modified  ? " modified" : "");
    const label = document.createElement("span");
    label.className = "tab-label";
    label.textContent = tab.name;
    el.appendChild(label);
    const closeBtn = document.createElement("span");
    closeBtn.className = "close-btn";
    closeBtn.textContent = "✖";
    closeBtn.onclick = e => { e.stopPropagation(); requestTabClose(tab.id); };
    el.appendChild(closeBtn);
    el.onclick = () => {
      currentTabId = tab.id;
      loadTabContent(tab);
      renderTabs();
    };
    container.appendChild(el);
  });
  // Onglet "+"
  const plus = document.createElement("div");
  plus.className = "tab plus";
  plus.textContent = "+";
  plus.onclick = () => createTab();
  container.appendChild(plus);
}

// Détecte la modification de l’éditeur
editor.addEventListener("input", () => {
  const tab = tabs.find(t => t.id === currentTabId);
  if (!tab) return;
  tab.content  = editor.value;
  tab.modified = true;
  hasUnsaved   = true;
  renderTabs();
  updateUnsavedFlag();
  updateSession();
});

// Gestion des boutons
openBtn.addEventListener("click", () => ipcRenderer.send("open-file"));
saveBtn.addEventListener("click", () => {
  const tab = tabs.find(t => t.id === currentTabId);
  if (!tab) return;
  if (tab.filePath) ipcRenderer.send("save-file", tab.filePath, tab.content);
  else               ipcRenderer.send("save-file-as", tab.content);
});
saveAsBtn.addEventListener("click", () => {
  const tab = tabs.find(t => t.id === currentTabId);
  if (tab) ipcRenderer.send("save-file-as", tab.content);
});

// Réception des données de session au démarrage
ipcRenderer.on("session-data", (_, sessionTabs) => {
  sessionRestored = true;
  sessionTabs.forEach(t =>
    createTab(t.filePath, t.content, true, t.modified)
  );
  hasUnsaved = tabs.some(t => t.modified);
  updateUnsavedFlag();
});

// Création d’un onglet vierge sur demande
ipcRenderer.on("create-new-tab", () => createTab());

// Réception d’un fichier ouvert via menu ou récents
ipcRenderer.on("file-opened", (_, content, filePath) => {
  createTab(filePath, content);
});

// Après sauvegarde réussie
ipcRenderer.on("file-saved", (_, filePath) => {
  const tab = tabs.find(t => t.id === currentTabId);
  if (!tab) return;
  tab.filePath = filePath;
  tab.name     = path.basename(filePath);
  tab.modified = false;
  hasUnsaved   = tabs.some(t => t.modified);
  renderTabs();
  updateUnsavedFlag();
  updateSession();
});

// Demande de fermeture d’un onglet
function requestTabClose(tabId) {
  const tab = tabs.find(t => t.id === tabId);
  if (tab && tab.modified) {
    pendingCloseTabId = tabId;
    modal.classList.add("show");
  } else {
    closeTab(tabId);
  }
}

// Bouton modale « Enregistrer »
saveModalBtn.addEventListener("click", () => {
  const tab = tabs.find(t => t.id === pendingCloseTabId);
  if (!tab) return;
  if (tab.filePath) ipcRenderer.send("save-file", tab.filePath, tab.content);
  else               ipcRenderer.send("save-file-as", tab.content);
  ipcRenderer.once("file-saved", () => {
    closeTab(pendingCloseTabId);
    modal.classList.remove("show");
  });
});

// Bouton modale « Quitter sans enregistrer »
quitWithoutSavingBtn.addEventListener("click", () => {
  closeTab(pendingCloseTabId);
  modal.classList.remove("show");
});

// Bouton modale « Annuler »
cancelModalBtn.addEventListener("click", () => {
  pendingCloseTabId = null;
  modal.classList.remove("show");
});

// Ferme un onglet et met à jour la session
function closeTab(tabId) {
  const idx = tabs.findIndex(t => t.id === tabId);
  if (idx < 0) return;
  tabs.splice(idx, 1);
  if (tabId === currentTabId) {
    const next = tabs[idx] || tabs[idx - 1];
    currentTabId = next ? next.id : null;
    if (next) loadTabContent(next);
    else       editor.value = "";
  }
  hasUnsaved = tabs.some(t => t.modified);
  renderTabs();
  updateUnsavedFlag();
  updateSession();
  if (tabs.length === 0) ipcRenderer.send("close-all-tabs");
}

// Lorsque main demande un prompt-global
ipcRenderer.on("app-close-save", () => {
  requestTabClose(currentTabId);
});

// À l'ouverture, si pas de session restaurée, créer un onglet vide
window.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    if (!sessionRestored && tabs.length === 0) createTab();
  }, 100);
});
