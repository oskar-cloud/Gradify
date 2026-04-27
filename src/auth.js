const crypto = require('crypto');
const http = require('http');
const { shell, safeStorage } = require('electron');
const fs = require('fs');
const path = require('path');

const CLIENT_ID = '2dfc95532ef84590b5fbe47bc4f9a964';
const REDIRECT_URI = 'http://127.0.0.1:8888/callback';
const SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'playlist-read-private',
  'playlist-read-collaborative',
  'user-library-read',
  'user-read-private',
  'user-read-email',
  'user-read-recently-played'
].join(' ');

class SpotifyAuth {
  constructor(userDataPath) {
    this.accessToken = null;
    this.refreshToken = null;
    this.expiresAt = null;
    this.codeVerifier = null;
    this.server = null;
    this.refreshTimer = null;
    this.tokenPath = path.join(userDataPath, 'tokens.json');
    this._onTokenRefresh = null;
  }

  onTokenRefresh(cb) {
    this._onTokenRefresh = cb;
  }

  _randomString(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    const values = crypto.randomBytes(length);
    return Array.from(values).map(v => chars[v % chars.length]).join('');
  }

  _codeChallenge(verifier) {
    return crypto.createHash('sha256').update(verifier).digest('base64url');
  }

  async loadSavedTokens() {
    try {
      if (!fs.existsSync(this.tokenPath)) return false;
      const raw = fs.readFileSync(this.tokenPath, 'utf-8');
      let data;
      if (safeStorage.isEncryptionAvailable()) {
        const buf = Buffer.from(raw, 'base64');
        data = JSON.parse(safeStorage.decryptString(buf));
      } else {
        data = JSON.parse(raw);
      }
      this.accessToken = data.accessToken;
      this.refreshToken = data.refreshToken;
      this.expiresAt = data.expiresAt;

      if (Date.now() >= this.expiresAt - 60000) {
        await this.refresh();
      } else {
        this._scheduleRefresh();
      }
      return true;
    } catch {
      return false;
    }
  }

  _saveTokens() {
    const data = JSON.stringify({
      accessToken: this.accessToken,
      refreshToken: this.refreshToken,
      expiresAt: this.expiresAt
    });
    try {
      if (safeStorage.isEncryptionAvailable()) {
        const encrypted = safeStorage.encryptString(data);
        fs.writeFileSync(this.tokenPath, encrypted.toString('base64'), 'utf-8');
      } else {
        fs.writeFileSync(this.tokenPath, data, 'utf-8');
      }
    } catch (e) {
      console.error('Failed to save tokens:', e);
    }
  }

  _scheduleRefresh() {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    const delay = Math.max((this.expiresAt - Date.now()) - 120000, 10000);
    this.refreshTimer = setTimeout(() => this.refresh(), delay);
  }

  login() {
    this.codeVerifier = this._randomString(128);
    const codeChallenge = this._codeChallenge(this.codeVerifier);

    return new Promise((resolve, reject) => {
      this.server = http.createServer(async (req, res) => {
        try {
          const url = new URL(req.url, 'http://127.0.0.1:8888');
          if (url.pathname !== '/callback') return;

          const error = url.searchParams.get('error');
          if (error) {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(this._callbackPage(false));
            this.server.close();
            return reject(new Error(error));
          }

          const code = url.searchParams.get('code');
          if (code) {
            await this._exchangeCode(code);
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(this._callbackPage(true));
            this.server.close();
            resolve();
          }
        } catch (e) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(this._callbackPage(false));
          this.server.close();
          reject(e);
        }
      });

      this.server.listen(8888, '127.0.0.1', () => {
        const authUrl = new URL('https://accounts.spotify.com/authorize');
        authUrl.searchParams.set('client_id', CLIENT_ID);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
        authUrl.searchParams.set('scope', SCOPES);
        authUrl.searchParams.set('code_challenge_method', 'S256');
        authUrl.searchParams.set('code_challenge', codeChallenge);
        shell.openExternal(authUrl.toString());
      });

      setTimeout(() => {
        if (this.server?.listening) {
          this.server.close();
          reject(new Error('Login timed out'));
        }
      }, 120000);
    });
  }

  async _exchangeCode(code) {
    const resp = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        code_verifier: this.codeVerifier
      })
    });
    if (!resp.ok) throw new Error(`Token exchange failed: ${resp.status}`);
    const data = await resp.json();
    this._setTokens(data);
  }

  async refresh() {
    if (!this.refreshToken) throw new Error('No refresh token');
    const resp = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        grant_type: 'refresh_token',
        refresh_token: this.refreshToken
      })
    });
    if (!resp.ok) throw new Error(`Token refresh failed: ${resp.status}`);
    const data = await resp.json();
    this._setTokens(data);
    if (this._onTokenRefresh) this._onTokenRefresh(this.accessToken);
  }

  _setTokens(data) {
    this.accessToken = data.access_token;
    if (data.refresh_token) this.refreshToken = data.refresh_token;
    this.expiresAt = Date.now() + data.expires_in * 1000;
    this._saveTokens();
    this._scheduleRefresh();
  }

  logout() {
    this.accessToken = null;
    this.refreshToken = null;
    this.expiresAt = null;
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    try { fs.unlinkSync(this.tokenPath); } catch {}
  }

  isAuthenticated() {
    return !!this.accessToken && Date.now() < this.expiresAt;
  }

  getAccessToken() {
    return this.accessToken;
  }

  _callbackPage(success) {
    const msg = success
      ? '✓ Logged in to Gradify! You can close this window.'
      : '✗ Login failed. Please try again.';
    return `<!DOCTYPE html><html><body style="background:#0a0a0f;color:#e0e0e0;font-family:system-ui,sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0"><h1 style="font-weight:400;font-size:1.4rem">${msg}</h1></body></html>`;
  }

  destroy() {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    if (this.server?.listening) this.server.close();
  }
}

module.exports = SpotifyAuth;
