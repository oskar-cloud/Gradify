window.SearchView = (() => {
  let debounceTimer = null;
  function show(container) {
    container.innerHTML = `
      <div class="view-header"><h1 class="view-title">Search</h1></div>
      <div class="search-input-wrap">
        <span class="search-icon">${Icons.search}</span>
        <input class="search-input" id="searchInput" type="text" placeholder="What do you want to listen to?" autocomplete="off">
      </div>
      <div id="searchResults"></div>`;
    // Use requestAnimationFrame to ensure DOM is ready
    requestAnimationFrame(() => {
      const input = document.getElementById('searchInput');
      if (input) {
        input.focus();
        input.addEventListener('input', () => {
          clearTimeout(debounceTimer);
          const q = input.value.trim();
          if (!q) { document.getElementById('searchResults').innerHTML = ''; return; }
          debounceTimer = setTimeout(() => doSearch(q), 400);
        });
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.stopPropagation();
            clearTimeout(debounceTimer);
            const q = input.value.trim();
            if (q) doSearch(q);
          }
        });
      }
    });
  }
  async function doSearch(query) {
    const results = document.getElementById('searchResults');
    if (!results) return;
    console.log('[Search] Searching:', query);
    results.innerHTML = `<div class="loading-spinner"></div>`;
    try {
      const data = await window.gradify.spotify.search(query);
      console.log('[Search] Got response:', !!data, data?.__error ? data.message : 'OK');
      if (data?.__error) {
        results.innerHTML = `<div class="empty-state"><p>${esc(data.message)}</p></div>`;
        return;
      }
      if (!data) {
        results.innerHTML = `<div class="empty-state"><p>No response</p></div>`;
        return;
      }
      let html = '';
      const tracks = data?.tracks?.items || [];
      if (tracks.length) {
        html += `<div class="search-results-section"><h2 class="section-title">Songs</h2><div class="track-list">
          ${tracks.slice(0,8).map((t,i) => trackRow(t,i+1)).join('')}</div></div>`;
      }
      const albums = data?.albums?.items || [];
      if (albums.length) {
        html += `<div class="search-results-section"><h2 class="section-title">Albums</h2><div class="cards-grid">
          ${albums.slice(0,6).map(a => {
            const art = a.images?.[0]?.url || '';
            return `<div class="card" data-album-uri="${a.uri}">
              ${art ? `<img class="card-img" src="${art}" alt="">` : `<div class="card-img" style="display:flex;align-items:center;justify-content:center;background:var(--bg-elevated)">${Icons.music}</div>`}
              <div class="card-title">${esc(a.name)}</div>
              <div class="card-desc">${esc((a.artists||[]).map(x=>x.name).join(', '))}</div>
            </div>`;
          }).join('')}</div></div>`;
      }
      if (!html) html = `<div class="empty-state"><p>No results for "${esc(query)}"</p></div>`;
      results.innerHTML = html;
      results.querySelectorAll('.track-row').forEach(row => {
        row.addEventListener('click', async () => {
          const r = await window.gradify.spotify.play({ uris: [row.dataset.uri] });
          if (r?.__error) { App.showToast(r.message); return; }
          setTimeout(() => App.pollNow(), 500);
        });
      });
      results.querySelectorAll('.card[data-album-uri]').forEach(card => {
        card.addEventListener('click', async () => {
          const r = await window.gradify.spotify.play({ contextUri: card.dataset.albumUri });
          if (r?.__error) { App.showToast(r.message); return; }
          setTimeout(() => App.pollNow(), 500);
        });
      });
    } catch(e) {
      console.error('[Search] Error:', e);
      results.innerHTML = `<div class="empty-state"><p>Search failed: ${esc(e.message)}</p></div>`;
    }
  }
  function trackRow(t, num) {
    const art = t.album?.images?.[2]?.url || '';
    const artists = (t.artists || []).map(a => a.name).join(', ');
    return `<div class="track-row" data-uri="${t.uri}">
      <span class="track-num">${num}</span>
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
