let lastTrackKey = null;
let artworkRequestKey = null;
let currentArtworkUrl = null;
let artworkSwapTimer = null;
let recordTransitionTimer = null;

const config = window.PLAYPANEL_CONFIG ?? {};
const animationConfig = config.animation ?? {};
const animationsEnabled = animationConfig.enabled === true;
const recordRotationEnabled = animationConfig.recordRotationEnabled !== false;
const recordRotationSpeed = Number(animationConfig.recordRotationSpeed) > 0
  ? Number(animationConfig.recordRotationSpeed)
  : 18;
const recordChangeEnabled = animationConfig.recordChangeEnabled !== false;
const infoChangeEnabled = animationConfig.infoChangeEnabled !== false;
const pollIntervalMs = config.pollIntervalMs ?? 1000;

const recordRotationDurationSeconds = 60 / recordRotationSpeed;

document.body.classList.toggle('animations-disabled', !animationsEnabled);
document.documentElement.style.setProperty(
  '--record-rotation-duration',
  `${recordRotationDurationSeconds}s`
);

function updateTitleSize(title) {
  const titleElement = document.querySelector('#title');
  if (!titleElement) {
    return;
  }

  titleElement.classList.remove('title--long', 'title--very-long', 'title--extreme');

  const length = Array.from(title).length;

  if (length >= 80) {
    titleElement.classList.add('title--extreme');
  } else if (length >= 50) {
    titleElement.classList.add('title--very-long');
  } else if (length >= 32) {
    titleElement.classList.add('title--long');
  }
}

function applyPlaybackState(playing) {
  const isPlaying = playing === true;
  document.body.classList.toggle('is-playing', isPlaying);

  const record = document.querySelector('.record');
  if (record && !record.classList.contains('record--enter')) {
    applyRecordRotation(record, playing);
  }
}

function applyRecordRotation(record, playing) {
  const shouldSpin = animationsEnabled && recordRotationEnabled && playing === true;
  record.classList.toggle('record--spinning', shouldSpin);
}

function setArtworkGlow(src) {
  const recordStage = document.querySelector('.record-stage');
  if (!recordStage) {
    return;
  }

  if (src) {
    recordStage.style.setProperty('--artwork-image', `url("${src}")`);
    recordStage.classList.add('has-artwork-glow');
  } else {
    recordStage.style.removeProperty('--artwork-image');
    recordStage.classList.remove('has-artwork-glow');
  }
}

function finishRecordEntrance(record, playing) {
  record.classList.remove('record--enter');
  applyRecordRotation(record, playing);
}

function animateTrackChange(artwork, newArtworkUrl, playing) {
  const record = document.querySelector('.record');
  const recordStage = document.querySelector('.record-stage');
  const info = document.querySelector('.info');

  if (!record || !recordStage || !info || !animationsEnabled) {
    artwork.src = newArtworkUrl;
    artwork.hidden = false;
    setArtworkGlow(newArtworkUrl);
    if (record) {
      finishRecordEntrance(record, playing);
    }
    info?.classList.remove('info--change');
    return;
  }

  const changeDuration = parseFloat(
    getComputedStyle(document.documentElement)
      .getPropertyValue('--record-change-duration')
  ) || 1200;

  if (recordTransitionTimer !== null) {
    window.clearTimeout(recordTransitionTimer);
    recordTransitionTimer = null;
  }

  if (!recordChangeEnabled) {
    artwork.src = newArtworkUrl;
    artwork.hidden = false;
    setArtworkGlow(newArtworkUrl);
    applyRecordRotation(record, playing);
  } else {
    // Keep the current record untouched while it leaves. The new artwork is
    // not assigned until the outgoing record has completely disappeared.
    const oldRecord = record.cloneNode(true);
    const clonedArtwork = oldRecord.querySelector('#artwork');

    if (clonedArtwork) {
      clonedArtwork.removeAttribute('id');
    }

    oldRecord.classList.remove('record--spinning', 'record--enter', 'record--exit');
    oldRecord.classList.add('record--exit');
    recordStage.appendChild(oldRecord);

    record.classList.remove('record--spinning', 'record--enter');
    record.style.visibility = 'hidden';

    recordTransitionTimer = window.setTimeout(() => {
      if (!record.isConnected) {
        return;
      }

      artwork.src = newArtworkUrl;
      artwork.hidden = false;
      setArtworkGlow(newArtworkUrl);

      record.style.visibility = '';
      void record.offsetWidth;
      record.classList.add('record--enter');

      const handleEntranceEnd = (event) => {
        if (event.animationName !== 'record-enter') {
          return;
        }
        record.removeEventListener('animationend', handleEntranceEnd);
        finishRecordEntrance(record, playing);
      };

      record.addEventListener('animationend', handleEntranceEnd);
      oldRecord.remove();
      recordTransitionTimer = null;
    }, changeDuration + 20);
  }

  if (infoChangeEnabled) {
    info.classList.remove('info--change');
    void info.offsetWidth;
    info.classList.add('info--change');

    const infoDuration = parseFloat(
      getComputedStyle(document.documentElement)
        .getPropertyValue('--info-change-duration')
    ) || 650;

    window.setTimeout(() => {
      info.classList.remove('info--change');
    }, infoDuration + 30);
  }
}

