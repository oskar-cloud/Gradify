window.PlaylistView = (() => {
  async function show(container, playlistId) {
    container.innerHTML = `<div class="loading-spinner"></div>`;
    try {
      let playlist = await window.gradify.spotify.getPlaylist(playlistId);
      if (playlist?.__error) throw new Error(playlist.message);

      let tracksData = await window.gradify.spotify.getPlaylistTracks(playlistId, 0, 100);
      let isRestricted = false;
      
      if (tracksData?.__error && tracksData.message.includes('403')) {
        console.warn('[PlaylistView] 403 Forbidden. Scraping track IDs from public URL...');
        try {
          const htmlRes = await fetch(playlist.external_urls.spotify);
          const html = await htmlRes.text();
          const regex = /aria-labelledby="listrow-title-track-spotify:track:([a-zA-Z0-9]{22})(?:-\d+)?"\s+aria-label="([^"]+)"/g;
          let match;
          const scrapedTracks = [];
          const seen = new Set();
          
          while ((match = regex.exec(html)) !== null && scrapedTracks.length < 50) {
            if (!seen.has(match[1])) {
              seen.add(match[1]);
              scrapedTracks.push({
                track: {
                  id: match[1],
                  name: match[2].replace(/&amp;/g, '&'),
                  uri: `spotify:track:${match[1]}`,
                  artists: [{ name: 'Scraped Preview' }],
                  album: { name: 'Public Playlist' }
                }
              });
            }
          }
          
          if (scrapedTracks.length > 0) {
            tracksData = { items: scrapedTracks };
            isRestricted = false;
          } else {
            throw new Error('No tracks found in HTML scrape');
          }
        } catch (e) {
          console.error('[PlaylistView] Scrape fallback failed:', e);
          isRestricted = true;
          tracksData = { items: [] };
        }
      } else if (tracksData?.__error) {
        throw new Error(tracksData.message);
      }

      const art = playlist.images?.[0]?.url || '';
      console.log('[PlaylistView] tracksData:', tracksData);
      
      let itemsArray = tracksData?.items || [];
      if (Array.isArray(tracksData)) itemsArray = tracksData;

      const tracks = itemsArray.map(i => {
        if (i.track) return i;
        if (i.item) return { track: i.item }; // Feb 2026 API update changed 'track' to 'item'
        return { track: i };
      }).filter(i => i.track && i.track.id);
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
        
        ${isRestricted ? `
          <div class="empty-state" style="margin-top:40px;">
            <p>Spotify has hidden the tracklist for this public playlist.<br>However, you can still listen to it!</p>
            <button class="btn btn-primary" id="btnPlayRestricted" style="margin-top:20px;padding:12px 24px;border-radius:24px;font-weight:bold;cursor:pointer;">Play Playlist</button>
          </div>
        ` : `
        <div class="track-list">
          <div class="track-list-header"><span>#</span><span>Title</span><span>Album</span><span>${Icons.clock}</span></div>
          ${tracks.map((item, i) => trackRow(item.track, i + 1)).join('')}
        </div>
        `}
        `;

      if (isRestricted) {
        const btn = container.querySelector('#btnPlayRestricted');
        if (btn) {
          btn.addEventListener('click', async () => {
            btn.textContent = 'Starting...';
            const r = await window.gradify.spotify.play({ contextUri: playlist.uri });
            if (r?.__error) App.showToast(r.message);
            setTimeout(() => { btn.textContent = 'Play Playlist'; App.pollNow(); }, 1000);
          });
        }
      } else {
        container.querySelectorAll('.track-row').forEach(row => {
          row.addEventListener('click', async () => {
            const offset = parseInt(row.dataset.offset);
            const r = await window.gradify.spotify.play({ contextUri: playlist.uri, offset });
            if (r?.__error) { App.showToast(r.message); return; }
            setTimeout(() => App.pollNow(), 500);
          });
        });
      }
    } catch(e) {
      let msg = e.message;
      if (msg.includes('403')) {
        msg = "Spotify's Feb 2026 update restricted third-party apps from viewing public playlists you don't own.";
      }
      container.innerHTML = `<div class="empty-state"><p>Failed to load playlist:<br><br>${esc(msg)}</p></div>`;
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
