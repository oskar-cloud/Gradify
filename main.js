const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { exec, spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const SpotifyAuth = require('./src/auth');
const SpotifyAPI = require('./src/spotify-api');

let mainWindow;
let auth;
let api;

let headlessEdgeProcess = null;
let headlessServer = null;

function startHeadlessBackend() {
  console.log('[Gradify] Starting Headless Audio Backend...');
  
  // 1. Create a local HTTP server to serve backend.html and handle /token requests
  headlessServer = http.createServer((req, res) => {
    // Enable CORS just in case
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');

    if (req.url === '/backend.html' || req.url === '/') {
      const p = path.join(__dirname, 'src', 'backend', 'backend.html');
      if (fs.existsSync(p)) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(fs.readFileSync(p));
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    } else if (req.url === '/token') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ token: auth?.getAccessToken() || null }));
    } else if (req.url === '/status' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk.toString());
      req.on('end', async () => {
        try {
          const status = JSON.parse(body);
          if (status.ready && status.deviceId) {
            console.log('[Gradify] Headless backend is ready. Transferring playback silently...');
            // When the backend registers, automatically make it the active device!
            await api.transferPlayback(status.deviceId, false);
          }
        } catch(e) {}
        res.writeHead(200);
        res.end();
      });
    } else {
      res.writeHead(404);
      res.end();
    }
  });

  // Listen on a random available port
  headlessServer.listen(0, '127.0.0.1', () => {
    const port = headlessServer.address().port;
    console.log('[Gradify] Headless backend server listening on port', port);

    // 2. Locate Microsoft Edge or Chrome (Cross-Platform)
    const paths = {
      win32: [
        "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
        "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
      ],
      darwin: [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
        "/Applications/Arc.app/Contents/MacOS/Arc"
      ],
      linux: [
        "/usr/bin/google-chrome",
        "/usr/bin/microsoft-edge-stable",
        "/usr/bin/chromium"
      ]
    };
    
    const platformPaths = paths[process.platform] || paths.linux;
    let browserPath = null;
    
    // Attempt 1: Find via PATH
    const isWin = process.platform === 'win32';
    const cmd = isWin ? 'where' : 'command -v';
    const names = isWin ? ['msedge', 'chrome'] : ['google-chrome', 'chrome', 'chromium', 'chromium-browser', 'microsoft-edge', 'msedge', 'brave'];
    
    for (const name of names) {
      try {
        const p = require('child_process').execSync(`${cmd} ${name}`, { stdio: 'pipe' }).toString().split('\\n')[0].trim();
        if (p && fs.existsSync(p)) {
          browserPath = p;
          break;
        }
      } catch (e) {}
    }

    // Attempt 2: Fallback to hardcoded paths
    if (!browserPath) {
      for (const p of platformPaths) {
        if (fs.existsSync(p)) {
          browserPath = p;
          break;
        }
      }
    }

    if (!browserPath) {
      console.warn('[Gradify] Neither Edge nor Chrome found. Headless backend cannot start.');
      return;
    }

    const userDataDir = path.join(app.getPath('userData'), 'HeadlessBrowserCache');

    // 3. Spawn the browser in Headless mode
    // Using --headless=new enables the new headless mode which supports DRM and audio output.
    headlessEdgeProcess = spawn(browserPath, [
      '--headless=new',
      '--disable-gpu',
      '--enable-features=Widevine',
      '--autoplay-policy=no-user-gesture-required',
      `--user-data-dir=${userDataDir}`,
      `http://127.0.0.1:${port}/backend.html`
    ]);

    headlessEdgeProcess.on('error', err => {
      console.error('[Gradify] Failed to start headless browser:', err);
    });

    headlessEdgeProcess.on('exit', code => {
      console.log('[Gradify] Headless browser exited with code', code);
    });
  });
}

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
      sandbox: false,
      plugins: true
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

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // Pipe renderer logs to terminal
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer] ${message}`);
  });
}

function registerIPC() {
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
    return { authenticated: auth.isAuthenticated() };
  });

  ipcMain.handle('auth:get-token', () => auth.getAccessToken());

  const safeHandle = (channel, fn) => {
    ipcMain.handle(channel, async (...args) => {
      try {
        const result = await fn(...args);
        return result;
      } catch (e) {
        console.error(`[IPC Error] ${channel}:`, e);
        try { require('fs').appendFileSync(path.join(__dirname, 'error.log'), new Date().toISOString() + ' ' + channel + ': ' + e.stack + '\n'); } catch(err){}
        const msg = e.message || String(e);
        if (msg.includes('NO_ACTIVE_DEVICE') || msg.includes('No active device')) {
          return { __error: true, message: 'No active device. Try playing a song first.' };
        }
        if (msg.includes('PREMIUM_REQUIRED')) {
          return { __error: true, message: 'Spotify Premium is required for playback controls' };
        }
        return { __error: true, message: msg };
      }
    });
  };

  safeHandle('spotify:get-me', (_e) => api.getMe());
  safeHandle('spotify:get-playlists', (_e, offset, limit) => api.getPlaylists(offset, limit));
  safeHandle('spotify:get-playlist', (_e, id) => api.getPlaylist(id));
  safeHandle('spotify:get-playlist-tracks', (_e, id, offset, limit) => api.getPlaylistTracks(id, offset, limit));
  safeHandle('spotify:get-saved-tracks', (_e, offset, limit) => api.getSavedTracks(offset, limit));
  safeHandle('spotify:get-currently-playing', () => api.getCurrentlyPlaying());
  safeHandle('spotify:get-recently-played', () => api.getRecentlyPlayed());
  safeHandle('spotify:search', (_e, query) => api.search(query));
  safeHandle('spotify:play', (_e, options) => api.play(options || {}));
  safeHandle('spotify:transfer-playback', (_e, deviceId) => api.transferPlayback(deviceId, true));
  safeHandle('spotify:pause', () => api.pause());
  safeHandle('spotify:next', () => api.next());
  safeHandle('spotify:previous', () => api.previous());
  safeHandle('spotify:set-volume', (_e, percent) => api.setVolume(percent));
  safeHandle('spotify:seek', (_e, positionMs) => api.seek(positionMs));
  safeHandle('image:fetch', (_e, url) => api.fetchImageBase64(url));

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

  // Start the headless browser backend to handle audio decoding
  startHeadlessBackend();

  const restored = await auth.loadSavedTokens();
  if (restored) {
    mainWindow?.webContents.once('did-finish-load', () => {
      mainWindow.webContents.send('auth:status-changed', { authenticated: true });
    });
  }
});

app.on('window-all-closed', () => {
  if (headlessEdgeProcess) headlessEdgeProcess.kill();
  if (headlessServer) headlessServer.close();
  auth?.destroy();
  app.quit();
});
