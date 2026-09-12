let currentTrackKey = null;
let artworkRequestKey = null;
let artworkLoadedTrackKey = null;
let currentArtworkUrl = null;
let artworkRetryTimer = null;
let recordReturnTimer = null;
let clockTimer = null;
let blankTimer = null;
let updateInProgress = false;

const config = window.PLAYPANEL_CONFIG ?? {};
const animationConfig = config.animation ?? {};
const displayConfig = config.display ?? {};
const animationsEnabled = animationConfig.enabled === true;
const recordRotationEnabled = animationConfig.recordRotationEnabled !== false;
const recordRotationSpeed = Number(animationConfig.recordRotationSpeed) > 0
  ? Number(animationConfig.recordRotationSpeed)
  : 18;
const recordChangeEnabled = animationConfig.recordChangeEnabled !== false;
const infoChangeEnabled = animationConfig.infoChangeEnabled !== false;
const pollIntervalMs = Math.max(250, Number(config.pollIntervalMs) || 1000);
const artworkRetryIntervalMs = Math.max(250, Number(config.artworkRetryIntervalMs) || 3000);
const clockEnabled = displayConfig.clockEnabled === true;
const screenBlankEnabled = displayConfig.screenBlankEnabled === true;
const screenBlankTimeoutMinutes = Number(displayConfig.screenBlankTimeoutMinutes) > 0
  ? Number(displayConfig.screenBlankTimeoutMinutes)
  : 30;

const recordRotationDurationSeconds = 60 / recordRotationSpeed;

document.body.classList.toggle('animations-disabled', !animationsEnabled);
document.documentElement.style.setProperty(
  '--record-rotation-duration',
  `${recordRotationDurationSeconds}s`
);

function updateClock() {
  const clock = document.querySelector('#clock');
  if (!clock) return;

  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  clock.textContent = `${hours}:${minutes}`;
  clock.dateTime = now.toISOString();
}

function wakeScreen() {
  if (!screenBlankEnabled) return;
  document.body.classList.remove('screen-blanked');
  scheduleScreenBlank();
}

function scheduleScreenBlank() {
  if (!screenBlankEnabled) return;

  if (blankTimer !== null) {
    window.clearTimeout(blankTimer);
  }

  blankTimer = window.setTimeout(() => {
    document.body.classList.add('screen-blanked');
    blankTimer = null;
  }, screenBlankTimeoutMinutes * 60 * 1000);
}

function setupDisplayFeatures() {
  if (clockEnabled) {
    updateClock();
    clockTimer = window.setInterval(updateClock, 1000);
  }

  if (screenBlankEnabled) {
    const wakeEvents = ['pointerdown', 'pointermove', 'keydown', 'touchstart', 'wheel'];
    wakeEvents.forEach((eventName) => {
      window.addEventListener(eventName, wakeScreen, { passive: true });
    });
    scheduleScreenBlank();
  }
}

function updateTitleSize(title) {
  const titleElement = document.querySelector('#title');
  if (!titleElement) return;

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
  if (record) {
    applyRecordRotation(record, playing);
  }
}

function getRecordRotationDegrees(record) {
  const transform = getComputedStyle(record).transform;
  if (!transform || transform === 'none') return 0;

  const match = transform.match(/^matrix\(([^)]+)\)$/);
  if (!match) return 0;

  const values = match[1].split(',').map(Number);
  if (values.length < 2 || !Number.isFinite(values[0]) || !Number.isFinite(values[1])) {
    return 0;
  }

  let degrees = Math.atan2(values[1], values[0]) * (180 / Math.PI);
  if (degrees < 0) degrees += 360;
  return degrees;
}

function clearRecordReturn(record) {
  if (recordReturnTimer !== null) {
    window.clearTimeout(recordReturnTimer);
    recordReturnTimer = null;
  }

  record.classList.remove('record--returning');
  record.style.transition = '';
  record.style.transform = '';
}

function applyRecordRotation(record, playing) {
  const shouldSpin = animationsEnabled && recordRotationEnabled && playing === true;

  if (shouldSpin) {
    clearRecordReturn(record);
    record.classList.add('record--spinning');
    return;
  }

  if (!animationsEnabled || !recordRotationEnabled) {
    clearRecordReturn(record);
    record.classList.remove('record--spinning');
    return;
  }

  if (record.classList.contains('record--returning')) return;

  const currentRotation = getRecordRotationDegrees(record);
  record.classList.remove('record--spinning');

  if (Math.abs(currentRotation) < 0.5) {
    record.style.transform = '';
    return;
  }

  record.style.transition = 'none';
  record.style.transform = `rotate(${currentRotation}deg)`;
  record.classList.add('record--returning');

  void record.offsetWidth;

  record.style.transition = 'transform 700ms cubic-bezier(0.22, 1, 0.36, 1)';
  requestAnimationFrame(() => {
    record.style.transform = 'rotate(0deg)';
  });

  recordReturnTimer = window.setTimeout(() => {
    recordReturnTimer = null;
    record.classList.remove('record--returning');
    record.style.transition = '';
    record.style.transform = '';
  }, 750);
}

function setArtworkGlow(src) {
  const recordStage = document.querySelector('.record-stage');
  if (!recordStage) return;

  if (src) {
    recordStage.style.setProperty('--artwork-image', `url("${src}")`);
    recordStage.classList.add('has-artwork-glow');
  } else {
    recordStage.style.removeProperty('--artwork-image');
    recordStage.classList.remove('has-artwork-glow');
  }
}

