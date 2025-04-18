// renderer.js
const { ipcRenderer } = require("electron");

let tabs = [];
let currentTabId = null;

// DOM Elements
const editor = document.getElementById("editor");
const saveBtn = document.getElementById("save");
const saveAsBtn = document.getElementById("saveAs");
const openBtn = document.getElementById("openFile");

// Modale de fermeture d’onglet (existant)
const modal = document.getElementById("confirmation-modal");
const saveModalBtn = document.getElementById("save-modal");
const quitWithoutSavingBtn = document.getElementById("quit-without-saving");
const cancelModalBtn = document.getElementById("cancel-modal");
let pendingCloseTabId = null;

// (Nouvelle modale à ajouter dans editor.html)
/*
<div id="app-close-modal" class="modal">
  <div class="modal-content">
    <p>Vous avez des fichiers modifiés. Que souhaitez‑vous faire ?</p>
    <div class="modal-buttons">
      <button id="save-all-modal">Enregistrer tout</button>
      <button id="quit-all-modal">Quitter sans enregistrer</button>
      <button id="cancel-all-modal">Annuler</button>
    </div>
  </div>
</div>
*/
const appCloseModal = document.getElementById("app-close-modal");
const saveAllModalBtn = document.getElementById("save-all-modal");
const quitAllModalBtn = document.getElementById("quit-all-modal");
const cancelAllModalBtn = document.getElementById("cancel-all-modal");

window.addEventListener("DOMContentLoaded", () => {
  setTimeout(() => {
    if (tabs.length === 0) createTab();
  }, 100);
});

function createTab(filePath = null, content = "") {
  const id = Date.now();
  const name = filePath ? filePath.split(/[/\\]/).pop() : "Nouveau fichier";
  const tab = { id, name, filePath, content, modified: false };
  tabs.push(tab);
  currentTabId = id;
  renderTabs();
  loadTabContent(tab);
}

function loadTabContent(tab) {
  editor.value = tab.content || "";
  editor.focus();
}

function renderTabs() {
  const tabsContainer = document.getElementById("tabs");
  tabsContainer.innerHTML = "";
  tabs.forEach(tab => {
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
    closeBtn.onclick = e => { e.stopPropagation(); requestTabClose(tab.id); };
    tabEl.appendChild(closeBtn);
    tabEl.onclick = () => { currentTabId = tab.id; loadTabContent(tab); renderTabs(); };
    tabsContainer.appendChild(tabEl);
  });
  const plusTab = document.createElement("div");
  plusTab.className = "tab plus";
  plusTab.id = "new-tab";
  plusTab.textContent = "+";
  plusTab.onclick = () => createTab();
  tabsContainer.appendChild(plusTab);
}

editor.addEventListener("input", () => {
  const tab = tabs.find(t => t.id === currentTabId);
  if (tab) { tab.content = editor.value; tab.modified = true; renderTabs(); }
});

openBtn.addEventListener("click", () => ipcRenderer.send("open-file"));
saveBtn.addEventListener("click", () => {
  const tab = tabs.find(t => t.id === currentTabId);
  if (tab) {
    if (tab.filePath) {
      ipcRenderer.send("save-file", tab.filePath, tab.content);
      tab.modified = false;
      renderTabs();
    } else {
      ipcRenderer.send("save-file-as", tab.content);
    }
  }
});
saveAsBtn.addEventListener("click", () => {
  const tab = tabs.find(t => t.id === currentTabId);
  if (tab) ipcRenderer.send("save-file-as", tab.content);
});

ipcRenderer.on("file-opened", (e, content, filePath) => createTab(filePath, content));
ipcRenderer.on("file-saved", (e, filePath) => {
  const tab = tabs.find(t => t.id === currentTabId);
  if (tab) {
    tab.filePath = filePath;
    tab.name = filePath.split(/[/\\]/).pop();
    tab.modified = false;
    renderTabs();
  }
});

function requestTabClose(tabId) {
  const tab = tabs.find(t => t.id === tabId);
  if (tab.modified) {
    pendingCloseTabId = tabId;
    modal.style.display = "flex";
  } else {
    closeTab(tabId);
  }
}

saveModalBtn.addEventListener("click", () => {
  const tab = tabs.find(t => t.id === pendingCloseTabId);
  if (tab.filePath) {
    ipcRenderer.send("save-file", tab.filePath, tab.content);
    closeTab(pendingCloseTabId);
    modal.style.display = "none";
  } else {
    ipcRenderer.send("save-file-as", tab.content);
    ipcRenderer.once("file-saved", () => {
      closeTab(pendingCloseTabId);
      modal.style.display = "none";
    });
  }
});
quitWithoutSavingBtn.addEventListener("click", () => {
  closeTab(pendingCloseTabId);
  modal.style.display = "none";
});
cancelModalBtn.addEventListener("click", () => {
  pendingCloseTabId = null;
  modal.style.display = "none";
});

function closeTab(tabId) {
  const idx = tabs.findIndex(t => t.id === tabId);
  if (idx !== -1) {
    tabs.splice(idx, 1);
    if (tabId === currentTabId) {
      const next = tabs[idx] || tabs[idx - 1];
      currentTabId = next ? next.id : null;
      next ? loadTabContent(next) : editor.value = "";
    }
    renderTabs();
    if (tabs.length === 0) {
      ipcRenderer.send('close-all-tabs');
    }
  }
}

// === Gestion de la fermeture de l'app depuis main.js ===
ipcRenderer.on('app-close-save', () => {
  // Sauvegarde séquentielle de tous les onglets modifiés
  function saveNext() {
    const tab = tabs.find(t => t.modified);
    if (!tab) {
      ipcRenderer.send('app-close-saved');
      return;
    }
    if (tab.filePath) {
      ipcRenderer.send('save-file', tab.filePath, tab.content);
      ipcRenderer.once('file-saved', () => {
        tab.modified = false;
        saveNext();
      });
    } else {
      ipcRenderer.send('save-file-as', tab.content);
      ipcRenderer.once('file-saved', (event, filePath) => {
        tab.filePath = filePath;
        tab.name = filePath.split(/[/\\]/).pop();
        tab.modified = false;
        saveNext();
      });
    }
  }
  saveNext();
});
