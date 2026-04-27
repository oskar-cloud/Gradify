window.PlaylistView = (() => {
  async function show(container, playlistId) {
    container.innerHTML = `<div class="loading-spinner"></div>`;
    try {
      const [playlist, tracksData] = await Promise.all([
        window.gradify.spotify.getPlaylist(playlistId),
        window.gradify.spotify.getPlaylistTracks(playlistId, 0, 100)
      ]);
      if (playlist?.__error) throw new Error(playlist.message);
      if (tracksData?.__error) throw new Error(tracksData.message);
      const art = playlist.images?.[0]?.url || '';
      const tracks = (tracksData?.items || []).filter(i => i.track);
      const totalDur = tracks.reduce((s, i) => s + (i.track.duration_ms || 0), 0);
      container.innerHTML = `
        <div class="playlist-header">
          ${art ? `<img class="playlist-cover" src="${art}" alt="">` : `<div class="playlist-cover" style="display:flex;align-items:center;justify-content:center;background:var(--bg-elevated)">${Icons.music}</div>`}
          <div class="playlist-meta">
            <div class="playlist-type">Playlist</div>
            <h1 class="playlist-name">${esc(playlist.name)}</h1>
            ${playlist.description ? `<p class="playlist-desc">${playlist.description}</p>` : ''}
            <div class="playlist-stats">${tracks.length} tracks · ${fmtDur(totalDur)}</div>
          </div>
        </div>
        <div class="track-list">
          <div class="track-list-header"><span>#</span><span>Title</span><span>Album</span><span>${Icons.clock}</span></div>
          ${tracks.map((item, i) => trackRow(item.track, i + 1)).join('')}
        </div>`;
      container.querySelectorAll('.track-row').forEach(row => {
        row.addEventListener('click', async () => {
          const offset = parseInt(row.dataset.offset);
          const r = await window.gradify.spotify.play({ contextUri: playlist.uri, offset });
          if (r?.__error) { App.showToast(r.message); return; }
          setTimeout(() => App.pollNow(), 500);
        });
      });
    } catch(e) {
      container.innerHTML = `<div class="empty-state"><p>Failed to load playlist: ${esc(e.message)}</p></div>`;
    }
  }
  function trackRow(t, num) {
    const art = t.album?.images?.[2]?.url || t.album?.images?.[0]?.url || '';
    const artists = (t.artists || []).map(a => a.name).join(', ');
    const current = Player.getCurrentTrack();
    const playing = current?.id === t.id;
    return `<div class="track-row ${playing?'playing':''}" data-uri="${t.uri}" data-offset="${num-1}">
      <span class="track-num">${playing ? '<span style="color:var(--spotify-green)">♫</span>' : num}</span>
      <div class="track-info">
        ${art ? `<img class="track-art" src="${art}" alt="">` : ''}
        <div class="track-text"><div class="track-name">${esc(t.name)}</div><div class="track-artist-small">${esc(artists)}</div></div>
      </div>
      <span class="track-album">${esc(t.album?.name||'')}</span>
      <span class="track-duration">${fmtTime(t.duration_ms)}</span>
    </div>`;
  }
  function fmtTime(ms) { const s = Math.floor((ms||0)/1000); return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; }
  function fmtDur(ms) { const m = Math.floor(ms/60000); return m < 60 ? `${m} min` : `${Math.floor(m/60)} hr ${m%60} min`; }
  function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
  return { show };
})();
