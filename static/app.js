let lastTrackKey = null;

const animationsEnabled = window.PLAYPANEL_CONFIG?.animationsEnabled === true;
const pollIntervalMs = window.PLAYPANEL_CONFIG?.pollIntervalMs ?? 1000;

function clearAnimationClasses(element) {
  element.classList.remove('record--enter', 'info--change');
}

function animateTrackChange(artwork, hasArtwork) {
  if (!animationsEnabled) {
    if (hasArtwork) {
      artwork.hidden = false;
    } else {
      artwork.hidden = true;
      artwork.removeAttribute('src');
    }
    return;
  }

  const record = document.querySelector('.record');
  const recordStage = document.querySelector('.record-stage');
  const info = document.querySelector('.info');

  if (!record || !recordStage || !info) {
    if (hasArtwork) {
      artwork.hidden = false;
    } else {
      artwork.hidden = true;
      artwork.removeAttribute('src');
    }
    return;
  }

  const oldRecord = record.cloneNode(true);
  const clonedArtwork = oldRecord.querySelector('#artwork');
  if (clonedArtwork) {
    clonedArtwork.removeAttribute('id');
  }

  oldRecord.classList.add('record--exit');
  recordStage.appendChild(oldRecord);

  if (hasArtwork) {
    artwork.hidden = false;
  } else {
    artwork.hidden = true;
    artwork.removeAttribute('src');
  }

  clearAnimationClasses(record);
  clearAnimationClasses(info);

  void record.offsetWidth;
  record.classList.add('record--enter');
  info.classList.add('info--change');

  window.setTimeout(() => {
    oldRecord.remove();
    clearAnimationClasses(record);
    clearAnimationClasses(info);
  }, 760);
}

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
    const trackChanged = trackKey !== lastTrackKey;
    const needsArtworkUpdate =
      trackChanged ||
      (data.has_artwork && artwork.hidden);

    if (needsArtworkUpdate) {
      lastTrackKey = trackKey;

      if (data.has_artwork) {
        const nextArtworkUrl = `/artwork?t=${Date.now()}`;
        const image = new Image();

        image.onload = () => {
          artwork.src = nextArtworkUrl;
          animateTrackChange(artwork, true);
        };

        image.onerror = () => {
          animateTrackChange(artwork, false);
          console.error('PlayPanel: artwork failed to load');
        };

        image.src = nextArtworkUrl;
      } else {
        animateTrackChange(artwork, false);
      }
    }
  } catch (error) {
    document.querySelector('#status').textContent = '接続エラー';
    console.error('PlayPanel:', error);
  }
}

updateNowPlaying();
setInterval(updateNowPlaying, pollIntervalMs);
