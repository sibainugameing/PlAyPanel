(() => {
  const stage = document.querySelector('.record-stage');
  if (!stage) return;

  const syncArtworkBackground = () => {
    const activeArtwork = stage.querySelector('.record-layer--active .artwork');
    const imageUrl = activeArtwork && !activeArtwork.hidden
      ? activeArtwork.currentSrc || activeArtwork.src
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
