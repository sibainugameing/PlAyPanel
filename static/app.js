let lastTrackKey = null;

async function updateNowPlaying() {
  try {
    const response = await fetch('/now-playing.json', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    document.querySelector('#title').textContent = data.title || '---';
    document.querySelector('#artist').textContent = data.artist || '---';
    document.querySelector('#album').textContent = data.album || '---';

    const status = document.querySelector('#status');
    status.textContent = data.playing === true ? '再生中' : data.playing === false ? '停止' : '待機中';

    const trackKey = [
      data.title || '',
      data.artist || '',
      data.album || '',
    ].join('\u0001');

    const artwork = document.querySelector('#artwork');

    if (trackKey !== lastTrackKey) {
      lastTrackKey = trackKey;

      if (data.has_artwork) {
        artwork.src = `/artwork?t=${Date.now()}`;
        artwork.hidden = false;
      } else {
        artwork.hidden = true;
        artwork.removeAttribute('src');
      }
    }
  } catch (error) {
    document.querySelector('#status').textContent = '接続エラー';
    console.error('PlayPanel:', error);
  }
}

const pollIntervalMs = window.PLAYPANEL_CONFIG?.pollIntervalMs ?? 1000;

updateNowPlaying();
setInterval(updateNowPlaying, pollIntervalMs);
