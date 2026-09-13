(() => {
  const stage = document.querySelector('.record-stage');
  if (!stage) return;

  // Prevent duplicate progress rings if this script is ever loaded more than once.
  if (stage.querySelector('.record-progress')) return;

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.classList.add('record-progress');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('aria-hidden', 'true');

  const base = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  base.classList.add('record-progress__base');
  base.setAttribute('cx', '50');
  base.setAttribute('cy', '50');
  base.setAttribute('r', '48');

  const progress = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  progress.classList.add('record-progress__value');
  progress.setAttribute('cx', '50');
  progress.setAttribute('cy', '50');
  progress.setAttribute('r', '48');
  progress.setAttribute('pathLength', '1');

  svg.append(base, progress);
  stage.appendChild(svg);

  progress.style.strokeDasharray = '1 1';
  progress.style.strokeDashoffset = '1';

  const style = document.createElement('style');
  style.textContent = `
    .record-progress {
      position: absolute;
      inset: 1.2%;
      z-index: 8;
      width: 97.6%;
      height: 97.6%;
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
      stroke: rgba(255, 255, 255, 0.10);
      stroke-width: 0.75;
    }

    .record-progress__value {
      stroke: rgba(255, 255, 255, 0.88);
      stroke-width: 1.45;
      stroke-linecap: round;
      filter: drop-shadow(0 0 3px rgba(255, 255, 255, 0.34));
      transition: stroke-dashoffset 180ms linear;
    }

    .record-progress.is-available {
      opacity: 1;
    }

    .record-progress.is-playing .record-progress__value {
      stroke: rgba(255, 255, 255, 0.96);
    }

    .record-progress.is-complete .record-progress__value {
      stroke-width: 2;
      filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.55));
    }
  `;
  document.head.appendChild(style);

  const setProgress = (data) => {
    const playback = data.progress;
    if (!playback || playback.available !== true || !Number.isFinite(playback.ratio)) {
      svg.classList.remove('is-available', 'is-playing', 'is-complete');
      progress.style.strokeDashoffset = '1';
      return;
    }

    const ratio = Math.min(1, Math.max(0, Number(playback.ratio)));
    progress.style.strokeDashoffset = String(1 - ratio);

    svg.classList.add('is-available');
    svg.classList.toggle('is-playing', data.playing === true);
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
