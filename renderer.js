const { ipcRenderer } = require("electron");
const fs = require("fs");
const path = require("path");

let tabData = {};
let currentTabId = null;

const editor = document.getElementById("editor");
const tabsContainer = document.getElementById("tabs");
const openFileButton = document.getElementById("openFile");
const saveButton = document.getElementById("save");
const saveAsButton = document.getElementById("saveAs");
const newTabButton = document.getElementById("new-tab");

function createTab(filePath = null, content = "") {
  const tabId = `tab-${Date.now()}`;
  const fileName = filePath ? path.basename(filePath) : "Nouveau fichier";

  const tab = document.createElement("div");
  tab.classList.add("tab");
  tab.id = tabId;

  const label = document.createElement("span");
  label.classList.add("tab-label");
  label.textContent = fileName;
  tab.appendChild(label);

  const closeBtn = document.createElement("span");
  closeBtn.classList.add("close-btn");
  closeBtn.textContent = "✕";
  tab.appendChild(closeBtn);

  tabsContainer.insertBefore(tab, newTabButton);

  tab.addEventListener("click", () => switchTab(tabId));
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    closeTab(tabId);
  });

  tabData[tabId] = {
    filePath,
    originalContent: content,
    currentContent: content,
    isModified: false,
  };

  switchTab(tabId);
}

function switchTab(tabId) {
  if (currentTabId === tabId) return;

  const currentTabElement = document.getElementById(currentTabId);
  if (currentTabElement) currentTabElement.classList.remove("active");

  const newTabElement = document.getElementById(tabId);
  if (newTabElement) newTabElement.classList.add("active");

  const data = tabData[tabId];
  editor.value = data.currentContent;
  currentTabId = tabId;
}

function closeTab(tabId) {
  const data = tabData[tabId];
  if (!data) return;

  if (data.isModified) {
    const response = confirm("Ce fichier a été modifié. Voulez-vous sauvegarder avant de fermer ?");
    if (response) {
      saveFile(tabId);
    }
  }

  const tabElement = document.getElementById(tabId);
  if (tabElement) tabElement.remove();

  delete tabData[tabId];

  if (currentTabId === tabId) {
    const remainingTabs = Object.keys(tabData);
    if (remainingTabs.length > 0) {
      switchTab(remainingTabs[0]);
    } else {
      currentTabId = null;
      editor.value = "";
      ipcRenderer.send("no-tabs-left");
    }
  }
}

function saveFile(tabId = currentTabId) {
  const data = tabData[tabId];
  if (!data) return;

  if (data.filePath) {
    fs.writeFileSync(data.filePath, data.currentContent, "utf8");
    data.originalContent = data.currentContent;
    data.isModified = false;
    updateTabLabel(tabId);
  } else {
    ipcRenderer.invoke("show-save-dialog").then((filePath) => {
      if (filePath) {
        data.filePath = filePath;
        fs.writeFileSync(filePath, data.currentContent, "utf8");
        data.originalContent = data.currentContent;
        data.isModified = false;
        updateTabLabel(tabId, path.basename(filePath));
      }
    });
  }
}

function saveFileAs() {
  const data = tabData[currentTabId];
  if (!data) return;

  ipcRenderer.invoke("show-save-dialog").then((filePath) => {
    if (filePath) {
      data.filePath = filePath;
      fs.writeFileSync(filePath, data.currentContent, "utf8");
      data.originalContent = data.currentContent;
      data.isModified = false;
      updateTabLabel(currentTabId, path.basename(filePath));
    }
  });
}

function updateTabLabel(tabId, newLabel = null) {
  const tabElement = document.getElementById(tabId);
  if (!tabElement) return;

  const labelSpan = tabElement.querySelector(".tab-label");
  const data = tabData[tabId];

  if (newLabel) {
    labelSpan.textContent = newLabel;
  }

  if (data.isModified) {
    tabElement.classList.add("modified");
  } else {
    tabElement.classList.remove("modified");
  }
}

editor.addEventListener("input", () => {
  const data = tabData[currentTabId];
  if (!data) return;

  data.currentContent = editor.value;
  data.isModified = data.currentContent !== data.originalContent;
  updateTabLabel(currentTabId);
});

openFileButton.addEventListener("click", () => {
  ipcRenderer.invoke("show-open-dialog").then((filePath) => {
    if (filePath) {
      const existingTabId = Object.keys(tabData).find(
        (id) => tabData[id].filePath === filePath
      );

      if (existingTabId) {
        switchTab(existingTabId);
        return;
      }

      const content = fs.readFileSync(filePath, "utf8");
      createTab(filePath, content);
    }
  });
});

saveButton.addEventListener("click", () => {
  saveFile();
});

saveAsButton.addEventListener("click", () => {
  saveFileAs();
});

newTabButton.addEventListener("click", () => {
  createTab();
});

window.addEventListener("DOMContentLoaded", () => {
  createTab();
});
