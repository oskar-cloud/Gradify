window.App = (() => {
  let pollInterval = null;
  let toastTimer = null;
  let currentView = 'home';

  async function init() {
    // Toast element
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.id = 'toast';
    document.body.appendChild(toast);

    // Window controls
    document.getElementById('btnMinimize')?.addEventListener('click', () => window.gradify.window.minimize());
    document.getElementById('btnMaximize')?.addEventListener('click', () => window.gradify.window.maximize());
    document.getElementById('btnClose')?.addEventListener('click', () => window.gradify.window.close());

    // Login button
    document.getElementById('loginBtn')?.addEventListener('click', handleLogin);

    // Auth status listener
    window.gradify.auth.onStatusChange(async (data) => {
      if (data.authenticated) await enterApp();
    });

    // Check if already authenticated
    const { authenticated } = await window.gradify.auth.check();
    if (authenticated) await enterApp();

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboard);
  }

  async function handleLogin() {
    const btn = document.getElementById('loginBtn');
    if (btn) { btn.textContent = 'Connecting...'; btn.disabled = true; }
    const result = await window.gradify.auth.login();
    if (!result.success) {
      showToast('Login failed: ' + (result.error || 'Unknown error'));
      if (btn) { btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0z"/></svg> Connect with Spotify`; btn.disabled = false; }
    }
  }

  async function enterApp() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('appLayout').style.display = 'grid';

    // Load user data
    try {
      const [user, playlistsData] = await Promise.all([
        window.gradify.spotify.getMe(),
        window.gradify.spotify.getPlaylists(0, 50)
      ]);
      Sidebar.setUser(user);
      Sidebar.setPlaylists(playlistsData?.items || []);
    } catch(e) {
      console.error('Failed to load user data:', e);
    }

    // Initial render
    Player.render();
    navigate('home');
    startPolling();
  }

  function navigate(view, data) {
    currentView = view;
    const container = document.getElementById('mainContent');
    container.scrollTop = 0;

    switch (view) {
      case 'home': HomeView.show(container); Sidebar.setActive('home'); break;
      case 'search': SearchView.show(container); Sidebar.setActive('search'); break;
      case 'library': LibraryView.show(container); Sidebar.setActive('library'); break;
      case 'liked': LibraryView.show(container); Sidebar.setActive('liked'); break;
      case 'playlist': PlaylistView.show(container, data); Sidebar.setActivePlaylist(data); break;
    }
  }

  function startPolling() {
    pollNow();
    pollInterval = setInterval(pollNow, 4000);
  }

  async function pollNow() {
    try {
      const data = await window.gradify.spotify.getCurrentlyPlaying();
      Player.update(data);
    } catch {}
  }

  function handleKeyboard(e) {
    if (e.target.tagName === 'INPUT') return;
    switch (e.code) {
      case 'Space':
        e.preventDefault();
        document.getElementById('btnPlayPause')?.click();
        break;
      case 'ArrowRight':
        if (e.ctrlKey) document.getElementById('btnNext')?.click();
        break;
      case 'ArrowLeft':
        if (e.ctrlKey) document.getElementById('btnPrev')?.click();
        break;
    }
  }

  async function logout() {
    await window.gradify.auth.logout();
    if (pollInterval) clearInterval(pollInterval);
    document.getElementById('appLayout').style.display = 'none';
    document.getElementById('loginScreen').style.display = 'flex';
    ColorEngine.resetGradient();
  }

  function showToast(msg) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3000);
  }

  // Auto-init
  document.addEventListener('DOMContentLoaded', init);

  return { navigate, pollNow, logout, showToast };
})();
