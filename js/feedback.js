/**
 * Post feedback: "Was this article helpful?"
 *
 * One "helpful" vote per browser. The custom /api/helpful endpoint stores the
 * visitor metadata in CloudBase and increments Counter.helpful.
 *
 * The same vote is exposed twice:
 *   - the full card before the comments
 *   - a fixed compact pill at the bottom-right while reading
 */
(function () {
  'use strict';

  if (document.body.getAttribute('data-page-layout') !== 'post') return;
  if (document.getElementById('post-feedback')) return;

  function getServerURL() {
    var element = document.getElementById('stellar-runtime-config');
    if (!element) return null;
    try {
      var config = JSON.parse(element.textContent);
      var comments = (config.extensions || []).find(function (item) {
        return item.id === 'comments';
      });
      return comments && comments.config && comments.config.options
        ? comments.config.options.serverURL
        : null;
    } catch (error) {
      return null;
    }
  }

  function getVisitorId() {
    var key = 'stellar-visitor-id';
    try {
      var value = window.localStorage.getItem(key);
      if (value) return value;
      value =
        window.crypto && typeof window.crypto.randomUUID === 'function'
          ? window.crypto.randomUUID()
          : 'v-' + Date.now() + '-' + Math.random().toString(36).slice(2);
      window.localStorage.setItem(key, value);
      return value;
    } catch (error) {
      return '';
    }
  }

  var serverURL = getServerURL();
  if (!serverURL) return;

  var path = decodeURIComponent(window.location.pathname);
  if (path.charAt(path.length - 1) !== '/') path += '/';

  var storageKey = 'stellar-post-feedback:' + path;
  var voted = null;
  try {
    voted = window.localStorage.getItem(storageKey) === 'helpful';
  } catch (error) {
    voted = false;
  }

  var visitorId = getVisitorId();

  var card = document.createElement('section');
  card.id = 'post-feedback';
  card.className = 'post-feedback';
  card.setAttribute('aria-labelledby', 'post-feedback-title');
  card.innerHTML =
    '<div class="post-feedback__text">' +
      '<strong id="post-feedback-title">这篇文章有帮助吗？</strong>' +
      '<span>如果对你有帮助，点个「有用」支持一下</span>' +
    '</div>' +
    '<div class="post-feedback__body">' +
      '<div class="post-feedback__actions">' +
        '<button type="button" class="feedback-button" data-vote="helpful" aria-pressed="false">👍 有用</button>' +
      '</div>' +
      '<p class="post-feedback__status" aria-live="polite"></p>' +
    '</div>';

  var comments = document.getElementById('comments');
  if (comments && comments.parentNode) {
    comments.parentNode.insertBefore(card, comments);
  } else {
    var main = document.getElementById('main');
    if (!main) return;
    main.appendChild(card);
  }

  var fab = document.createElement('div');
  fab.id = 'post-helpful-fab';
  fab.className = 'post-helpful-fab';
  fab.innerHTML =
    '<button type="button" class="post-helpful-fab__button" aria-label="标记这篇文章有用" aria-pressed="false">' +
      '<span class="post-helpful-fab__icon" aria-hidden="true">👍</span>' +
      '<span class="post-helpful-fab__label">有用</span>' +
      '<span class="post-helpful-fab__count" hidden></span>' +
    '</button>';
  document.body.appendChild(fab);

  var button = card.querySelector('.feedback-button');
  var status = card.querySelector('.post-feedback__status');
  var fabButton = fab.querySelector('.post-helpful-fab__button');
  var fabLabel = fab.querySelector('.post-helpful-fab__label');
  var fabCount = fab.querySelector('.post-helpful-fab__count');
  var currentCount = 0;

  function setStatus(message) {
    status.textContent = message;
  }

  function setCount(count) {
    currentCount = Number(count) || 0;
    if (!fabCount) return;
    fabCount.textContent = currentCount > 0 ? currentCount.toLocaleString('zh-CN') : '';
    fabCount.hidden = currentCount <= 0;
  }

  function markVoted(count) {
    if (Number.isFinite(count)) setCount(count);
    button.setAttribute('aria-pressed', 'true');
    button.disabled = true;
    fabButton.setAttribute('aria-pressed', 'true');
    fabButton.disabled = true;
    fabButton.classList.add('is-voted');
    fabLabel.textContent = '已有用';
    setStatus(
      '你已反馈：有帮助' +
      (currentCount > 0
        ? ' · 已有 ' + currentCount + ' 人觉得有用'
        : '')
    );
  }

  function setBusy(busy) {
    button.disabled = busy || voted;
    fabButton.disabled = busy || voted;
  }

  function loadCount() {
    fetch(
      serverURL +
        '/api/article?path=' +
        encodeURIComponent(path) +
        '&type=helpful',
      { credentials: 'omit', headers: { Accept: 'application/json' } }
    )
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function (json) {
        if (!json || json.errno) return;
        var data = Array.isArray(json.data) ? json.data[0] : json.data;
        var count = Number(data && data.helpful) || 0;
        setCount(count);
        if (voted) {
          markVoted(count);
        } else {
          setStatus(count > 0 ? '已有 ' + count + ' 人觉得有用' : '');
        }
      })
      .catch(function () {});
  }

  function recordVote() {
    if (voted) {
      markVoted(currentCount);
      return;
    }

    setBusy(true);
    setStatus('提交中…');

    fetch(serverURL + '/api/helpful', {
      method: 'POST',
      credentials: 'omit',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ path: path, visitorId: visitorId })
    })
      .then(function (response) {
        if (response.status === 404 || response.status === 405) {
          // Older deployed function fallback: still keep the count working.
          return fetch(serverURL + '/api/article', {
            method: 'POST',
            credentials: 'omit',
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              path: path,
              type: 'helpful',
              action: 'inc'
            })
          });
        }
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response;
      })
      .then(function (response) {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
      })
      .then(function (json) {
        if (!json || json.errno) throw new Error('Waline error');
        var data = json.data;
        var count =
          data && typeof data === 'object'
            ? Number(data.helpful)
            : Array.isArray(data)
              ? Number(data[0] && data[0].helpful)
              : Number(data);
        voted = true;
        try {
          window.localStorage.setItem(storageKey, 'helpful');
        } catch (error) {
          void error;
        }
        markVoted(count);
      })
      .catch(function () {
        setBusy(false);
        setStatus('提交失败，请稍后再试');
      });
  }

  button.addEventListener('click', recordVote);
  fabButton.addEventListener('click', recordVote);

  if (voted) {
    markVoted();
  }
  loadCount();

  // 滚到文章底部的完整卡片时隐藏悬浮按钮，避免重复出现。
  function updateFabVisibility() {
    var rect = card.getBoundingClientRect();
    var visible = rect.bottom > 0 && rect.top < window.innerHeight;
    fab.classList.toggle('is-hidden', visible);
    fabButton.tabIndex = visible ? -1 : 0;
    fab.setAttribute('aria-hidden', visible ? 'true' : 'false');
  }

  var scrollTimer = null;
  window.addEventListener(
    'scroll',
    function () {
      if (scrollTimer) return;
      scrollTimer = window.setTimeout(function () {
        scrollTimer = null;
        updateFabVisibility();
      }, 50);
    },
    { passive: true }
  );
  window.addEventListener('resize', updateFabVisibility, { passive: true });
  updateFabVisibility();
})();
