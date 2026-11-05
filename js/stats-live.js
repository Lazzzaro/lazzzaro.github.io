/*!
 * /stats/ 页面的实时数据：
 *   - 总阅读量、评论数、点赞总数
 *   - 最近评论列表
 *
 * 构建时的快照可能落后；页面先显示 —，再填入实时值。
 */
(function () {
  'use strict';

  var SERVER_URL =
    'https://waline-blog-d3gbzr2yad290351c-1304475470.ap-shanghai.app.tcloudbase.com/waline';
  var likeValue = null;
  var commentValue = null;
  var viewValue = null;
  var commentsList = null;
  var updatedElement = null;
  var inFlight = false;
  var lastFetch = 0;

  function findElements() {
    var grid = document.querySelector('.site-stats-grid');
    if (!grid) return false;

    Array.prototype.forEach.call(
      grid.querySelectorAll('.site-stats-card'),
      function (card) {
        var label = card.querySelector('span');
        if (!label) return;
        var text = label.textContent.trim();
        var value = card.querySelector('strong');
        if (text === '点赞') likeValue = value;
        if (text === '评论') commentValue = value;
        if (text === '总阅读量') viewValue = value;
      }
    );

    commentsList = document.querySelector('.site-stats__comments');
    updatedElement = document.querySelector('.site-stats__updated');
    return !!(likeValue || commentValue || viewValue || commentsList);
  }

  function setDash(element) {
    if (element) element.textContent = '—';
  }

  function formatCount(value) {
    var number = Number(value);
    if (!Number.isFinite(number)) return null;
    return number.toLocaleString('zh-CN');
  }

  function formatNow() {
    var formatter = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    var parts = formatter.formatToParts(new Date()).reduce(function (result, part) {
      result[part.type] = part.value;
      return result;
    }, {});
    return (
      parts.year + '/' + parts.month + '/' + parts.day + ' ' +
      parts.hour + ':' + parts.minute
    );
  }

  function normalizePath(value) {
    var path = String(value || '/');
    try {
      path = decodeURIComponent(path);
    } catch (error) {
      void error;
    }
    if (path.charAt(0) !== '/') path = '/' + path;
    if (path.charAt(path.length - 1) !== '/') path += '/';
    return path;
  }

  function cleanText(value) {
    return String(value || '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120);
  }

  function formatDate(value) {
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('zh-CN');
  }

  function renderComments(items) {
    if (!commentsList || !Array.isArray(items)) return;

    var fragment = document.createDocumentFragment();
    items.forEach(function (item) {
      if (!item) return;

      var li = document.createElement('li');
      var link = document.createElement('a');
      link.href = normalizePath(item.url || '/');

      var nick = document.createElement('strong');
      nick.textContent = item.nick || '匿名';

      var text = document.createElement('span');
      text.textContent = cleanText(item.orig || item.comment || '');

      var time = document.createElement('time');
      time.textContent = formatDate(item.time);

      link.appendChild(nick);
      link.appendChild(text);
      link.appendChild(time);
      li.appendChild(link);
      fragment.appendChild(li);
    });

    if (fragment.childNodes.length) {
      commentsList.replaceChildren(fragment);
    } else {
      commentsList.innerHTML =
        '<li class="site-stats__empty">暂无评论</li>';
    }
  }

  function fetchJson(endpoint) {
    return fetch(SERVER_URL + endpoint, {
      cache: 'no-store',
      credentials: 'omit',
      headers: { Accept: 'application/json' }
    })
      .then(function (response) {
        if (!response.ok) throw new Error('Waline HTTP ' + response.status);
        return response.json();
      })
      .then(function (json) {
        if (!json || json.errno) throw new Error('Waline error');
        return json.data;
      });
  }

  function refresh(force) {
    if (document.hidden || inFlight) return;

    var now = Date.now();
    if (!force && now - lastFetch < 3000) return;
    lastFetch = now;
    inFlight = true;

    Promise.allSettled([
      fetchJson('/api/site-stats?t=' + now).then(function (data) {
        var views = formatCount(data && data.totalViews);
        var helpful = formatCount(data && data.totalHelpful);
        if (views !== null && viewValue) viewValue.textContent = views;
        if (helpful !== null && likeValue) likeValue.textContent = helpful;
      }),
      fetchJson('/api/comment?type=count&t=' + now).then(function (data) {
        var count = formatCount(data);
        if (count !== null && commentValue) commentValue.textContent = count;
      }),
      fetchJson('/api/comment?type=recent&count=5&t=' + now).then(function (data) {
        renderComments(data);
      })
    ])
      .then(function (results) {
        var anySuccess = results.some(function (result) {
          return result.status === 'fulfilled';
        });
        if (anySuccess && updatedElement) {
          updatedElement.textContent = '数据更新于 ' + formatNow();
        }
      })
      .finally(function () {
        inFlight = false;
      });
  }

  function start() {
    if (!findElements()) return;

    // 避免先显示构建时的旧快照。
    setDash(likeValue);
    setDash(commentValue);
    setDash(viewValue);
    if (updatedElement) updatedElement.textContent = '数据更新于 —';
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
