window.Player = (() => {
  let state = { track: null, isPlaying: false, progressMs: 0, durationMs: 0, volume: 50 };
  let progressTimer = null;

  function render() {
    const el = document.getElementById('playerBar');
    if (!state.track) {
      el.innerHTML = `<div class="player-nothing">No track playing — play something on Spotify to get started</div>`;
      return;
    }
    const t = state.track;
    const art = t.album?.images?.[1]?.url || t.album?.images?.[0]?.url || '';
    const artists = (t.artists || []).map(a => a.name).join(', ');

    el.innerHTML = `
      <div class="player-track">
        ${art ? `<img class="player-art" src="${art}" alt="">` : `<div class="player-art" style="display:flex;align-items:center;justify-content:center">${Icons.music.replace(/48/g,'24')}</div>`}
        <div class="player-track-info">
          <div class="player-track-name">${escapeHtml(t.name)}</div>
          <div class="player-track-artist">${escapeHtml(artists)}</div>
        </div>
      </div>
      <div class="player-controls">
        <div class="player-buttons">
          <button class="player-btn" id="btnPrev">${Icons.prev}</button>
          <button class="player-btn-main" id="btnPlayPause">${state.isPlaying ? Icons.pause : Icons.play}</button>
          <button class="player-btn" id="btnNext">${Icons.next}</button>
        </div>
        <div class="player-progress">
          <span class="player-time" id="timeElapsed">${formatTime(state.progressMs)}</span>
          <div class="progress-track" id="progressTrack">
            <div class="progress-fill" id="progressFill" style="width:${pct()}%">
              <div class="progress-knob"></div>
            </div>
          </div>
          <span class="player-time" id="timeTotal">${formatTime(state.durationMs)}</span>
        </div>
      </div>
      <div class="player-volume">
        <button class="player-btn" id="btnVolume">${state.volume === 0 ? Icons.volumeMute : Icons.volume}</button>
        <div class="volume-track" id="volumeTrack">
          <div class="volume-fill" id="volumeFill" style="width:${state.volume}%"></div>
        </div>
      </div>
    `;
    bindEvents();
  }

  function bindEvents() {
    const prev = document.getElementById('btnPrev');
    const pp = document.getElementById('btnPlayPause');
    const next = document.getElementById('btnNext');
    const prog = document.getElementById('progressTrack');
    const vol = document.getElementById('volumeTrack');
    const volBtn = document.getElementById('btnVolume');

    prev?.addEventListener('click', async () => { try { await window.gradify.spotify.previous(); setTimeout(() => window.App?.pollNow(), 300); } catch(e) { showToast(e.message); } });
    next?.addEventListener('click', async () => { try { await window.gradify.spotify.next(); setTimeout(() => window.App?.pollNow(), 300); } catch(e) { showToast(e.message); } });
    pp?.addEventListener('click', async () => {
      try {
        if (state.isPlaying) await window.gradify.spotify.pause();
        else await window.gradify.spotify.play();
        state.isPlaying = !state.isPlaying;
        pp.innerHTML = state.isPlaying ? Icons.pause : Icons.play;
        manageTimer();
      } catch(e) { showToast(e.message); }
    });

    prog?.addEventListener('click', async (e) => {
      const rect = prog.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const pos = Math.round(ratio * state.durationMs);
      state.progressMs = pos;
      updateProgressUI();
      try { await window.gradify.spotify.seek(pos); } catch(e) { showToast(e.message); }
    });

    vol?.addEventListener('click', async (e) => {
      const rect = vol.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      state.volume = Math.round(ratio * 100);
      const fill = document.getElementById('volumeFill');
      if (fill) fill.style.width = state.volume + '%';
      try { await window.gradify.spotify.setVolume(state.volume); } catch(e) { showToast(e.message); }
    });

    let prevVol = 50;
    volBtn?.addEventListener('click', async () => {
      if (state.volume > 0) { prevVol = state.volume; state.volume = 0; }
      else { state.volume = prevVol || 50; }
      const fill = document.getElementById('volumeFill');
      if (fill) fill.style.width = state.volume + '%';
      volBtn.innerHTML = state.volume === 0 ? Icons.volumeMute : Icons.volume;
      try { await window.gradify.spotify.setVolume(state.volume); } catch {}
    });
  }

  function update(data) {
    if (!data || !data.item) {
      if (state.track) { state.track = null; state.isPlaying = false; render(); stopTimer(); }
      return;
    }
    const trackChanged = state.track?.id !== data.item.id;
    state.track = data.item;
    state.isPlaying = data.is_playing;
    state.progressMs = data.progress_ms || 0;
    state.durationMs = data.item.duration_ms || 0;
    if (data.device) state.volume = data.device.volume_percent ?? state.volume;

    if (trackChanged) {
      render();
      ColorEngine.updateFromTrack(state.track);
    } else {
      updateProgressUI();
      const pp = document.getElementById('btnPlayPause');
      if (pp) pp.innerHTML = state.isPlaying ? Icons.pause : Icons.play;
    }
    manageTimer();
  }

  function updateProgressUI() {
    const fill = document.getElementById('progressFill');
    const elapsed = document.getElementById('timeElapsed');
    if (fill) fill.style.width = pct() + '%';
    if (elapsed) elapsed.textContent = formatTime(state.progressMs);
  }

  function manageTimer() {
    stopTimer();
    if (state.isPlaying) {
      progressTimer = setInterval(() => {
        state.progressMs = Math.min(state.progressMs + 1000, state.durationMs);
        updateProgressUI();
      }, 1000);
    }
  }

  function stopTimer() { if (progressTimer) { clearInterval(progressTimer); progressTimer = null; } }
  function pct() { return state.durationMs > 0 ? (state.progressMs / state.durationMs) * 100 : 0; }
  function formatTime(ms) { const s = Math.floor(ms/1000); const m = Math.floor(s/60); return `${m}:${String(s%60).padStart(2,'0')}`; }
  function getCurrentTrack() { return state.track; }

  function escapeHtml(str) { const d = document.createElement('div'); d.textContent = str || ''; return d.innerHTML; }
  function showToast(msg) { if (window.App) window.App.showToast(msg); }

  return { render, update, getCurrentTrack };
})();
