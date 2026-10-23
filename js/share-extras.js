/**
 * Add a copy-link action to the article share row.
 * Stellar's share providers do not include a clipboard action, so this appends
 * one next to the configured share buttons.
 */
(function () {
  'use strict';

  function copyText(text) {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      return navigator.clipboard.writeText(text);
    }

    return new Promise(function (resolve, reject) {
      var textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        var ok = document.execCommand('copy');
        document.body.removeChild(textarea);
        ok ? resolve() : reject(new Error('copy failed'));
      } catch (error) {
        document.body.removeChild(textarea);
        reject(error);
      }
    });
  }

  function addCopyButton() {
    var wrap = document.querySelector('.article-share .social-wrap');
    if (!wrap || wrap.querySelector('.share-copy')) return;

    var button = document.createElement('a');
    button.className = 'social share-item copy-link ui-interactive is-icon-only share-copy';
    button.href = 'javascript:void(0)';
    button.setAttribute('role', 'button');
    button.setAttribute('aria-label', '复制链接');
    button.setAttribute('title', '复制链接');
    button.innerHTML =
      '<span class="share-item__icon ui-icon" aria-hidden="true">🔗</span>';

    var resetTimer = null;
    button.addEventListener('click', function () {
      copyText(window.location.href)
        .then(function () {
          window.clearTimeout(resetTimer);
          button.classList.add('is-copied');
          button.setAttribute('aria-label', '链接已复制');
          button.setAttribute('title', '链接已复制');
          resetTimer = window.setTimeout(function () {
            button.classList.remove('is-copied');
            button.setAttribute('aria-label', '复制链接');
            button.setAttribute('title', '复制链接');
          }, 1800);
        })
        .catch(function () {
          button.setAttribute('title', '复制失败，请手动复制地址栏链接');
        });
    });

    wrap.appendChild(button);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addCopyButton);
  } else {
    addCopyButton();
  }
})();
