/*!
 * /stats/ 页面的实时点赞总数。
 * 构建时的快照可能落后；这里直接读取 Counter.helpful 的总和。
 */
(function () {
  'use strict';

  var SERVER_URL =
    'https://waline-blog-d3gbzr2yad290351c-1304475470.ap-shanghai.app.tcloudbase.com/waline';
  var likeValue = null;
  var inFlight = false;
  var lastFetch = 0;

  function findCards() {
    var grid = document.querySelector('.site-stats-grid');
    if (!grid) return false;

    Array.prototype.forEach.call(
      grid.querySelectorAll('.site-stats-card'),
      function (card) {
        var label = card.querySelector('span');
        if (label && label.textContent.trim() === '点赞') {
          likeValue = card.querySelector('strong');
        }
      }
    );

    return !!likeValue;
  }

  function refresh(force) {
    if (!likeValue || document.hidden || inFlight) return;

    var now = Date.now();
    if (!force && now - lastFetch < 3000) return;
    lastFetch = now;
    inFlight = true;

    fetch(SERVER_URL + '/api/site-stats?t=' + now, {
      cache: 'no-store',
      credentials: 'omit',
      headers: { Accept: 'application/json' }
    })
      .then(function (response) {
        if (!response.ok) throw new Error('Waline HTTP ' + response.status);
        return response.json();
      })
      .then(function (json) {
        if (!json || json.errno || !json.data) throw new Error('Waline error');
        var total = Number(json.data.totalHelpful);
        if (Number.isFinite(total)) {
          likeValue.textContent = total.toLocaleString('zh-CN');
        }
      })
      .catch(function () {
        // 保留占位符，避免显示构建时的旧值。
      })
      .finally(function () {
        inFlight = false;
      });
  }

  function start() {
    if (!findCards()) return;

    // 先隐藏旧快照，等实时数据回来再显示。
    likeValue.textContent = '—';
    refresh(true);

    window.addEventListener('pageshow', function (event) {
      refresh(!!event.persisted);
    });
    window.addEventListener('focus', function () {
      refresh(false);
    });
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) refresh(false);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
