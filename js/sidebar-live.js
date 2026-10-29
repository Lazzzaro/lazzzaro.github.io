/*!
 * 首页侧栏实时刷新。
 *
 * 服务端在构建时已经渲染了「近期热门」和「最新阅读」；本脚本在首页加载、
 * 从文章页返回（pageshow / visibilitychange / focus）时重新拉取：
 *   - /api/popular-30d：近 30 天 Top 10（未满 30 天时接口返回累计 Top 10）
 *   - /api/recent-views：按最后阅读时间倒序的最新阅读
 * 接口失败时保留服务端渲染的兜底列表。
 */
(function () {
  'use strict';

  var SERVER_URL =
    'https://waline-blog-d3gbzr2yad290351c-1304475470.ap-shanghai.app.tcloudbase.com/waline';
  var recentList = null;
  var popularList = null;
  var popularLabel = null;
  var inFlight = false;
  var lastFetch = 0;

  function formatTime(value) {
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    var formatter = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    var parts = formatter.formatToParts(date).reduce(function (result, part) {
      result[part.type] = part.value;
      return result;
    }, {});

    return parts.month + '-' + parts.day + ' ' + parts.hour + ':' + parts.minute;
  }

  function renderRecent(items) {
    if (!recentList || !Array.isArray(items) || !items.length) return;

    var fragment = document.createDocumentFragment();
    items.forEach(function (item, index) {
      if (!item || !item.url) return;

      var li = document.createElement('li');
      li.className = 'recent-panel__item';

      var link = document.createElement('a');
      link.href = item.url;

      var rank = document.createElement('span');
      rank.className = 'recent-panel__rank';
      rank.textContent = String(index + 1).padStart(2, '0');

      var title = document.createElement('span');
      title.className = 'recent-panel__title';
      title.textContent = item.title || item.url;

      var time = document.createElement('span');
      time.className = 'recent-panel__time';
      time.textContent = formatTime(item.updatedAt);

      link.appendChild(rank);
      link.appendChild(title);
      link.appendChild(time);
      li.appendChild(link);
      fragment.appendChild(li);
    });

    if (fragment.childNodes.length) {
      recentList.replaceChildren(fragment);
    }
  }

  function renderPopular(data) {
    if (
      !popularList ||
      !data ||
      !Array.isArray(data.items) ||
      !data.items.length
    ) {
      return;
    }

    var fragment = document.createDocumentFragment();
    data.items.forEach(function (item, index) {
      if (!item || !item.url) return;

      var li = document.createElement('li');
      li.className = 'popular-panel__item';

      var link = document.createElement('a');
      link.href = item.url;

      var rank = document.createElement('span');
      rank.className = 'popular-panel__rank';
      rank.textContent = String(index + 1).padStart(2, '0');

      var title = document.createElement('span');
      title.className = 'popular-panel__title';
      title.textContent = item.title || item.url;

      var views = document.createElement('span');
      views.className = 'popular-panel__views';
      views.textContent = Number(item.views || 0).toLocaleString('zh-CN');

      link.appendChild(rank);
      link.appendChild(title);
      link.appendChild(views);
      li.appendChild(link);
      fragment.appendChild(li);
    });

    if (!fragment.childNodes.length) return;
    popularList.replaceChildren(fragment);

    if (popularLabel) {
      if (data.basis === '30d') {
        var days = Number(data.days) || 30;
        popularLabel.textContent = '近' + days + '天';
        popularLabel.title = '近' + days + '天阅读量';
      } else {
        popularLabel.textContent = 'Top 10';
        popularLabel.title = '近30天数据积累中，当前为累计阅读量 Top 10';
      }
    }
  }

  function fetchJson(endpoint) {
    return fetch(SERVER_URL + endpoint, {
      cache: 'no-store',
      credentials: 'omit',
      headers: { Accept: 'application/json' }
    }).then(function (response) {
      if (!response.ok) throw new Error('Waline HTTP ' + response.status);
      return response.json();
    }).then(function (json) {
      if (!json || json.errno) throw new Error('Waline error');
      return json.data || {};
    });
  }

  function refresh(force) {
    if (document.hidden || inFlight) return;

    var now = Date.now();
    if (!force && now - lastFetch < 3000) return;
    lastFetch = now;
    inFlight = true;

    Promise.allSettled([
      fetchJson('/api/recent-views?limit=10&t=' + now).then(function (data) {
        if (data && data.items) renderRecent(data.items);
      }),
      fetchJson('/api/popular-30d?days=30&limit=10&t=' + now).then(function (data) {
        if (data) renderPopular(data);
      })
    ]).finally(function () {
      inFlight = false;
    });
  }

  function start() {
    recentList = document.querySelector('.recent-panel__list');
    popularList = document.querySelector('.popular-panel__list');
    popularLabel = document.querySelector('.popular-panel__head span');
    if (!recentList && !popularList) return;

    refresh(true);
    window.addEventListener('pageshow', function () {
      refresh(true);
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
