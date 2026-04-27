const BASE = 'https://api.spotify.com/v1';

class SpotifyAPI {
  constructor(auth) {
    this.auth = auth;
  }

  async _request(endpoint, options = {}) {
    const token = this.auth.getAccessToken();
    if (!token) throw new Error('Not authenticated');

    const url = endpoint.startsWith('http') ? endpoint : `${BASE}${endpoint}`;
    console.log('[API Request]', url);
    const resp = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    if (resp.status === 401) {
      await this.auth.refresh();
      return this._request(endpoint, options);
    }
    if (resp.status === 204 || resp.status === 202) return null;
    if (!resp.ok) {
      const err = await resp.text().catch(() => '');
      throw new Error(`Spotify API ${resp.status}: ${err}`);
    }
    // Some endpoints return empty body on success (play, pause, next, etc.)
    const text = await resp.text();
    if (!text || !text.trim()) return null;
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  async getMe() {
    return this._request('/me');
  }

  async getPlaylists(offset = 0, limit = 50) {
    return this._request(`/me/playlists?offset=${offset}&limit=${limit}`);
  }

  async getPlaylistTracks(playlistId, offset = 0, limit = 50) {
    return this._request(`/playlists/${playlistId}/items?offset=${offset}&limit=${limit}`);
  }

  async getPlaylist(playlistId) {
    return this._request(`/playlists/${playlistId}`);
  }

  async getSavedTracks(offset = 0, limit = 50) {
    return this._request(`/me/tracks?offset=${offset}&limit=${limit}`);
  }

  async getCurrentlyPlaying() {
    return this._request('/me/player/currently-playing');
  }

  async getPlaybackState() {
    return this._request('/me/player');
  }

  async getRecentlyPlayed(limit = 20) {
    return this._request(`/me/player/recently-played?limit=${limit}`);
  }

  async search(query, types = 'track,album,artist,playlist', limit = 10) {
    const q = encodeURIComponent(query);
    return this._request(`/search?q=${q}&type=track,artist,album,playlist&limit=10`);
  }

  async play(options = {}) {
    const body = {};
    if (options.contextUri) body.context_uri = options.contextUri;
    if (options.uris) body.uris = options.uris;
    if (options.offset !== undefined) body.offset = { position: options.offset };
    const deviceQuery = options.deviceId ? `?device_id=${options.deviceId}` : '';
    return this._request(`/me/player/play${deviceQuery}`, {
      method: 'PUT',
      body: Object.keys(body).length ? JSON.stringify(body) : undefined
    });
  }

  async transferPlayback(deviceId, play = false) {
    return this._request('/me/player', {
      method: 'PUT',
      body: JSON.stringify({ device_ids: [deviceId], play })
    });
  }

  async pause() {
    return this._request('/me/player/pause', { method: 'PUT' });
  }

  async next() {
    return this._request('/me/player/next', { method: 'POST' });
  }

  async previous() {
    return this._request('/me/player/previous', { method: 'POST' });
  }

  async setVolume(percent) {
    return this._request(`/me/player/volume?volume_percent=${Math.round(percent)}`, { method: 'PUT' });
  }

  async seek(positionMs) {
    return this._request(`/me/player/seek?position_ms=${Math.round(positionMs)}`, { method: 'PUT' });
  }

  async fetchImageBase64(url) {
    if (!url) return null;
    try {
      const resp = await fetch(url);
      const buffer = await resp.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      const ct = resp.headers.get('content-type') || 'image/jpeg';
      return `data:${ct};base64,${base64}`;
    } catch {
      return null;
    }
  }
}

module.exports = SpotifyAPI;
