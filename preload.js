const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('gradify', {
  auth: {
    login: () => ipcRenderer.invoke('auth:login'),
    logout: () => ipcRenderer.invoke('auth:logout'),
    check: () => ipcRenderer.invoke('auth:check'),
    getToken: () => ipcRenderer.invoke('auth:get-token'),
    onStatusChange: (cb) => {
      ipcRenderer.on('auth:status-changed', (_e, data) => cb(data));
    }
  },
  spotify: {
    getMe: () => ipcRenderer.invoke('spotify:get-me'),
    getPlaylists: (offset, limit) => ipcRenderer.invoke('spotify:get-playlists', offset, limit),
    getPlaylist: (id) => ipcRenderer.invoke('spotify:get-playlist', id),
    getPlaylistTracks: (id, offset, limit) => ipcRenderer.invoke('spotify:get-playlist-tracks', id, offset, limit),
    getSavedTracks: (offset, limit) => ipcRenderer.invoke('spotify:get-saved-tracks', offset, limit),
    getCurrentlyPlaying: () => ipcRenderer.invoke('spotify:get-currently-playing'),
    getRecentlyPlayed: () => ipcRenderer.invoke('spotify:get-recently-played'),
    search: (query) => ipcRenderer.invoke('spotify:search', query),
    play: (options) => ipcRenderer.invoke('spotify:play', options),
    pause: () => ipcRenderer.invoke('spotify:pause'),
    next: () => ipcRenderer.invoke('spotify:next'),
    previous: () => ipcRenderer.invoke('spotify:previous'),
    setVolume: (percent) => ipcRenderer.invoke('spotify:set-volume', percent),
    seek: (positionMs) => ipcRenderer.invoke('spotify:seek', positionMs),
    fetchImage: (url) => ipcRenderer.invoke('image:fetch', url),
    transferPlayback: (deviceId) => ipcRenderer.invoke('spotify:transfer-playback', deviceId)
  },
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close')
  }
});
