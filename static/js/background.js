(() => {
  const stage = document.querySelector('.record-stage');
  if (!stage) return;

  const syncArtworkBackground = () => {
    const playerArtwork = document.querySelector('#player-artwork');
    const activeRecordArtwork = stage.querySelector('.record-layer--active .artwork');
    const preferredArtwork =
      document.body.classList.contains('clock-mode') && playerArtwork && !playerArtwork.hidden
        ? playerArtwork
        : activeRecordArtwork;
    const imageUrl = preferredArtwork && !preferredArtwork.hidden
      ? preferredArtwork.currentSrc || preferredArtwork.src
      : '';

    if (imageUrl) {
      document.body.style.setProperty(
        '--background-artwork-image',
        `url("${imageUrl.replace(/"/g, '\\"')}")`
      );
    } else {
      document.body.style.removeProperty('--background-artwork-image');
    }
  };

  stage.addEventListener('animationend', (event) => {
    if (event.animationName === 'record-layer-enter' || event.animationName === 'record-layer-exit') {
      syncArtworkBackground();
    }
  });

  stage.addEventListener('load', syncArtworkBackground, true);

  new MutationObserver(syncArtworkBackground).observe(stage, {
    subtree: true,
    attributes: true,
    attributeFilter: ['src', 'hidden', 'class'],
  });

  syncArtworkBackground();
})();
