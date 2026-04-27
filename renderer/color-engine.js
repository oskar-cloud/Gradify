window.ColorEngine = (() => {
  let currentTrackId = null;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  canvas.width = 64;
  canvas.height = 64;

  function extractColors(imgElement) {
    ctx.drawImage(imgElement, 0, 0, 64, 64);
    const data = ctx.getImageData(0, 0, 64, 64).data;
    const buckets = {};

    for (let i = 0; i < data.length; i += 16) { // sample every 4th pixel
      const r = Math.round(data[i] / 32) * 32;
      const g = Math.round(data[i+1] / 32) * 32;
      const b = Math.round(data[i+2] / 32) * 32;
      const lum = 0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2];
      if (lum < 15 || lum > 245) continue; // skip near-black and near-white
      const key = `${r},${g},${b}`;
      buckets[key] = (buckets[key] || 0) + 1;
    }

    const sorted = Object.entries(buckets)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(e => e[0].split(',').map(Number));

    if (sorted.length < 3) {
      return { primary: [99,102,241], secondary: [139,92,246], accent: [79,70,229] };
    }

    // Pick colors with good separation
    const primary = sorted[0];
    let secondary = sorted[1];
    let accent = sorted[2];

    for (let i = 1; i < sorted.length; i++) {
      if (colorDistance(primary, sorted[i]) > 60) { secondary = sorted[i]; break; }
    }
    for (let i = 2; i < sorted.length; i++) {
      if (colorDistance(primary, sorted[i]) > 40 && colorDistance(secondary, sorted[i]) > 40) {
        accent = sorted[i]; break;
      }
    }

    return {
      primary: saturateColor(primary, 1.3),
      secondary: saturateColor(secondary, 1.2),
      accent: saturateColor(accent, 1.1)
    };
  }

  function colorDistance(a, b) {
    return Math.sqrt((a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2);
  }

  function saturateColor(rgb, factor) {
    const avg = (rgb[0] + rgb[1] + rgb[2]) / 3;
    return rgb.map(c => Math.min(255, Math.round(avg + (c - avg) * factor)));
  }

  function rgb(arr) {
    return `rgb(${arr[0]},${arr[1]},${arr[2]})`;
  }

  async function updateFromTrack(track) {
    if (!track || !track.album?.images?.[0]?.url) {
      resetGradient();
      return;
    }

    const trackId = track.id;
    if (trackId === currentTrackId) return;
    currentTrackId = trackId;

    try {
      const dataUrl = await window.gradify.spotify.fetchImage(track.album.images[0].url);
      if (!dataUrl) { resetGradient(); return; }

      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = dataUrl;
      });

      const colors = extractColors(img);
      const bg = document.getElementById('gradientBg');
      bg.style.setProperty('--gp', rgb(colors.primary));
      bg.style.setProperty('--gs', rgb(colors.secondary));
      bg.style.setProperty('--ga', rgb(colors.accent));
    } catch {
      resetGradient();
    }
  }

  function resetGradient() {
    currentTrackId = null;
    const bg = document.getElementById('gradientBg');
    bg.style.setProperty('--gp', '#6366f1');
    bg.style.setProperty('--gs', '#8b5cf6');
    bg.style.setProperty('--ga', '#4f46e5');
  }

  return { updateFromTrack, resetGradient };
})();
