let currentTrackKey = null;
let artworkRequestKey = null;
let artworkLoadedTrackKey = null;
let currentArtworkUrl = null;
let artworkRetryTimer = null;
let artworkCollectionTimer = null;
let artworkCollectionEndTimer = null;
let recordReturnTimer = null;
let trackAnimationTimer = null;
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

// On a track change, keep requesting artwork for a short window before displaying it.
// This avoids committing an image from the brief period where metadata is still changing.
const artworkCollectionIntervalMs = 200;
const artworkCollectionDurationMs = 4000;

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
  if (!record) return;

  // Track-change animations own the transform. Polling must not interrupt them.
  if (record.classList.contains('record--enter') || record.classList.contains('record--exit')) return;

  const shouldSpin = animationsEnabled && recordRotationEnabled && playing === true;

  if (shouldSpin) {
    if (!record.classList.contains('record--spinning')) {
      clearRecordReturn(record);
      record.classList.add('record--spinning');
    }
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
    recordStage.style.setProperty('--artwork-image', `url(\"${src}\")`);
    recordStage.classList.add('has-artwork-glow');
  } else {
    recordStage.style.removeProperty('--artwork-image');
    recordStage.classList.remove('has-artwork-glow');
  }
}

function clearTrackAnimationTimer() {
  if (trackAnimationTimer !== null) {
    window.clearTimeout(trackAnimationTimer);
    trackAnimationTimer = null;
  }
}

function runTrackChangeAnimation(playing) {
  const record = document.querySelector('.record');
  const info = document.querySelector('.info');
  if (!record) return;

  clearTrackAnimationTimer();

  if (!animationsEnabled || !recordChangeEnabled) {
    record.classList.remove('record--enter', 'record--exit', 'record--spinning');
    applyRecordRotation(record, playing);
    return;
  }

  record.classList.remove('record--spinning', 'record--enter', 'record--exit');
  void record.offsetWidth;
  record.classList.add('record--exit');

  const exitDuration = Math.max(0, Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue('--record-change-duration')
  ) || 760);

  trackAnimationTimer = window.setTimeout(() => {
    trackAnimationTimer = null;

    record.classList.remove('record--exit');
    void record.offsetWidth;
    record.classList.add('record--enter');

    const handleEntranceEnd = (event) => {
      if (event.animationName !== 'record-enter') return;
      record.removeEventListener('animationend', handleEntranceEnd);
      record.classList.remove('record--enter');
      applyRecordRotation(record, playing);
    };

    record.addEventListener('animationend', handleEntranceEnd);
  }, Math.round(exitDuration * 0.82));

  if (animationsEnabled && info && infoChangeEnabled) {
    info.classList.remove('info--change');
    void info.offsetWidth;
    info.classList.add('info--change');

    const infoDuration = parseFloat(
      getComputedStyle(document.documentElement).getPropertyValue('--info-change-duration')
    ) || 420;

    window.setTimeout(() => {
      info.classList.remove('info--change');
    }, infoDuration + 30);
  }
}

function swapArtwork(artwork, artworkUrl, playing) {
  // The collection window has completed. Commit the last successful HTTP image.
  artwork.onload = null;
  artwork.onerror = null;
  artwork.src = artworkUrl;
  artwork.hidden = false;
  currentArtworkUrl = artworkUrl;
  setArtworkGlow(artworkUrl);
  runTrackChangeAnimation(playing);
}

function clearArtworkCollectionTimers() {
  if (artworkCollectionTimer !== null) {
    window.clearInterval(artworkCollectionTimer);
    artworkCollectionTimer = null;
  }

  if (artworkCollectionEndTimer !== null) {
    window.clearTimeout(artworkCollectionEndTimer);
    artworkCollectionEndTimer = null;
  }
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

function requestArtwork(trackKey, data, artwork) {
  if (!trackKey || currentTrackKey !== trackKey || artworkRequestKey === trackKey) return;

  artworkRequestKey = trackKey;
  let latestSuccessfulUrl = null;
  let finished = false;

  const loadArtwork = () => {
    if (finished || currentTrackKey !== trackKey) return;

    const artworkUrl = `/artwork?track_id=${encodeURIComponent(trackKey)}&t=${Date.now()}`;
    const image = new Image();

    image.onload = () => {
      if (finished || currentTrackKey !== trackKey || artworkRequestKey !== trackKey) return;
      latestSuccessfulUrl = artworkUrl;
    };

    image.onerror = () => {
      // Keep collecting. A temporary 404/failed load is expected while metadata settles.
    };

    image.src = artworkUrl;
  };

  clearArtworkCollectionTimers();

  // Start immediately, then continue sampling for the whole collection window.
  loadArtwork();
  artworkCollectionTimer = window.setInterval(loadArtwork, artworkCollectionIntervalMs);

  artworkCollectionEndTimer = window.setTimeout(() => {
    artworkCollectionEndTimer = null;
    if (currentTrackKey !== trackKey || artworkRequestKey !== trackKey) {
      clearArtworkCollectionTimers();
      return;
    }

    finished = true;
    if (artworkCollectionTimer !== null) {
      window.clearInterval(artworkCollectionTimer);
      artworkCollectionTimer = null;
    }

    if (latestSuccessfulUrl !== null) {
      artworkLoadedTrackKey = trackKey;
      artworkRequestKey = null;

      if (artworkRetryTimer !== null) {
        window.clearTimeout(artworkRetryTimer);
        artworkRetryTimer = null;
      }

      swapArtwork(artwork, latestSuccessfulUrl, data.playing);
    } else {
      artworkRequestKey = null;
      scheduleArtworkRetry(trackKey, data, artwork, 500);
    }
  }, artworkCollectionDurationMs);
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
      clearArtworkCollectionTimers();

      // Keep the current artwork visible while the new artwork is collected.
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
