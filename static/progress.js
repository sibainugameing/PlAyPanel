(() => {
  const timeElement = document.querySelector('#progress-time');
  if (!timeElement) return;

  const formatTime = (seconds, unknown = '--:--') => {
    if (!Number.isFinite(seconds) || seconds < 0) return unknown;
    const total = Math.floor(seconds);
    const minutes = Math.floor(total / 60);
    const remainder = total % 60;
    return `${minutes}:${String(remainder).padStart(2, '0')}`;
  };

  const update = async () => {
    try {
      const response = await fetch('/now-playing.json', { cache: 'no-store' });
      if (!response.ok) return;

      const data = await response.json();
      const playback = data.progress;
      const elapsedText = formatTime(Number(playback?.elapsed_seconds), '0:00');
      const durationText = formatTime(Number(playback?.duration_seconds));
      timeElement.textContent = `${elapsedText} / ${durationText}`;
    } catch (_error) {
      // The main PlayPanel polling loop handles connection errors.
    }
  };

  update();
  window.setInterval(update, 250);
})();
