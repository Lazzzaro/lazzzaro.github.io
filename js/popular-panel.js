/**
 * Position the homepage floating sidebar next to the post cards.
 *
 * The panel is position: fixed and its width adapts to the viewport. The right
 * margin mirrors the left navigation's margin, and the post list is narrowed
 * only enough to leave a small gap before the panel.
 */
(function () {
  'use strict';

  var panel = null;
  var list = null;
  var initialTop = null;

  function positionPanel() {
    if (!panel || !list) return;

    var gap = 20;
    var minWidth = 280;
    var maxWidth = 360;

    panel.hidden = true;
    list.style.removeProperty('max-width');

    if (window.innerWidth < 800) return;

    var leftbar = document.getElementById('leftbar-region');
    var sideGap = leftbar
      ? Math.max(0, Math.round(leftbar.getBoundingClientRect().left))
      : 16;
    var width = window.innerHeight < 800
      ? 360
      : Math.min(
          maxWidth,
          Math.max(minWidth, Math.round(window.innerWidth * 0.3))
        );
    var panelLeft = window.innerWidth - sideGap - width;
    var listLeft = list.getBoundingClientRect().left;
    var listWidth = Math.floor(panelLeft - listLeft - gap);

    if (listWidth < 210) return;

    list.style.maxWidth = listWidth + 'px';

    if (initialTop == null) {
      initialTop = Math.max(16, Math.round(list.getBoundingClientRect().top));
    }

    panel.style.width = width + 'px';
    panel.style.left = panelLeft + 'px';
    panel.style.top = initialTop + 'px';
    panel.hidden = false;
  }

  function init() {
    panel = document.getElementById('popular-sidebar');
    list = document.querySelector('.post-list');
    if (!panel || !list) return;

    positionPanel();
    window.addEventListener('resize', positionPanel, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