function showNewArtwork(artwork, objectUrl, playing) {
  const previousUrl = currentArtworkUrl;

  animateTrackChange(artwork, objectUrl, playing);
  currentArtworkUrl = objectUrl;

  if (artworkSwapTimer !== null) {
    window.clearTimeout(artworkSwapTimer);
  }

  if (previousUrl?.startsWith('blob:')) {
    const changeDuration = parseFloat(
      getComputedStyle(document.documentElement)
        .getPropertyValue('--record-change-duration')
    ) || 1200;
    artworkSwapTimer = window.setTimeout(() => {
      URL.revokeObjectURL(previousUrl);
      artworkSwapTimer = null;
    }, changeDuration * 2 + 250);
  }
}

async function requestArtwork(trackKey, data, artwork) {
  if (artworkRequestKey === trackKey) {
    return;
  }

  artworkRequestKey = trackKey;

  const loadArtwork = async (attempt = 1) => {
    if (artworkRequestKey !== trackKey) {
      return;
    }

    try {
      const response = await fetch(`/artwork?t=${Date.now()}`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.startsWith('image/')) {
        throw new Error(`Unexpected content type: ${contentType || 'unknown'}`);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const image = new Image();

      image.onload = () => {
        if (artworkRequestKey !== trackKey) {
          URL.revokeObjectURL(objectUrl);
          return;
        }

        showNewArtwork(artwork, objectUrl, data.playing);
        lastTrackKey = trackKey;
        artworkRequestKey = null;
      };

      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);

        if (artworkRequestKey !== trackKey) {
          return;
        }

        if (attempt < 3) {
          window.setTimeout(() => loadArtwork(attempt + 1), 150);
          return;
        }

        artworkRequestKey = null;
        console.error(`PlayPanel: artwork failed to decode after ${attempt} attempts; keeping current artwork`);
      };

      image.src = objectUrl;
    } catch (error) {
      if (artworkRequestKey !== trackKey) {
        return;
      }

      if (attempt < 3) {
        window.setTimeout(() => loadArtwork(attempt + 1), 150);
        return;
      }

      artworkRequestKey = null;
      console.error(`PlayPanel: artwork request failed after ${attempt} attempts; keeping current artwork`, error);
    }
  };

  loadArtwork();
}

async function updateNowPlaying() {
  try {
    const response = await fetch('/now-playing.json', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    const title = data.title || '---';
    document.querySelector('#title').textContent = title;
    updateTitleSize(title);
    document.querySelector('#artist').textContent = data.artist || '---';
    document.querySelector('#album').textContent = data.album || '---';

    const status = document.querySelector('#status');
    status.textContent = data.playing === true ? '再生中' : data.playing === false ? '停止' : '待機中';
    applyPlaybackState(data.playing);

    const trackKey = [
      data.title || '',
      data.artist || '',
      data.album || '',
    ].join('\u0001');

    const artwork = document.querySelector('#artwork');
    const trackChanged = trackKey !== lastTrackKey;

    if (trackChanged && data.has_artwork) {
      requestArtwork(trackKey, data, artwork);
    } else if (trackChanged && !data.has_artwork) {
      // Metadata can arrive before PICT. Keep the current cover and wait for
      // Shairport Sync to provide the artwork for this track.
    }
  } catch (error) {
    document.querySelector('#status').textContent = '接続エラー';
    console.error('PlayPanel:', error);
  }
}

updateNowPlaying();
setInterval(updateNowPlaying, pollIntervalMs);
