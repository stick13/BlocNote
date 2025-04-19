// home.js
const { ipcRenderer } = require('electron');

const openBtn     = document.getElementById('openFile');
const newBtn      = document.getElementById('newFile');
const resumeBtn   = document.getElementById('resumeSession');
const recentList  = document.getElementById('recent-list');

// Masquer le bouton « Reprendre » par défaut
resumeBtn.style.display = 'none';

// Actions des boutons
openBtn.addEventListener('click', () => ipcRenderer.send('open-file'));
newBtn.addEventListener('click', () => ipcRenderer.send('new-file'));
resumeBtn.addEventListener('click', () => ipcRenderer.send('resume-session'));

// Formattage du délai depuis le timestamp
function formatTimeDiff(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `il y a ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `il y a ${hrs} heure${hrs > 1 ? 's' : ''}`;
  const days = Math.floor(hrs / 24);
  return `il y a ${days} jour${days > 1 ? 's' : ''}`;
}

// Chargement et affichage des fichiers récents
async function loadRecent() {
  const recents = await ipcRenderer.invoke('get-recent');
  recentList.innerHTML = '';

  if (recents.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'no-recent';
    empty.textContent = 'Aucun fichier récent';
    recentList.appendChild(empty);
    return;
  }

  recents.forEach(item => {
    const row = document.createElement('div');
    row.className = 'recent-item';
    row.innerHTML = `
      <span class="recent-name">${item.path.split(/[/\\]/).pop()}</span>
      <span class="recent-time">${formatTimeDiff(item.timestamp)}</span>
      <span class="recent-remove" title="Supprimer">🗑️</span>
    `;
    // Clic pour ouvrir (sauf sur la poubelle)
    row.addEventListener('click', e => {
      if (e.target.classList.contains('recent-remove')) return;
      ipcRenderer.send('open-file-path', item.path);
    });
    // Clic poubelle pour supprimer
    row.querySelector('.recent-remove').addEventListener('click', async e => {
      e.stopPropagation();
      await ipcRenderer.invoke('remove-recent', item.path);
      loadRecent();
    });
    recentList.appendChild(row);
  });
}

// Au démarrage : afficher le bouton Reprendre si session existante
window.addEventListener('DOMContentLoaded', async () => {
  const hasSession = await ipcRenderer.invoke('has-session');
  if (hasSession) resumeBtn.style.display = 'inline-block';
  loadRecent();
});

// Alerte si fichier introuvable
ipcRenderer.on('file-not-found', () => {
  alert('Ce fichier n’existe plus ou est introuvable.');
  loadRecent();
});
