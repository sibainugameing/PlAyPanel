(() => {
  const svg = document.querySelector('#record-progress');
  const progress = document.querySelector('#record-progress__value');
  const timeElement = document.querySelector('#progress-time');

  if (!svg || !progress) return;

  // One SVG circle, one continuous stroke. The dash values use the SVG pathLength
  // unit so rendering size never changes the number of visible segments.
  progress.setAttribute('pathLength', '1');
  progress.setAttribute('stroke-dasharray', '1');
  progress.setAttribute('stroke-dashoffset', '1');

  let latestData = null;
  let receivedAt = 0;

  const formatTime = (seconds, unknown = '--:--') => {
    if (!Number.isFinite(seconds) || seconds < 0) return unknown;
    const total = Math.floor(seconds);
    const minutes = Math.floor(total / 60);
    const remainder = total % 60;
    return `${minutes}:${String(remainder).padStart(2, '0')}`;
  };

  const setProgress = (data) => {
    latestData = data;
    receivedAt = performance.now();

    const playback = data.progress;

    if (!playback || playback.available !== true || !Number.isFinite(Number(playback.elapsed_seconds))) {
      if (timeElement) {
        const elapsedText = formatTime(Number(playback?.elapsed_seconds), '0:00');
        const durationText = formatTime(Number(playback?.duration_seconds));
        timeElement.textContent = `${elapsedText} / ${durationText}`;
      }

      svg.classList.remove('is-available', 'is-complete', 'is-playing');
      progress.setAttribute('stroke-dashoffset', '1');
      return;
    }

    svg.classList.add('is-available');
    svg.classList.toggle('is-playing', data.playing === true);
  };

  const render = () => {
    const data = latestData;
    const playback = data?.progress;

    if (!playback || playback.available !== true) {
      return;
    }

    const durationSeconds = Number(playback.duration_seconds);
    let elapsedSeconds = Number(playback.elapsed_seconds);

    if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) {
      elapsedSeconds = 0;
    }

    if (data.playing === true) {
      elapsedSeconds += Math.max(0, (performance.now() - receivedAt) / 1000);
    }

    if (Number.isFinite(durationSeconds) && durationSeconds > 0) {
      elapsedSeconds = Math.min(durationSeconds, elapsedSeconds);
    }

    const ratio = Number.isFinite(Number(playback.ratio)) && durationSeconds > 0
      ? Math.min(1, Math.max(0, elapsedSeconds / durationSeconds))
      : Math.min(1, Math.max(0, Number(playback.ratio) || 0));

    if (timeElement) {
      const durationText = formatTime(durationSeconds);
      timeElement.textContent = `${formatTime(elapsedSeconds, '0:00')} / ${durationText}`;
    }

    progress.setAttribute('stroke-dashoffset', String(1 - ratio));
    svg.classList.toggle('is-complete', ratio >= 0.999);
  };

  const handleNowPlayingEvent = (event) => {
    if (!event?.detail) return;
    setProgress(event.detail);
    render();
  };

  window.addEventListener('playpanel:now-playing', handleNowPlayingEvent);

  const initialState = window.PLAYPANEL_STATE?.get();
  if (initialState) {
    setProgress(initialState);
  }

  render();
  window.setInterval(render, 50);
})();
