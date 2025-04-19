// renderer.js
const { ipcRenderer } = require('electron');
const path = require('path');

let tabs = [];
let currentTabId = null;
let sessionRestored = false;

// DOM
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

// Envoie au main si un des onglets est modifié
function updateUnsavedFlag() {
  ipcRenderer.send('has-unsaved', hasUnsaved);
}
// Sauvegarde de session : on n’enregistre que les onglets utiles
function updateSession() {
  const sessionTabs = tabs
    .filter(t => t.filePath || t.modified)
    .map(t => ({
      filePath: t.filePath,
      content:  t.content,
      modified: t.modified
    }));
  ipcRenderer.send('session-save', sessionTabs);
}
// Rend la barre d’onglets, n’active que celui à currentTabId
function renderTabs() {
  const container = document.getElementById("tabs");
  container.innerHTML = "";
  for (const tab of tabs) {
    const el = document.createElement("div");
    el.className = "tab"
      + (tab.id === currentTabId ? " active" : "")
      + (tab.modified ? " modified" : "");
    const lbl = document.createElement("span");
    lbl.className = "tab-label";
    lbl.textContent = tab.name;
    el.appendChild(lbl);

    const closeBtn = document.createElement("span");
    closeBtn.className = "close-btn";
    closeBtn.textContent = "✖";
    closeBtn.onclick = e => { e.stopPropagation(); requestTabClose(tab.id); };
    el.appendChild(closeBtn);

    el.onclick = () => {
      currentTabId = tab.id;
      renderTabs();
      loadTabContent(tab);
    };

    container.appendChild(el);
  }
  const plus = document.createElement("div");
  plus.className = "tab plus";
  plus.textContent = "+";
  plus.onclick = () => createNewTab();
  container.appendChild(plus);
}
// Charge le contenu dans le textarea
function loadTabContent(tab) {
  editor.value = tab.content;
  editor.focus();
}
// Crée un nouvel onglet vierge
function createNewTab() {
  const id   = Date.now();
  const tab  = { id, name: "Nouveau fichier", filePath: null, content: "", modified: false };
  tabs.push(tab);
  currentTabId = id;
  renderTabs();
  loadTabContent(tab);
  updateSession();
}
// Marquage “modifié”
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
// Boutons “ouvrir / sauver / sauver sous”
openBtn.addEventListener("click", () => ipcRenderer.send("open-file"));
saveBtn.addEventListener("click", () => {
  const tab = tabs.find(t => t.id === currentTabId);
  if (!tab) return;
  ipcRenderer.send(tab.filePath ? "save-file" : "save-file-as", tab.filePath, tab.content);
});
saveAsBtn.addEventListener("click", () => {
  const tab = tabs.find(t => t.id === currentTabId);
  if (tab) ipcRenderer.send("save-file-as", tab.content);
});

// ===== Restauration de session =====
ipcRenderer.on("session-data", (_evt, sessionTabs) => {
  sessionRestored = true;
  tabs = [];  // on réinitialise complètement
  // on reconstruit tabs[]
  for (const t of sessionTabs) {
    tabs.push({
      id: Date.now() + Math.random(),       // génération simple d'un ID unique
      name: path.basename(t.filePath || "Nouveau fichier"),
      filePath: t.filePath,
      content:  t.content,
      modified: t.modified
    });
  }
  // on active le dernier
  const last = tabs[tabs.length - 1];
  if (last) currentTabId = last.id;
  // enfin on rafraîchit l'UI et on charge son contenu
  renderTabs();
  if (last) loadTabContent(last);

  hasUnsaved = tabs.some(t => t.modified);
  updateUnsavedFlag();
});

// Onglet supplémentaire demandé par main
ipcRenderer.on("create-new-tab", () => createNewTab());

// Ouverture d’un fichier déclenchée par main
ipcRenderer.on("file-opened", (_evt, content, filePath) => {
  const id   = Date.now();
  const tab  = { id, name: path.basename(filePath), filePath, content, modified: false };
  tabs.push(tab);
  currentTabId = id;
  renderTabs();
  loadTabContent(tab);
  updateSession();
});

// Après sauvegarde
ipcRenderer.on("file-saved", (_evt, filePath) => {
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

// Fermeture d’un onglet
function requestTabClose(tabId) {
  const tab = tabs.find(t => t.id === tabId);
  if (tab && tab.modified) {
    pendingCloseTabId = tabId;
    modal.classList.add("show");
  } else {
    closeTab(tabId);
  }
}
saveModalBtn.addEventListener("click", () => {
  const tab = tabs.find(t => t.id === pendingCloseTabId);
  ipcRenderer.send(tab.filePath ? "save-file" : "save-file-as", tab.filePath, tab.content);
  ipcRenderer.once("file-saved", () => {
    closeTab(pendingCloseTabId);
    modal.classList.remove("show");
  });
});
quitWithoutSavingBtn.addEventListener("click", () => {
  closeTab(pendingCloseTabId);
  modal.classList.remove("show");
});
cancelModalBtn.addEventListener("click", () => {
  pendingCloseTabId = null;
  modal.classList.remove("show");
});
function closeTab(tabId) {
  const idx = tabs.findIndex(t => t.id === tabId);
  if (idx < 0) return;
  tabs.splice(idx, 1);
  if (tabId === currentTabId) {
    const next = tabs[idx] || tabs[idx - 1];
    currentTabId = next ? next.id : null;
    if (next) loadTabContent(next);
  }
  hasUnsaved = tabs.some(t => t.modified);
  renderTabs();
  updateUnsavedFlag();
  updateSession();
  if (tabs.length === 0) ipcRenderer.send("close-all-tabs");
}
// prompt-global
ipcRenderer.on("app-close-save", () => {
  requestTabClose(currentTabId);
});
// Au chargement initial, si pas de session, on ouvre un onglet vierge
window.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    if (!sessionRestored && tabs.length === 0) createNewTab();
  }, 100);
});
