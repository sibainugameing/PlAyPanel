let lastTrackKey = null;
let artworkRequestKey = null;

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

function applyRecordRotation(record, playing) {
  const shouldSpin = animationsEnabled && recordRotationEnabled && playing === true;
  record.classList.toggle('record--spinning', shouldSpin);
}

function showArtwork(artwork, src) {
  artwork.src = src;
  artwork.hidden = false;
}

function hideArtwork(artwork) {
  artwork.hidden = true;
  artwork.removeAttribute('src');
}

function animateTrackChange(artwork, hasArtwork, playing) {
  const record = document.querySelector('.record');
  const recordStage = document.querySelector('.record-stage');
  const info = document.querySelector('.info');

  if (!record || !recordStage || !info || !animationsEnabled) {
    if (hasArtwork) {
      artwork.hidden = false;
    } else {
      hideArtwork(artwork);
    }
    if (record) {
      record.classList.remove('record--enter');
      applyRecordRotation(record, playing);
    }
    info?.classList.remove('info--change');
    return;
  }

  if (recordChangeEnabled) {
    const oldRecord = record.cloneNode(true);
    const clonedArtwork = oldRecord.querySelector('#artwork');
    if (clonedArtwork) {
      clonedArtwork.removeAttribute('id');
    }

    oldRecord.classList.remove('record--spinning', 'record--enter');
    oldRecord.classList.add('record--exit');
    recordStage.appendChild(oldRecord);

    if (hasArtwork) {
      artwork.hidden = false;
    } else {
      hideArtwork(artwork);
    }

    record.classList.remove('record--enter');
    void record.offsetWidth;
    record.classList.add('record--enter');
    applyRecordRotation(record, playing);

    const changeDuration = parseFloat(
      getComputedStyle(document.documentElement)
        .getPropertyValue('--record-change-duration')
    ) || 760;

    window.setTimeout(() => {
      oldRecord.remove();
      record.classList.remove('record--enter');
      applyRecordRotation(record, playing);
    }, changeDuration + 30);
  } else {
    if (hasArtwork) {
      artwork.hidden = false;
    } else {
      hideArtwork(artwork);
    }
    applyRecordRotation(record, playing);
  }

  if (infoChangeEnabled) {
    info.classList.remove('info--change');
    void info.offsetWidth;
    info.classList.add('info--change');

    const infoDuration = parseFloat(
      getComputedStyle(document.documentElement)
        .getPropertyValue('--info-change-duration')
    ) || 420;

    window.setTimeout(() => {
      info.classList.remove('info--change');
    }, infoDuration + 30);
  }
}

function requestArtwork(trackKey, data, artwork) {
  if (artworkRequestKey === trackKey) {
    return;
  }

  artworkRequestKey = trackKey;

  const nextArtworkUrl = `/artwork?t=${Date.now()}`;
  const image = new Image();

  image.onload = () => {
    // Ignore an older request if another track was requested meanwhile.
    if (artworkRequestKey !== trackKey) {
      return;
    }

    showArtwork(artwork, nextArtworkUrl);
    lastTrackKey = trackKey;
    artworkRequestKey = null;
    animateTrackChange(artwork, true, data.playing);
  };

  image.onerror = () => {
    // Keep lastTrackKey unchanged so the next poll retries this track.
    if (artworkRequestKey === trackKey) {
      artworkRequestKey = null;
    }
    console.error('PlayPanel: artwork failed to load; will retry');
  };

  image.src = nextArtworkUrl;
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

    const record = document.querySelector('.record');
    if (record) {
      applyRecordRotation(record, data.playing);
    }

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
      // No artwork is a confirmed state, so this track can be committed immediately.
      lastTrackKey = trackKey;
      artworkRequestKey = null;
      hideArtwork(artwork);
      animateTrackChange(artwork, false, data.playing);
    }
  } catch (error) {
    document.querySelector('#status').textContent = '接続エラー';
    console.error('PlayPanel:', error);
  }
}

updateNowPlaying();
setInterval(updateNowPlaying, pollIntervalMs);
