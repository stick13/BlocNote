// renderer.js
const { ipcRenderer } = require("electron");

let tabs = [];
let currentTabId = null;

// DOM Elements
const editor = document.getElementById("editor");
const saveBtn = document.getElementById("save");
const saveAsBtn = document.getElementById("saveAs");
const openBtn = document.getElementById("openFile");

// Modale de fermeture d’onglet
const modal = document.getElementById("confirmation-modal");
const saveModalBtn = document.getElementById("save-modal");
const quitWithoutSavingBtn = document.getElementById("quit-without-saving");
const cancelModalBtn = document.getElementById("cancel-modal");

let pendingCloseTabId = null;

// Utility pour informer le main process de l’état unsaved
function updateUnsavedFlag() {
  const anyUnsaved = tabs.some(t => t.modified);
  ipcRenderer.send('has-unsaved', anyUnsaved);
}

// Initialisation
window.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    if (tabs.length === 0) createTab();
    updateUnsavedFlag();
  }, 100);
});

// Crée un nouvel onglet
function createTab(filePath = null, content = "") {
  const id = Date.now();
  const name = filePath ? filePath.split(/[/\\]/).pop() : "Nouveau fichier";
  const tab = { id, name, filePath, content, modified: false };
  tabs.push(tab);
  currentTabId = id;
  renderTabs();
  loadTabContent(tab);
}

// Charge le contenu d’un onglet dans le textarea
function loadTabContent(tab) {
  editor.value = tab.content || "";
  editor.focus();
}

// Affiche les onglets
function renderTabs() {
  const tabsContainer = document.getElementById("tabs");
  tabsContainer.innerHTML = "";

  tabs.forEach((tab) => {
    const tabEl = document.createElement("div");
    tabEl.className = "tab"
      + (tab.id === currentTabId ? " active" : "")
      + (tab.modified ? " modified" : "");

    const label = document.createElement("span");
    label.className = "tab-label";
    label.textContent = tab.name;
    tabEl.appendChild(label);

    const closeBtn = document.createElement("span");
    closeBtn.className = "close-btn";
    closeBtn.textContent = "✖";
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      requestTabClose(tab.id);
    };
    tabEl.appendChild(closeBtn);

    tabEl.onclick = () => {
      currentTabId = tab.id;
      loadTabContent(tab);
      renderTabs();
    };

    tabsContainer.appendChild(tabEl);
  });

  // Onglet "+"
  const plusTab = document.createElement("div");
  plusTab.className = "tab plus";
  plusTab.id = "new-tab";
  plusTab.textContent = "+";
  plusTab.onclick = () => createTab();
  tabsContainer.appendChild(plusTab);
}

// Détection de modifications
editor.addEventListener("input", () => {
  const tab = tabs.find(t => t.id === currentTabId);
  if (tab) {
    tab.content = editor.value;
    tab.modified = true;
    renderTabs();
    updateUnsavedFlag();
  }
});

// Ouvrir un fichier
openBtn.addEventListener("click", () => {
  ipcRenderer.send("open-file");
});

// Sauvegarder
saveBtn.addEventListener("click", () => {
  const tab = tabs.find(t => t.id === currentTabId);
  if (tab) {
    if (tab.filePath) {
      ipcRenderer.send("save-file", tab.filePath, tab.content);
    } else {
      ipcRenderer.send("save-file-as", tab.content);
    }
  }
});

// Enregistrer sous
saveAsBtn.addEventListener("click", () => {
  const tab = tabs.find(t => t.id === currentTabId);
  if (tab) {
    ipcRenderer.send("save-file-as", tab.content);
  }
});

// Réception d’un fichier ouvert
ipcRenderer.on("file-opened", (event, content, filePath) => {
  createTab(filePath, content);
  updateUnsavedFlag();
});

// Réception d’un fichier sauvegardé
ipcRenderer.on("file-saved", (event, filePath) => {
  const tab = tabs.find(t => t.id === currentTabId);
  if (tab) {
    tab.filePath = filePath;
    tab.name = filePath.split(/[/\\]/).pop();
    tab.modified = false;
    renderTabs();
    updateUnsavedFlag();
  }
});

// Demande de fermeture d’onglet
function requestTabClose(tabId) {
  const tab = tabs.find(t => t.id === tabId);
  if (tab.modified) {
    pendingCloseTabId = tabId;
    modal.classList.add("show");
  } else {
    closeTab(tabId);
  }
}

// Modale : Enregistrer
saveModalBtn.addEventListener("click", () => {
  const tab = tabs.find(t => t.id === pendingCloseTabId);
  if (tab.filePath) {
    ipcRenderer.send("save-file", tab.filePath, tab.content);
  } else {
    ipcRenderer.send("save-file-as", tab.content);
  }
  // on attend le 'file-saved' pour fermer l'onglet
  ipcRenderer.once("file-saved", () => {
    closeTab(pendingCloseTabId);
    modal.classList.remove("show");
  });
});

// Modale : Quitter sans enregistrer
quitWithoutSavingBtn.addEventListener("click", () => {
  closeTab(pendingCloseTabId);
  modal.classList.remove("show");
});

// Modale : Annuler
cancelModalBtn.addEventListener("click", () => {
  pendingCloseTabId = null;
  modal.classList.remove("show");
});

// Ferme un onglet, rafraîchit et peut fermer l'app
function closeTab(tabId) {
  const idx = tabs.findIndex(t => t.id === tabId);
  if (idx !== -1) {
    tabs.splice(idx, 1);
    if (tabId === currentTabId) {
      const next = tabs[idx] || tabs[idx - 1];
      currentTabId = next ? next.id : null;
      next ? loadTabContent(next) : (editor.value = "");
    }
    renderTabs();
    updateUnsavedFlag();
    if (tabs.length === 0) {
      ipcRenderer.send("close-all-tabs");
    }
  }
}

// Sauvegarde globale avant fermeture de l'app
ipcRenderer.on("app-close-save", () => {
  function saveNext() {
    const tab = tabs.find(t => t.modified);
    if (!tab) {
      ipcRenderer.send("app-close-saved");
      return;
    }
    if (tab.filePath) {
      ipcRenderer.send("save-file", tab.filePath, tab.content);
    } else {
      ipcRenderer.send("save-file-as", tab.content);
    }
    ipcRenderer.once("file-saved", () => {
      tab.modified = false;
      saveNext();
    });
  }
  saveNext();
});
