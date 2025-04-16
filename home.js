const { ipcRenderer } = require('electron');

// 📂 Bouton "Ouvrir un fichier"
document.getElementById('openFile').addEventListener('click', () => {
    ipcRenderer.send('open-file');
});

// 📝 Bouton "Créer un nouveau fichier"
document.getElementById('newFile').addEventListener('click', () => {
    ipcRenderer.send('new-file');
});