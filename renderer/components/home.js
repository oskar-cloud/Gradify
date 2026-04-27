window.HomeView = (() => {
  async function show(container) {
    container.innerHTML = `
      <div class="view-header">
        <h1 class="view-title">Good ${getGreeting()}</h1>
        <p class="view-subtitle">Here's what you've been listening to</p>
      </div>
      <div class="loading-spinner" id="homeLoader"></div>
      <div id="homeContent" style="display:none"></div>`;
    try {
      const data = await window.gradify.spotify.getRecentlyPlayed();
      if (data?.__error) throw new Error(data.message);
      const tracks = dedup(data?.items || []);
      const content = document.getElementById('homeContent');
      const loader = document.getElementById('homeLoader');
      if (!content || !loader) return;
      loader.style.display = 'none';
      content.style.display = 'block';
      if (!tracks.length) { content.innerHTML = `<div class="empty-state">${Icons.music}<p>No recently played tracks</p></div>`; return; }
      content.innerHTML = `
        <h2 class="section-title">Recently Played</h2>
        <div class="cards-grid">${tracks.slice(0,12).map(item => {
          const t = item.track;
          const art = t.album?.images?.[0]?.url || '';
          return `<div class="card" data-uri="${t.uri}" data-context="${t.album?.uri||''}">
            ${art ? `<img class="card-img" src="${art}" alt="">` : `<div class="card-img" style="display:flex;align-items:center;justify-content:center;background:var(--bg-elevated)">${Icons.music}</div>`}
            <div class="card-title">${esc(t.name)}</div>
            <div class="card-desc">${esc((t.artists||[]).map(a=>a.name).join(', '))}</div>
          </div>`;
        }).join('')}</div>`;
      content.querySelectorAll('.card[data-uri]').forEach(card => {
        card.addEventListener('click', () => playItem(card.dataset.context, card.dataset.uri));
      });
    } catch(e) {
      const loader = document.getElementById('homeLoader');
      if (loader) loader.innerHTML = `<div class="empty-state"><p>Could not load recent tracks</p></div>`;
    }
  }
  function dedup(items) { const s = new Set(); return items.filter(i => { if (s.has(i.track.id)) return false; s.add(i.track.id); return true; }); }
  function getGreeting() { const h = new Date().getHours(); if (h < 12) return 'morning'; if (h < 18) return 'afternoon'; return 'evening'; }
  function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
  async function playItem(contextUri, trackUri) {
    let r;
    if (contextUri) r = await window.gradify.spotify.play({ contextUri });
    else r = await window.gradify.spotify.play({ uris: [trackUri] });
    if (r?.__error) { App.showToast(r.message); return; }
    setTimeout(() => App.pollNow(), 500);
  }
  return { show };
})();
