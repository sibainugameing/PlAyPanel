(() => {
  const stage = document.querySelector('.record-stage');
  if (!stage) return;

  // Never create more than one progress ring.
  if (stage.querySelector('.record-progress')) return;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('record-progress');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('aria-hidden', 'true');

  const progress = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  progress.classList.add('record-progress__value');
  progress.setAttribute('cx', '50');
  progress.setAttribute('cy', '50');
  // The record fills the stage. Keep the stroke fully inside the SVG viewport
  // while putting its outer edge exactly at the record's outer edge.
  const radius = 48.0;
  progress.setAttribute('r', String(radius));

  svg.append(progress);
  stage.appendChild(svg);

  const circumference = 2 * Math.PI * radius;
  progress.style.strokeDasharray = `${circumference} ${circumference}`;
  progress.style.strokeDashoffset = `${circumference}`;

  const style = document.createElement('style');
  style.textContent = `
    .record-progress {
      position: absolute;
      inset: 0;
      z-index: 8;
      width: 100%;
      height: 100%;
      display: block;
      overflow: visible;
      pointer-events: none;
      opacity: 0;
      transform: rotate(-90deg);
      transform-origin: 50% 50%;
      transition: opacity 500ms ease;
    }

    .record-progress__value {
      fill: none;
      stroke: rgba(255, 255, 255, 0.98);
      stroke-width: 3.8;
      stroke-linecap: round;
      vector-effect: non-scaling-stroke;
      filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.38));
      transition: stroke-dashoffset 180ms linear;
    }

    .record-progress.is-available {
      opacity: 1;
    }

    .record-progress.is-complete .record-progress__value {
      stroke-width: 4.4;
      filter: drop-shadow(0 0 6px rgba(255, 255, 255, 0.55));
    }

    .progress-time {
      margin: 0 0 14px;
      color: rgba(255, 255, 255, 0.58);
      font-size: 0.92rem;
      font-weight: 600;
      line-height: 1;
      letter-spacing: 0.08em;
      font-variant-numeric: tabular-nums;
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
      progress.style.strokeDashoffset = `${circumference}`;
      return;
    }

    const ratio = Math.min(1, Math.max(0, Number(playback.ratio)));
    progress.style.strokeDashoffset = String(circumference * (1 - ratio));

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
