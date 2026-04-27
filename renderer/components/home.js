window.HomeView = (() => {
  let recentTracks = [];

  async function show(container) {
    container.innerHTML = `
      <div class="view-header">
        <h1 class="view-title">Good ${getGreeting()}</h1>
        <p class="view-subtitle">Here's what you've been listening to</p>
      </div>
      <div class="loading-spinner" id="homeLoader"></div>
      <div id="homeContent" style="display:none"></div>
    `;

    try {
      const data = await window.gradify.spotify.getRecentlyPlayed();
      recentTracks = deduplicateTracks(data?.items || []);

      const content = document.getElementById('homeContent');
      const loader = document.getElementById('homeLoader');
      if (!content || !loader) return;
      loader.style.display = 'none';
      content.style.display = 'block';

      content.innerHTML = `
        <h2 class="section-title">Recently Played</h2>
        <div class="cards-grid">
          ${recentTracks.slice(0, 12).map(item => {
            const t = item.track;
            const art = t.album?.images?.[0]?.url || '';
            return `
              <div class="card" data-uri="${t.uri}" data-context="${t.album?.uri || ''}" style="position:relative">
                ${art ? `<img class="card-img" src="${art}" alt="">` : `<div class="card-img" style="display:flex;align-items:center;justify-content:center;background:var(--bg-elevated)">${Icons.music}</div>`}
                <div class="card-title">${escapeHtml(t.name)}</div>
                <div class="card-desc">${escapeHtml((t.artists||[]).map(a=>a.name).join(', '))}</div>
              </div>`;
          }).join('')}
        </div>
      `;

      content.querySelectorAll('.card[data-uri]').forEach(card => {
        card.addEventListener('click', async () => {
          try {
            const ctx = card.dataset.context;
            const uri = card.dataset.uri;
            if (ctx) await window.gradify.spotify.play({ contextUri: ctx, uris: undefined });
            else await window.gradify.spotify.play({ uris: [uri] });
            setTimeout(() => window.App?.pollNow(), 400);
          } catch(e) { window.App?.showToast(e.message); }
        });
      });
    } catch(e) {
      const loader = document.getElementById('homeLoader');
      if (loader) loader.innerHTML = `<div class="empty-state"><p>Could not load recent tracks</p></div>`;
    }
  }

  function deduplicateTracks(items) {
    const seen = new Set();
    return items.filter(i => { if (seen.has(i.track.id)) return false; seen.add(i.track.id); return true; });
  }

  function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'morning';
    if (h < 18) return 'afternoon';
    return 'evening';
  }

  function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

  return { show };
})();
