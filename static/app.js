let lastTrackKey = null;

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

function applyRecordRotation(record, playing) {
  const shouldSpin = animationsEnabled && recordRotationEnabled && playing === true;
  record.classList.toggle('record--spinning', shouldSpin);
}

function animateTrackChange(artwork, hasArtwork, playing) {
  const record = document.querySelector('.record');
  const recordStage = document.querySelector('.record-stage');
  const info = document.querySelector('.info');

  if (!record || !recordStage || !info || !animationsEnabled) {
    if (hasArtwork) {
      artwork.hidden = false;
    } else {
      artwork.hidden = true;
      artwork.removeAttribute('src');
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
      artwork.hidden = true;
      artwork.removeAttribute('src');
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
      artwork.hidden = true;
      artwork.removeAttribute('src');
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
          animateTrackChange(artwork, true, data.playing);
        };

        image.onerror = () => {
          animateTrackChange(artwork, false, data.playing);
          console.error('PlayPanel: artwork failed to load');
        };

        image.src = nextArtworkUrl;
      } else {
        animateTrackChange(artwork, false, data.playing);
      }
    }
  } catch (error) {
    document.querySelector('#status').textContent = '接続エラー';
    console.error('PlayPanel:', error);
  }
}

updateNowPlaying();
setInterval(updateNowPlaying, pollIntervalMs);
