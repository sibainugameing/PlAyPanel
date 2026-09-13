(() => {
  const stage = document.querySelector('.record-stage');
  if (!stage) return;

  // background.js loads this script. Keep this guard so an accidental
  // duplicate script tag can never create a second progress ring.
  if (stage.querySelector('.record-progress')) return;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('record-progress');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('aria-hidden', 'true');

  const base = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  base.classList.add('record-progress__base');
  base.setAttribute('cx', '50');
  base.setAttribute('cy', '50');
  base.setAttribute('r', '48.7');

  const progress = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  progress.classList.add('record-progress__value');
  progress.setAttribute('cx', '50');
  progress.setAttribute('cy', '50');
  progress.setAttribute('r', '48.7');
  progress.setAttribute('pathLength', '1');

  svg.append(base, progress);
  stage.appendChild(svg);

  progress.style.strokeDasharray = '1 1';
  progress.style.strokeDashoffset = '1';

  const style = document.createElement('style');
  style.textContent = `
    .record-progress {
      position: absolute;
      inset: 0;
      z-index: 8;
      width: 100%;
      height: 100%;
      overflow: visible;
      pointer-events: none;
      opacity: 0;
      transform: rotate(-90deg);
      transition: opacity 500ms ease;
    }

    .record-progress__base,
    .record-progress__value {
      fill: none;
      vector-effect: non-scaling-stroke;
    }

    .record-progress__base {
      stroke: rgba(255, 255, 255, 0.07);
      stroke-width: 1.8;
    }

    .record-progress__value {
      stroke: rgba(255, 255, 255, 0.96);
      stroke-width: 3.6;
      stroke-linecap: round;
      filter: drop-shadow(0 0 3px rgba(255, 255, 255, 0.35));
      transition: stroke-dashoffset 180ms linear;
    }

    .record-progress.is-available {
      opacity: 1;
    }

    .record-progress.is-complete .record-progress__value {
      stroke-width: 4.2;
    }
  `;
  document.head.appendChild(style);

  const formatTime = (seconds, unknown = '--:--') => {
    if (!Number.isFinite(seconds) || seconds < 0) return unknown;
    const total = Math.floor(seconds);
    const minutes = Math.floor(total / 60);
    const remainder = total % 60;
    return `${minutes}:${String(remainder).padStart(2, '0')}`;
  };

  const setProgress = (data) => {
    const playback = data.progress;
    const timeElement = document.querySelector('#progress-time');

    if (timeElement) {
      const elapsedText = formatTime(Number(playback?.elapsed_seconds), '0:00');
      const durationText = formatTime(Number(playback?.duration_seconds));
      timeElement.textContent = `${elapsedText} / ${durationText}`;
    }

    if (!playback || playback.available !== true || !Number.isFinite(playback.ratio)) {
      svg.classList.remove('is-available', 'is-complete');
      progress.style.strokeDashoffset = '1';
      return;
    }

    const ratio = Math.min(1, Math.max(0, Number(playback.ratio)));
    progress.style.strokeDashoffset = String(1 - ratio);

    svg.classList.add('is-available');
    svg.classList.toggle('is-complete', ratio >= 0.999);
  };

  const update = async () => {
    try {
      const response = await fetch('/now-playing.json', { cache: 'no-store' });
      if (!response.ok) return;
      setProgress(await response.json());
    } catch (_error) {
      // The main PlayPanel polling loop handles connection errors.
    }
  };

  update();
  window.setInterval(update, 250);
})();
