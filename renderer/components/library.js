window.LibraryView = (() => {
  async function show(container) {
    container.innerHTML = `
      <div class="view-header"><h1 class="view-title">Liked Songs</h1><p class="view-subtitle">Your saved tracks</p></div>
      <div class="loading-spinner" id="libLoader"></div>
      <div id="libContent" style="display:none"></div>`;
    try {
      const data = await window.gradify.spotify.getSavedTracks(0, 50);
      if (data?.__error) throw new Error(data.message);
      const tracks = (data?.items || []).filter(i => i.track);
      const content = document.getElementById('libContent');
      const loader = document.getElementById('libLoader');
      if (!content || !loader) return;
      loader.style.display = 'none';
      content.style.display = 'block';
      if (!tracks.length) { content.innerHTML = `<div class="empty-state">${Icons.heart}<p>No liked songs yet</p></div>`; return; }
      content.innerHTML = `<div class="track-list">
        <div class="track-list-header"><span>#</span><span>Title</span><span>Album</span><span>${Icons.clock}</span></div>
        ${tracks.map((item, i) => trackRow(item.track, i + 1)).join('')}
      </div>`;
      content.querySelectorAll('.track-row').forEach(row => {
        row.addEventListener('click', async () => {
          const r = await window.gradify.spotify.play({ uris: [row.dataset.uri] });
          if (r?.__error) { App.showToast(r.message); return; }
          setTimeout(() => App.pollNow(), 500);
        });
      });
    } catch(e) {
      const loader = document.getElementById('libLoader');
      if (loader) loader.innerHTML = `<div class="empty-state"><p>Could not load liked songs</p></div>`;
    }
  }
  function trackRow(t, num) {
    const art = t.album?.images?.[2]?.url || t.album?.images?.[0]?.url || '';
    const artists = (t.artists || []).map(a => a.name).join(', ');
    const current = Player.getCurrentTrack();
    const playing = current?.id === t.id;
    return `<div class="track-row ${playing?'playing':''}" data-uri="${t.uri}">
      <span class="track-num">${playing ? '<span style="color:var(--spotify-green)">♫</span>' : num}</span>
      <div class="track-info">
        ${art ? `<img class="track-art" src="${art}" alt="">` : ''}
        <div class="track-text"><div class="track-name">${esc(t.name)}</div><div class="track-artist-small">${esc(artists)}</div></div>
      </div>
      <span class="track-album">${esc(t.album?.name||'')}</span>
      <span class="track-duration">${fmt(t.duration_ms)}</span>
    </div>`;
  }
  function fmt(ms) { const s = Math.floor((ms||0)/1000); return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; }
  function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
  return { show };
})();