function swapArtwork(artwork, objectUrl, playing) {
  // The image has already loaded successfully. Only now touch the live <img>.
  artwork.onload = null;
  artwork.onerror = null;
  artwork.src = objectUrl;
  artwork.hidden = false;
  setArtworkGlow(objectUrl);
  applyRecordRotation(document.querySelector('.record'), playing);
}

function scheduleArtworkRetry(trackKey, data, artwork, delay = artworkRetryIntervalMs) {
  if (artworkRetryTimer !== null) {
    window.clearTimeout(artworkRetryTimer);
  }

  artworkRetryTimer = window.setTimeout(() => {
    artworkRetryTimer = null;

    if (currentTrackKey !== trackKey || artworkLoadedTrackKey === trackKey) return;
    if (artworkRequestKey === null) requestArtwork(trackKey, data, artwork);
  }, Math.max(100, delay));
}

async function requestArtwork(trackKey, data, artwork) {
  if (!trackKey || currentTrackKey !== trackKey || artworkRequestKey === trackKey) return;

  artworkRequestKey = trackKey;

  const loadArtwork = async (attempt = 1) => {
    if (currentTrackKey !== trackKey || artworkRequestKey !== trackKey) return;

    let objectUrl = null;

    try {
      const response = await fetch(
        `/artwork?track_id=${encodeURIComponent(trackKey)}&t=${Date.now()}`,
        { cache: 'no-store' }
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.startsWith('image/')) {
        throw new Error(`Unexpected content type: ${contentType || 'unknown'}`);
      }

      const blob = await response.blob();
      objectUrl = URL.createObjectURL(blob);
      const image = new Image();

      image.onload = () => {
        if (currentTrackKey !== trackKey || artworkRequestKey !== trackKey) {
          URL.revokeObjectURL(objectUrl);
          return;
        }

        const previousUrl = currentArtworkUrl;
        artworkLoadedTrackKey = trackKey;
        artworkRequestKey = null;
        currentArtworkUrl = objectUrl;

        swapArtwork(artwork, objectUrl, data.playing);

        if (artworkRetryTimer !== null) {
          window.clearTimeout(artworkRetryTimer);
          artworkRetryTimer = null;
        }

        if (previousUrl?.startsWith('blob:') && previousUrl !== objectUrl) {
          window.setTimeout(() => URL.revokeObjectURL(previousUrl), 2000);
        }
      };

      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;

        if (currentTrackKey !== trackKey || artworkRequestKey !== trackKey) return;

        artworkRequestKey = null;

        if (attempt < 3) {
          window.setTimeout(() => requestArtwork(trackKey, data, artwork), 150);
          return;
        }

        console.warn('PlayPanel: artwork request will be retried');
        scheduleArtworkRetry(trackKey, data, artwork);
      };

      image.src = objectUrl;
    } catch (error) {
      if (objectUrl) URL.revokeObjectURL(objectUrl);

      if (currentTrackKey !== trackKey || artworkRequestKey !== trackKey) return;

      artworkRequestKey = null;

      if (attempt < 3) {
        window.setTimeout(() => requestArtwork(trackKey, data, artwork), 150);
        return;
      }

      console.warn('PlayPanel: artwork request will be retried', error);
      scheduleArtworkRetry(trackKey, data, artwork);
    }
  };

  loadArtwork();
}

async function updateNowPlaying() {
  if (updateInProgress) return;
  updateInProgress = true;

  try {
    const response = await fetch('/now-playing.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();

    const title = data.title || '---';
    const artist = document.querySelector('#artist');
    const album = document.querySelector('#album');
    const titleElement = document.querySelector('#title');

    if (titleElement) {
      titleElement.textContent = title;
      updateTitleSize(title);
    }
    if (artist) artist.textContent = data.artist || '---';
    if (album) album.textContent = data.album || '---';

    const status = document.querySelector('#status');
    const hasTrackInfo = Boolean(data.title || data.artist || data.album || data.track_id);
    if (status) {
      status.textContent = hasTrackInfo
        ? data.playing === true ? '再生中' : data.playing === false ? '停止' : '待機中'
        : 'Shairport未接続';
    }

    applyPlaybackState(data.playing);

    const trackKey = data.track_id || '';
    const artwork = document.querySelector('#artwork');
    if (!artwork || !trackKey) return;

    const trackChanged = trackKey !== currentTrackKey;

    if (trackChanged) {
      currentTrackKey = trackKey;
      artworkLoadedTrackKey = null;
      artworkRequestKey = null;

      if (artworkRetryTimer !== null) {
        window.clearTimeout(artworkRetryTimer);
        artworkRetryTimer = null;
      }

      // Keep the currently visible artwork until the new image has loaded.
      requestArtwork(trackKey, data, artwork);
    } else if (artworkLoadedTrackKey !== trackKey && artworkRequestKey === null) {
      requestArtwork(trackKey, data, artwork);
    }
  } catch (error) {
    console.warn('PlayPanel: now-playing update failed', error);
  } finally {
    updateInProgress = false;
  }
}

setupDisplayFeatures();
updateNowPlaying();
window.setInterval(updateNowPlaying, pollIntervalMs);
