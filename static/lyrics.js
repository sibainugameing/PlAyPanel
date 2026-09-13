(() => {
  const config = window.PLAYPANEL_CONFIG ?? {};
  const lyricsConfig = config.lyrics ?? {};
  if (lyricsConfig.enabled !== true) return;

  const info = document.querySelector('.info');
  const trackCopy = document.querySelector('.track-copy');
  if (!info || !trackCopy) return;

  const panel = document.createElement('div');
  panel.id = 'lyrics-panel';
  panel.className = 'lyrics-panel';
  panel.hidden = true;
  panel.setAttribute('aria-label', 'Lyrics');

  const linesElement = document.createElement('div');
  linesElement.id = 'lyrics-lines';
  linesElement.className = 'lyrics-lines';

  const statusElement = document.createElement('p');
  statusElement.id = 'lyrics-status';
  statusElement.className = 'lyrics-status';

  panel.append(linesElement, statusElement);
  trackCopy.after(panel);

  const visibleLines = Math.max(3, Number(lyricsConfig.visibleLines) || 5);
  let trackKey = null;
  let lyricLines = [];
  let currentIndex = -1;
  let playing = false;
  let startedAt = 0;
  let pausedAt = 0;
  let updateTimer = null;
  let fetchController = null;
  let lyricsAvailable = false;
  let lyricsMode = false;

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'lyrics-toggle';
  toggle.textContent = 'LYRICS';
  toggle.hidden = true;
  toggle.setAttribute('aria-label', 'Toggle lyrics view');
  toggle.setAttribute('aria-pressed', 'false');
  panel.after(toggle);

  function setStatus(text) {
    statusElement.textContent = text;
  }

  function setMode(enabled) {
    lyricsMode = enabled && lyricsAvailable;
    document.body.classList.toggle('lyrics-mode', lyricsMode);
    panel.hidden = !lyricsMode;
    toggle.textContent = lyricsMode ? 'TRACK' : 'LYRICS';
    toggle.setAttribute('aria-pressed', String(lyricsMode));
  }

  function renderLines() {
    linesElement.replaceChildren();
    if (!lyricLines.length) return;

    let start = Math.max(0, currentIndex - Math.floor(visibleLines / 2));
    if (currentIndex < 0) start = 0;
    const end = Math.min(lyricLines.length, start + visibleLines);

    for (let index = start; index < end; index += 1) {
      const line = lyricLines[index];
      const element = document.createElement('p');
      element.className = 'lyrics-line';
      element.textContent = line.text || '♪';
      if (index === currentIndex) element.classList.add('is-current');
      else if (currentIndex >= 0 && Math.abs(index - currentIndex) === 1) element.classList.add('is-near');
      linesElement.appendChild(element);
    }
  }

  function findCurrentIndex(positionMs) {
    let index = -1;
    for (let i = 0; i < lyricLines.length; i += 1) {
      if (lyricLines[i].time_ms <= positionMs) index = i;
      else break;
    }
    return index;
  }

  function getPositionMs() {
    if (!playing) return pausedAt;
    return Math.max(0, performance.now() - startedAt);
  }

  function updateSync() {
    if (!lyricLines.length) return;
    const positionMs = getPositionMs();
    const nextIndex = findCurrentIndex(positionMs);
    if (nextIndex !== currentIndex) {
      currentIndex = nextIndex;
      renderLines();
    }
  }

  function startTimer() {
    if (updateTimer !== null) return;
    updateTimer = window.setInterval(updateSync, 100);
  }

  async function loadLyrics(key) {
    if (fetchController) fetchController.abort();
    fetchController = new AbortController();
    const controller = fetchController;

    lyricLines = [];
    currentIndex = -1;
    lyricsAvailable = false;
    linesElement.replaceChildren();
    panel.hidden = true;
    toggle.hidden = true;
    document.body.classList.remove('lyrics-mode');
    lyricsMode = false;
    setStatus('Searching lyrics');

    try {
      const response = await fetch('/lyrics.json', {
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = await response.json();
      if (trackKey !== key) return;

      lyricLines = Array.isArray(result.lines) ? result.lines : [];
      lyricsAvailable = result.synced === true && lyricLines.length > 0;

      if (!lyricsAvailable) {
        setStatus(result.found ? 'No synchronized lyrics' : 'Lyrics unavailable');
        return;
      }

      startedAt = performance.now();
      pausedAt = 0;
      currentIndex = findCurrentIndex(0);
      renderLines();
      toggle.hidden = false;
      setStatus('0:00');
    } catch (error) {
      if (error.name === 'AbortError') return;
      if (trackKey !== key) return;
      setStatus('Lyrics lookup failed');
    }
  }

  function handleNowPlaying(data) {
    const title = data.title || '';
    const artist = data.artist || '';
    const album = data.album || '';
    const key = `${artist}\u001f${title}\u001f${album}`;
    const nextPlaying = data.playing === true;

    if (key !== trackKey) {
      trackKey = key;
      playing = nextPlaying;
      startedAt = performance.now();
      pausedAt = 0;
      if (title && artist) loadLyrics(key);
      return;
    }

    if (playing !== nextPlaying) {
      if (nextPlaying) startedAt = performance.now() - pausedAt;
      else pausedAt = Math.max(0, performance.now() - startedAt);
      playing = nextPlaying;
    }

    updateSync();
  }

  async function poll() {
    try {
      const response = await fetch('/now-playing.json', { cache: 'no-store' });
      if (!response.ok) return;
      handleNowPlaying(await response.json());
    } catch (error) {
      console.warn('PlayPanel: lyrics metadata update failed', error);
    }
  }

  toggle.addEventListener('click', () => setMode(!lyricsMode));

  window.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() !== 'l' || event.ctrlKey || event.metaKey || event.altKey) return;
    if (!lyricsAvailable) return;
    setMode(!lyricsMode);
  });

  startTimer();
  poll();
  window.setInterval(poll, 250);
})();
