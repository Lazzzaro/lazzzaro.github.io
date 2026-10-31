/*!
 * Homepage live stats: one /api/home-stats request for
 *   - post card views / helpful counts
 *   - "最新阅读"
 *   - "近期热门"
 *
 * Server-rendered counts and lists are the initial fallback.
 */
(function () {
  'use strict';

  var SERVER_URL =
    'https://waline-blog-d3gbzr2yad290351c-1304475470.ap-shanghai.app.tcloudbase.com/waline';
  var recentList = null;
  var popularList = null;
  var popularLabel = null;
  var titleMap = {};
  var cardGroups = {};
  var cardPaths = [];
  var inFlight = false;
  var lastFetch = 0;

  function loadTitleMap() {
    var element = document.getElementById('post-title-map');
    if (!element) return;
    try {
      titleMap = JSON.parse(element.textContent || '{}') || {};
    } catch (error) {
      titleMap = {};
    }
  }

  function displayTitle(item) {
    if (!item) return '';
    if (titleMap[item.url]) return titleMap[item.url];
    try {
      var decoded = decodeURIComponent(item.url || '');
      if (titleMap[decoded]) return titleMap[decoded];
    } catch (error) {
      void error;
    }
    return item.title || item.url || '';
  }

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

  function normPath(input) {
    var path = input || '/';
    try {
      path = new URL(path, location.origin).pathname;
    } catch (error) {
      void error;
    }
    try {
      path = decodeURIComponent(path);
    } catch (error) {
      void error;
    }
    if (path.charAt(0) !== '/') path = '/' + path;
    if (path.charAt(path.length - 1) !== '/') path += '/';
    return path;
  }

  function collectCards() {
    var cards = document.querySelectorAll('a.post-card');
    if (!cards.length) return;

    Array.prototype.forEach.call(cards, function (card) {
      var path = normPath(card.getAttribute('href'));
      if (!cardGroups[path]) {
        cardGroups[path] = [];
        cardPaths.push(path);
      }
      cardGroups[path].push(card);
    });
  }

  function formatCount(value) {
    return Number(value || 0).toLocaleString('zh-CN');
  }

  function addCardStats(cards, stats) {
    if (!cards || !stats) return;

    var views = Number(stats.time) || 0;
    var helpful = Number(stats.helpful) || 0;

    cards.forEach(function (card) {
      var meta = card.querySelector('.meta');
      if (!meta) return;

      var viewEl = meta.querySelector('.post-views');
      if (views > 0) {
        if (!viewEl) {
          viewEl = document.createElement('span');
          viewEl.className = 'cap post-views';
          meta.appendChild(viewEl);
        }
        viewEl.textContent = formatCount(views) + ' 阅读';
      } else if (viewEl) {
        viewEl.remove();
      }

      var helpfulEl = meta.querySelector('.post-helpful');
      if (helpful > 0) {
        if (!helpfulEl) {
          helpfulEl = document.createElement('span');
          helpfulEl.className = 'cap post-helpful';
          meta.appendChild(helpfulEl);
        }
        helpfulEl.textContent = '有用 ' + formatCount(helpful);
      } else if (helpfulEl) {
        helpfulEl.remove();
      }
    });
  }

  function renderCards(items) {
    if (!Array.isArray(items)) return;
    items.forEach(function (item) {
      if (!item || !item.path) return;
      addCardStats(cardGroups[item.path], item);
    });
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
      title.textContent = displayTitle(item);

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
      title.textContent = displayTitle(item);

      var views = document.createElement('span');
      views.className = 'popular-panel__views';
      views.textContent = formatCount(item.views);

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

  function refresh(force) {
    if (document.hidden || inFlight) return;

    var now = Date.now();
    if (!force && now - lastFetch < 3000) return;
    lastFetch = now;
    inFlight = true;

    var query = cardPaths
      .map(function (path) {
        return 'path=' + encodeURIComponent(path);
      })
      .join('&');
    var endpoint =
      '/api/home-stats?recent=10&popular=10&days=30&t=' +
      now +
      (query ? '&' + query : '');

    fetch(SERVER_URL + endpoint, {
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
        renderCards(json.data.cards);
        renderRecent(json.data.recent);
        renderPopular(json.data.popular);
      })
      .catch(function () {
        // Keep the server-rendered fallback.
      })
      .finally(function () {
        inFlight = false;
      });
  }

  function start() {
    recentList = document.querySelector('.recent-panel__list');
    popularList = document.querySelector('.popular-panel__list');
    popularLabel = document.querySelector('.popular-panel__head span');
    if (!recentList && !popularList) return;

    loadTitleMap();
    collectCards();
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
