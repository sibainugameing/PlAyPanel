(() => {
  const config = window.PLAYPANEL_CONFIG ?? {};
  const lyricsConfig = config.lyrics ?? { enabled: true, visibleLines: 5 };
  if (lyricsConfig.enabled === false) return;

  const panel = document.querySelector('#lyrics-panel');
  const linesElement = document.querySelector('#lyrics-lines');
  const statusElement = document.querySelector('#lyrics-status');
  const trackCopy = document.querySelector('.track-copy');
  const nowLyricBar = document.querySelector('#now-lyric-bar');
  const nowLyricElement = document.querySelector('#now-lyric');

  if (!panel || !linesElement || !statusElement || !trackCopy || !nowLyricBar || !nowLyricElement) return;
  if (document.querySelector('.lyrics-toggle')) return;

  const visibleLines = Math.max(3, Number(lyricsConfig.visibleLines) || 5);

  // Positive offset means "delay the displayed lyric":
  // subtract the offset from the audio position used for lyric lookup.
  let syncOffsetSeconds = Number(
    lyricsConfig.syncOffsetSeconds ?? lyricsConfig.sync_offset_seconds
  ) || 0;
  let bottomEnabled = lyricsConfig.bottomEnabled ?? lyricsConfig.bottom_enabled ?? true;
  let bottomAnimationEnabled =
    lyricsConfig.bottomAnimationEnabled ?? lyricsConfig.bottom_animation_enabled ?? true;

  const applyUiConfig = (settings) => {
    const lyricSettings = settings?.lyrics ?? {};

    if (Number.isFinite(Number(lyricSettings.sync_offset_seconds))) {
      syncOffsetSeconds = Number(lyricSettings.sync_offset_seconds);
    }

    bottomEnabled = lyricSettings.bottom_enabled !== false;
    bottomAnimationEnabled = lyricSettings.bottom_animation_enabled !== false;

    const root = document.documentElement;
    if (lyricSettings.bottom_font_size) {
      root.style.setProperty('--lyrics-bottom-font-size', String(lyricSettings.bottom_font_size));
    }
    if (lyricSettings.bottom_max_width) {
      root.style.setProperty('--lyrics-bottom-max-width', String(lyricSettings.bottom_max_width));
    }
    if (Number.isFinite(Number(lyricSettings.bottom_opacity))) {
      root.style.setProperty(
        '--lyrics-bottom-opacity',
        String(Math.min(1, Math.max(0, Number(lyricSettings.bottom_opacity))))
      );
    }
    if (Number.isFinite(Number(lyricSettings.bottom_animation_duration))) {
      root.style.setProperty(
        '--lyrics-bottom-animation-duration',
        `${Math.max(0, Number(lyricSettings.bottom_animation_duration))}ms`
      );
    }
    if (Number.isFinite(Number(lyricSettings.bottom_animation_distance))) {
      root.style.setProperty(
        '--lyrics-bottom-animation-distance',
        `${Number(lyricSettings.bottom_animation_distance)}px`
      );
    }

    if (!bottomEnabled) hideCurrentLyric();
    else if (lyricsAvailable && !lyricsMode) showCurrentLyric(false);
  };

  fetch('/ui-config.json', { cache: 'no-store' })
    .then((response) => response.ok ? response.json() : null)
    .then((settings) => {
      if (settings) applyUiConfig(settings);
    })
    .catch(() => {});

  let trackKey = null;
  let lyricLines = [];
  let currentIndex = -1;
  let lyricsAvailable = false;
  let lyricsMode = false;
  let playing = false;
  let audioPositionMs = 0;
  let audioAnchorPerformanceMs = performance.now();
  let fetchController = null;
  let syncTimer = null;

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'lyrics-toggle';
  toggle.textContent = 'LYRICS';
  toggle.hidden = true;
  toggle.setAttribute('aria-label', '歌詞表示を切り替え');
  toggle.setAttribute('aria-pressed', 'false');
  panel.after(toggle);

  function setStatus(text) {
    statusElement.textContent = text;
  }

  function setMode(enabled) {
    lyricsMode = Boolean(enabled && lyricsAvailable);
    document.body.classList.toggle('lyrics-mode', lyricsMode);
    panel.hidden = !lyricsMode;
    toggle.textContent = lyricsMode ? 'TRACK' : 'LYRICS';
    toggle.setAttribute('aria-pressed', String(lyricsMode));

    if (!lyricsMode && lyricsAvailable && currentIndex >= 0) {
      showCurrentLyric(true);
    } else if (lyricsMode) {
      hideCurrentLyric();
    }
  }

  function getAudioPositionMs() {
    if (!playing) return Math.max(0, audioPositionMs);
    return Math.max(
      0,
      audioPositionMs + Math.max(0, performance.now() - audioAnchorPerformanceMs),
    );
  }

  function getAdjustedPositionMs() {
    // Positive offset delays the displayed lyric.
    return Math.max(0, getAudioPositionMs() - (syncOffsetSeconds * 1000));
  }

  function findCurrentIndex(positionMs) {
    let index = -1;
    for (let i = 0; i < lyricLines.length; i += 1) {
      if (Number(lyricLines[i].time_ms) <= positionMs) index = i;
      else break;
    }
    return index;
  }

  function updateLineProgress() {
    if (currentIndex < 0 || currentIndex >= lyricLines.length) {
      panel.style.setProperty('--lyrics-line-progress', '0');
      return;
    }

    const currentTime = Math.max(0, Number(lyricLines[currentIndex]?.time_ms) || 0);
    const nextTime = Number(lyricLines[currentIndex + 1]?.time_ms);
    const position = getAdjustedPositionMs();
    const duration = Number.isFinite(nextTime) ? Math.max(1, nextTime - currentTime) : 0;
    const progress = duration > 0
      ? Math.min(1, Math.max(0, (position - currentTime) / duration))
      : 0;

    panel.style.setProperty('--lyrics-line-progress', String(progress));
    const current = linesElement.querySelector('.lyrics-line.is-current');
    if (current) current.style.setProperty('--line-progress', String(progress));
  }

  function showCurrentLyric(animate = false) {
    if (!bottomEnabled || lyricsMode || !lyricsAvailable || currentIndex < 0 || currentIndex >= lyricLines.length) {
      hideCurrentLyric();
      return;
    }

    const text = lyricLines[currentIndex]?.text?.trim() || '♪';
    if (nowLyricElement.textContent === text && nowLyricBar.classList.contains('is-visible')) {
      return;
    }

    nowLyricElement.textContent = text;
    nowLyricBar.hidden = false;
    nowLyricBar.classList.remove('is-changing');
    void nowLyricBar.offsetWidth;
    nowLyricBar.classList.add('is-visible');
    if (animate && bottomAnimationEnabled) nowLyricBar.classList.add('is-changing');
  }

  function hideCurrentLyric() {
    nowLyricBar.classList.remove('is-visible', 'is-changing');
    nowLyricBar.hidden = true;
    nowLyricElement.textContent = '';
  }

  function renderLines(animate = false) {
    linesElement.replaceChildren();
    if (!lyricLines.length) return;

    const half = Math.floor(visibleLines / 2);
    let start = Math.max(0, currentIndex - half);
    const maxStart = Math.max(0, lyricLines.length - visibleLines);
    start = Math.min(start, maxStart);
    const end = Math.min(lyricLines.length, start + visibleLines);

    for (let index = start; index < end; index += 1) {
      const line = lyricLines[index];
      const element = document.createElement('p');
      const distance = currentIndex >= 0 ? Math.abs(index - currentIndex) : 99;

      element.className = 'lyrics-line';
      element.dataset.index = String(index);
      element.textContent = line.text || '♪';

      if (index === currentIndex) element.classList.add('is-current');
      else if (distance === 1) element.classList.add('is-near');
      else if (distance === 2) element.classList.add('is-far');

      if (animate) {
        element.classList.add('lyrics-enter');
        element.style.setProperty(
          '--lyrics-delay',
          `${Math.min(120, Math.abs(index - currentIndex) * 30)}ms`
        );
      }

      linesElement.appendChild(element);
    }

    updateLineProgress();
    showCurrentLyric(animate);
  }

  function updateSync(forceRender = false) {
    if (!lyricLines.length) return;

    const nextIndex = findCurrentIndex(getAdjustedPositionMs());
    if (forceRender || nextIndex !== currentIndex) {
      currentIndex = nextIndex;
      renderLines(true);
    } else {
      updateLineProgress();
      showCurrentLyric(false);
    }
  }

  function startSyncTimer() {
    if (syncTimer !== null) return;
    syncTimer = window.setInterval(() => updateSync(false), 50);
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
    hideCurrentLyric();
    panel.style.setProperty('--lyrics-line-progress', '0');
    setStatus('歌詞を検索中');

    try {
      const response = await fetch('/lyrics.json', {
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const result = await response.json();
      if (trackKey !== key) return;

      lyricLines = Array.isArray(result.lines)
        ? result.lines
            .filter((line) => Number.isFinite(Number(line?.time_ms)))
            .map((line) => ({
              time_ms: Number(line.time_ms),
              text: String(line.text ?? ''),
            }))
            .sort((a, b) => a.time_ms - b.time_ms)
        : [];

      lyricsAvailable = result.synced === true && lyricLines.length > 0;

      if (!lyricsAvailable) {
        hideCurrentLyric();
        setStatus(result.found ? '同期歌詞なし' : '歌詞が見つかりません');
        return;
      }

      currentIndex = findCurrentIndex(getAdjustedPositionMs());
      toggle.hidden = false;
      renderLines(false);
      if (document.body.classList.contains('clock-mode')) {
        lyricsMode = false;
        document.body.classList.remove('lyrics-mode');
        showCurrentLyric(true);
      } else {
        setMode(false);
      }
      setStatus('音声同期');
    } catch (error) {
      if (error.name === 'AbortError') return;
      if (trackKey !== key) return;
      hideCurrentLyric();
      setStatus('歌詞取得に失敗しました');
    }
  }

  function handleNowPlaying(data) {
    const title = data.title || '';
    const artist = data.artist || '';
    const album = data.album || '';
    const key = `${artist}\u001f${title}\u001f${album}`;

    const reportedPositionMs = Number(data.progress?.elapsed_seconds);
    const hasAudioPosition =
      data.progress?.available === true && Number.isFinite(reportedPositionMs);

    if (hasAudioPosition) {
      audioPositionMs = Math.max(0, reportedPositionMs * 1000);
      audioAnchorPerformanceMs = performance.now();
    } else {
      audioPositionMs = 0;
      audioAnchorPerformanceMs = performance.now();
    }

    playing = data.playing === true && hasAudioPosition;

    if (key !== trackKey) {
      trackKey = key;
      if (title && artist) loadLyrics(key);
      else hideCurrentLyric();
      return;
    }

    if (!hasAudioPosition) {
      setStatus(lyricsAvailable ? '音声時間待機中' : '歌詞を検索中');
    } else if (lyricsAvailable) {
      setStatus(
        `音声同期 ${syncOffsetSeconds >= 0 ? '+' : ''}${syncOffsetSeconds.toFixed(2)}s`
      );
    }

    updateSync(false);
  }

  function handleNowPlayingEvent(event) {
    if (!event?.detail) return;
    handleNowPlaying(event.detail);
  }

  toggle.addEventListener('click', () => setMode(!lyricsMode));

  window.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() !== 'l' || event.ctrlKey || event.metaKey || event.altKey) return;
    if (!lyricsAvailable) return;
    setMode(!lyricsMode);
  });

  window.addEventListener('playpanel:view-mode', (event) => {
    const clockMode = event.detail === 'clock';

    if (clockMode) {
      lyricsMode = false;
      document.body.classList.remove('lyrics-mode');
      showCurrentLyric(true);
    } else {
      setMode(false);
    }
  });

  window.addEventListener('playpanel:now-playing', handleNowPlayingEvent);

  startSyncTimer();

  const initialState = window.PLAYPANEL_STATE?.get();
  if (initialState) {
    handleNowPlaying(initialState);
  }
})();
