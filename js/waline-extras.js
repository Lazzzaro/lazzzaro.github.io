/*!
 * 站点附加脚本：Waline 阅读量（评论由 Stellar 的 Waline provider 渲染）
 *
 * 数据迁移后，旧的 Valine Counter 会写入 Waline 的 Counter 集合，
 * 路径保持为解码后的 permalink，例如 /2020/11/07/crypto-ECC/。
 * 首页卡片只读取计数，文章页读取后 +1（仅在生产域名）。
 */
(function () {
  'use strict';

  // 部署 CloudBase 后填入环境地址，例如：
  // var WALINE_SERVER_URL = 'https://waline-xxxx.tcloudbaseapp.com';
  var WALINE_SERVER_URL = 'https://waline-blog-d3gbzr2yad290351c-1304475470.ap-shanghai.app.tcloudbase.com/waline';
  var COUNT_HOST = 'lazzzaro.github.io';

  if (!WALINE_SERVER_URL) return;

  var SERVER_URL = WALINE_SERVER_URL.replace(/\/+$/, '');
  var CAN_INCREMENT = location.hostname === COUNT_HOST;

  function noop() {}

  function normPath(input) {
    var path = input || '/';
    try {
      if (/^https?:/i.test(path)) path = new URL(path).pathname;
    } catch (e) {}
    path = path.replace(/index\.html?$/i, '');
    // Waline/Stellar 使用 decodeURI(location.pathname) 作为评论路径。
    // 旧 Counter 的 url 也是解码后的中文路径，因此这里同样解码。
    try {
      path = decodeURI(path);
    } catch (e) {}
    if (path.charAt(0) !== '/') path = '/' + path;
    if (path.charAt(path.length - 1) !== '/') path += '/';
    return path;
  }

  function request(method, endpoint, body) {
    var options = {
      method: method,
      credentials: 'omit',
      headers: { Accept: 'application/json' }
    };
    if (body) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }
    return fetch(SERVER_URL + endpoint, options)
      .then(function (res) {
        if (!res.ok) throw new Error('Waline HTTP ' + res.status);
        return res.json();
      })
      .then(function (json) {
        if (json && json.errno) throw new Error('Waline ' + json.errno + ': ' + json.errmsg);
        return json && Object.prototype.hasOwnProperty.call(json, 'data') ? json.data : json;
      });
  }

  function countsFromData(data) {
    if (Array.isArray(data)) {
      return data.map(function (item) {
        if (item && typeof item === 'object') {
          return Number(item.time) || 0;
        }
        return Number(item) || 0;
      });
    }
    if (typeof data === 'number') return [data];
    return [];
  }

  function fetchCounts(paths) {
    if (!paths.length) return Promise.resolve([]);
    var query = paths
      .map(function (path) {
        return 'path=' + encodeURIComponent(path);
      })
      .join('&');
    return request('GET', '/api/article?' + query + '&type=time').then(countsFromData);
  }

  function fetchCardStats(paths) {
    if (!paths.length) return Promise.resolve([]);
    var query = paths
      .map(function (path) {
        return 'path=' + encodeURIComponent(path);
      })
      .join('&');
    return request('GET', '/api/article?' + query + '&type=time&type=helpful').then(
      function (data) {
        if (!Array.isArray(data)) return [];
        return data.map(function (item) {
          return {
            views: Number(item && item.time) || 0,
            helpful: Number(item && item.helpful) || 0
          };
        });
      }
    );
  }

  function increment(path) {
    if (!CAN_INCREMENT) return Promise.resolve(null);
    return request('POST', '/api/article', {
      path: path,
      type: 'time',
      action: 'inc'
    })
      .then(countsFromData)
      .then(function (counts) {
        return counts.length ? counts[0] : null;
      });
  }

  function format(n) {
    return Number(n || 0).toLocaleString('zh-CN');
  }

  function addArticleViews(n) {
    var meta = document.querySelector('.article-banner #post-meta') || document.querySelector('#post-meta');
    if (!meta) return;
    var el = meta.querySelector('.post-views');
    if (!el) {
      el = document.createElement('span');
      el.className = 'post-views';
      meta.appendChild(el);
    }
    el.textContent = format(n) + ' 阅读';
  }

  function addCardViews(cards, stats) {
    if (!cards || !cards.length) return;
    var views = Number(stats && stats.views) || 0;
    var helpful = Number(stats && stats.helpful) || 0;

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
        viewEl.textContent = format(views) + ' 阅读';
      }

      var helpfulEl = meta.querySelector('.post-helpful');
      if (helpful > 0) {
        if (!helpfulEl) {
          helpfulEl = document.createElement('span');
          helpfulEl.className = 'cap post-helpful';
          meta.appendChild(helpfulEl);
        }
        helpfulEl.textContent = '有用 ' + format(helpful);
      } else if (helpfulEl) {
        helpfulEl.remove();
      }
    });
  }

  function initCardViews() {
    var cards = document.querySelectorAll('a.post-card');
    if (!cards.length) return;

    var groups = {};
    var paths = [];
    Array.prototype.forEach.call(cards, function (card) {
      var key;
      try {
        key = normPath(new URL(card.href, location.origin).pathname);
      } catch (e) {
        return;
      }
      if (!groups[key]) {
        groups[key] = [];
        paths.push(key);
      }
      groups[key].push(card);
    });

    fetchCardStats(paths)
      .then(function (stats) {
        paths.forEach(function (key, index) {
          addCardViews(groups[key], stats[index]);
        });
      })
      .catch(noop);
  }

  function initArticleViews() {
    var path = normPath(location.pathname);
    fetchCounts([path])
      .then(function (counts) {
        addArticleViews(counts[0]);
        return increment(path);
      })
      .then(function (n) {
        if (n != null) addArticleViews(n);
      })
      .catch(noop);
  }

  function start() {
    if (document.body.getAttribute('data-page-layout') === 'post') {
      initArticleViews();
    } else {
      // 首页由 home-stats.js 统一请求卡片数据、最新阅读和近期热门。
      if (
        document.querySelector('.recent-panel__list') ||
        document.querySelector('.popular-panel__list')
      ) {
        return;
      }
      initCardViews();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
