(() => {
  const artwork = document.querySelector('#artwork');
  if (!artwork) return;

  const syncArtworkBackground = () => {
    const imageUrl = artwork.hidden ? '' : artwork.currentSrc || artwork.src;

    if (imageUrl) {
      document.body.style.setProperty(
        '--background-artwork-image',
        `url("${imageUrl.replace(/"/g, '\\"')}")`
      );
    } else {
      document.body.style.removeProperty('--background-artwork-image');
    }
  };

  artwork.addEventListener('load', syncArtworkBackground);

  new MutationObserver(syncArtworkBackground).observe(artwork, {
    attributes: true,
    attributeFilter: ['src', 'hidden'],
  });

  syncArtworkBackground();
})();
