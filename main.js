const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const SpotifyAuth = require('./src/auth');
const SpotifyAPI = require('./src/spotify-api');

let mainWindow;
let auth;
let api;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    transparent: false,
    backgroundColor: '#0a0a0f',
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    icon: path.join(__dirname, 'renderer', 'assets', 'icon.png'),
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function registerIPC() {
  // Auth
  ipcMain.handle('auth:login', async () => {
    try {
      await auth.login();
      mainWindow?.webContents.send('auth:status-changed', { authenticated: true });
      return { success: true };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('auth:logout', () => {
    auth.logout();
    mainWindow?.webContents.send('auth:status-changed', { authenticated: false });
    return { success: true };
  });

  ipcMain.handle('auth:check', async () => {
    const ok = auth.isAuthenticated();
    return { authenticated: ok };
  });

  // Spotify API
  ipcMain.handle('spotify:get-me', () => api.getMe());
  ipcMain.handle('spotify:get-playlists', (_e, offset, limit) => api.getPlaylists(offset, limit));
  ipcMain.handle('spotify:get-playlist', (_e, id) => api.getPlaylist(id));
  ipcMain.handle('spotify:get-playlist-tracks', (_e, id, offset, limit) => api.getPlaylistTracks(id, offset, limit));
  ipcMain.handle('spotify:get-saved-tracks', (_e, offset, limit) => api.getSavedTracks(offset, limit));
  ipcMain.handle('spotify:get-currently-playing', () => api.getCurrentlyPlaying());
  ipcMain.handle('spotify:get-recently-played', () => api.getRecentlyPlayed());
  ipcMain.handle('spotify:search', (_e, query) => api.search(query));
  ipcMain.handle('spotify:play', (_e, options) => api.play(options || {}));
  ipcMain.handle('spotify:pause', () => api.pause());
  ipcMain.handle('spotify:next', () => api.next());
  ipcMain.handle('spotify:previous', () => api.previous());
  ipcMain.handle('spotify:set-volume', (_e, percent) => api.setVolume(percent));
  ipcMain.handle('spotify:seek', (_e, positionMs) => api.seek(positionMs));
  ipcMain.handle('image:fetch', (_e, url) => api.fetchImageBase64(url));

  // Window controls
  ipcMain.handle('window:minimize', () => mainWindow?.minimize());
  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  ipcMain.handle('window:close', () => mainWindow?.close());
}

app.whenReady().then(async () => {
  auth = new SpotifyAuth(app.getPath('userData'));
  api = new SpotifyAPI(auth);

  auth.onTokenRefresh(() => {
    mainWindow?.webContents.send('auth:status-changed', { authenticated: true });
  });

  registerIPC();
  createWindow();

  // Try to restore session
  const restored = await auth.loadSavedTokens();
  if (restored) {
    mainWindow?.webContents.once('did-finish-load', () => {
      mainWindow.webContents.send('auth:status-changed', { authenticated: true });
    });
  }
});

app.on('window-all-closed', () => {
  auth?.destroy();
  app.quit();
});
