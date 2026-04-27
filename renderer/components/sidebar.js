window.Sidebar = (() => {
  let playlists = [];
  let activeView = 'home';
  let activePlaylistId = null;
  let userProfile = null;

  function render() {
    const el = document.getElementById('sidebar');
    el.innerHTML = `
      <div class="nav-section">
        <div class="nav-item ${activeView==='home'?'active':''}" data-view="home">${Icons.home}<span>Home</span></div>
        <div class="nav-item ${activeView==='search'?'active':''}" data-view="search">${Icons.search}<span>Search</span></div>
        <div class="nav-item ${activeView==='library'?'active':''}" data-view="library">${Icons.library}<span>Your Library</span></div>
      </div>
      <div class="sidebar-divider"></div>
      <div class="nav-item ${activeView==='liked'?'active':''}" data-view="liked" style="margin-bottom:4px">
        <span style="color:#a78bfa">${Icons.heart}</span><span>Liked Songs</span>
      </div>
      <div class="sidebar-label">Playlists</div>
      <div class="playlist-list" id="playlistList">
        ${playlists.map(p => `
          <div class="playlist-item ${activePlaylistId===p.id?'active':''}" data-playlist-id="${p.id}">
            ${p.images?.[0]?.url
              ? `<img class="playlist-thumb" src="${p.images[0].url}" alt="">`
              : `<div class="playlist-thumb" style="display:flex;align-items:center;justify-content:center;color:var(--text-tertiary)">${Icons.music.replace(/width="\d+"/, 'width="16"').replace(/height="\d+"/, 'height="16"')}</div>`}
            <span class="playlist-item-name">${escapeHtml(p.name)}</span>
          </div>
        `).join('')}
      </div>
      ${userProfile ? `
        <div class="user-profile">
          ${userProfile.images?.[0]?.url
            ? `<img class="user-avatar" src="${userProfile.images[0].url}" alt="">`
            : `<div class="user-avatar" style="display:flex;align-items:center;justify-content:center;background:var(--bg-elevated);font-size:12px;font-weight:600">${userProfile.display_name?.[0] || '?'}</div>`}
          <span class="user-name">${escapeHtml(userProfile.display_name || 'User')}</span>
          <button class="player-btn" style="margin-left:auto" id="logoutBtn" title="Log out">${Icons.logout}</button>
        </div>
      ` : ''}
    `;
    bindEvents(el);
  }

  function bindEvents(el) {
    el.querySelectorAll('.nav-item[data-view]').forEach(item => {
      item.addEventListener('click', () => {
        const view = item.dataset.view;
        setActive(view);
        if (window.App) window.App.navigate(view);
      });
    });
    el.querySelectorAll('.playlist-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.playlistId;
        setActivePlaylist(id);
        if (window.App) window.App.navigate('playlist', id);
      });
    });
    const logoutBtn = el.querySelector('#logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        if (window.App) window.App.logout();
      });
    }
  }

  function setActive(view) {
    activeView = view;
    activePlaylistId = null;
    render();
  }

  function setActivePlaylist(id) {
    activeView = 'playlist';
    activePlaylistId = id;
    render();
  }

  function setPlaylists(list) {
    playlists = list || [];
    render();
  }

  function setUser(profile) {
    userProfile = profile;
    render();
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  return { render, setActive, setActivePlaylist, setPlaylists, setUser };
})();
