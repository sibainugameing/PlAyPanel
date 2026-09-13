(() => {
  const svg = document.querySelector('#record-progress');
  const progress = document.querySelector('#record-progress__value');
  const timeElement = document.querySelector('#progress-time');

  if (!svg || !progress) return;

  const radius = Number(progress.getAttribute('r')) || 47.9;
  const circumference = 2 * Math.PI * radius;

  progress.style.strokeDasharray = `${circumference} ${circumference}`;
  progress.style.strokeDashoffset = `${circumference}`;

  const formatTime = (seconds, unknown = '--:--') => {
    if (!Number.isFinite(seconds) || seconds < 0) return unknown;

    const total = Math.floor(seconds);
    const minutes = Math.floor(total / 60);
    const remainder = total % 60;
    return `${minutes}:${String(remainder).padStart(2, '0')}`;
  };

  const setProgress = (data) => {
    const playback = data.progress;

    if (timeElement) {
      const elapsedText = formatTime(Number(playback?.elapsed_seconds), '0:00');
      const durationText = formatTime(Number(playback?.duration_seconds));
      timeElement.textContent = `${elapsedText} / ${durationText}`;
    }

    if (!playback || playback.available !== true || !Number.isFinite(playback.ratio)) {
      svg.classList.remove('is-available', 'is-complete', 'is-playing');
      progress.style.strokeDashoffset = `${circumference}`;
      return;
    }

    const ratio = Math.min(1, Math.max(0, Number(playback.ratio)));
    progress.style.strokeDashoffset = String(circumference * (1 - ratio));

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
