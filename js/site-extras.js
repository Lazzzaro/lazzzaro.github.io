/*!
 * 站点附加脚本：LeanCloud 阅读量 + Valine 评论
 * 数据沿用原 Pure 主题的 LeanCloud 应用与 Counter/Comment 表，
 * 文章 URL（permalink）未变，因此历史阅读量与评论可直接续用。
 */
(function () {
  'use strict';

  var APP_ID = 'sK4BUsDgfSB843HYgJyTcV7P-gzGzoHsz';
  var APP_KEY = 'NKNx8m2CtFeDofr8LNLX7aNG';
  var LC_HOST = 'https://sk4busdg.lc-cn-n1-shared.com/1.1';
  var LC_HEADERS = {
    'X-LC-Id': APP_ID,
    'X-LC-Key': APP_KEY,
    'Content-Type': 'application/json'
  };
  var COUNT_SITE = 'lazzzaro.github.io';

  function noop() {}

  function normPath(input) {
    var path = input || '/';
    try {
      if (/^https?:/i.test(path)) path = new URL(path).pathname;
    } catch (e) {}
    path = path.replace(/index\.html?$/i, '');
    if (path.charAt(0) !== '/') path = '/' + path;
    if (path.charAt(path.length - 1) !== '/') path += '/';
    return path;
  }

  function lcFetch(path, options) {
    options = options || {};
    options.headers = Object.assign({}, LC_HEADERS, options.headers || {});
    options.credentials = 'omit';
    return fetch(LC_HOST + path, options).then(function (res) {
      if (!res.ok) throw new Error('LeanCloud HTTP ' + res.status);
      return res.json();
    });
  }

  function fetchOne(path) {
    var where = encodeURIComponent(JSON.stringify({ url: path }));
    return lcFetch('/classes/Counter?limit=1&where=' + where).then(function (data) {
      return (data.results && data.results[0]) || null;
    });
  }

  function fetchAll() {
    return lcFetch('/classes/Counter?limit=1000&keys=url,time').then(function (data) {
      var map = {};
      (data.results || []).forEach(function (item) {
        if (item.url) map[normPath(item.url)] = item;
      });
      return map;
    });
  }

  function bump(path, record) {
    if (location.hostname !== COUNT_SITE) return Promise.resolve(record ? record.time : null);
    if (record && record.objectId) {
      return lcFetch('/classes/Counter/' + record.objectId, {
        method: 'PUT',
        body: JSON.stringify({ time: { __op: 'Increment', amount: 1 } })
      }).then(function (data) {
        return typeof data.time === 'number' ? data.time : record.time + 1;
      });
    }
    return lcFetch('/classes/Counter', {
      method: 'POST',
      body: JSON.stringify({ url: path, xid: path, title: document.title, time: 1 })
    }).then(function (data) {
      return typeof data.time === 'number' ? data.time : 1;
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

  function addCardViews(map) {
    var cards = document.querySelectorAll('a.post-card');
    Array.prototype.forEach.call(cards, function (card) {
      var key;
      try {
        key = normPath(new URL(card.href, location.origin).pathname);
      } catch (e) {
        return;
      }
      var record = map[key];
      if (!record) return;
      var meta = card.querySelector('.meta');
      if (!meta || meta.querySelector('.post-views')) return;
      var el = document.createElement('span');
      el.className = 'cap post-views';
      el.textContent = format(record.time) + ' 阅读';
      meta.appendChild(el);
    });
  }

  function initViews() {
    var isContent = document.body.getAttribute('data-page-layout') === 'post';
    if (isContent) {
      var key = normPath(location.pathname);
      fetchOne(key)
        .then(function (record) {
          if (record) addArticleViews(record.time);
          return bump(key, record);
        })
        .then(function (n) {
          if (n != null) addArticleViews(n);
        })
        .catch(noop);
    } else if (document.querySelector('a.post-card')) {
      fetchAll().then(addCardViews).catch(noop);
    }
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function ensureCommentHost() {
    if (document.getElementById('vcomments')) return true;
    if (document.body.getAttribute('data-page-layout') !== 'post') return false;
    var anchor = document.querySelector('.page-footer');
    if (!anchor) return false;
    var section = document.createElement('section');
    section.className = 'post-comments';
    section.id = 'comments';
    section.innerHTML = '<h2 class="comments-title">评论</h2><div id="vcomments"></div>';
    anchor.parentNode.insertBefore(section, anchor);
    return true;
  }

  function initComments() {
    if (window.__stellarValine) return;
    if (!ensureCommentHost()) return;
    window.__stellarValine = true;
    loadScript('https://cdn.jsdelivr.net/npm/leancloud-storage@3.0.4/dist/av-min.js')
      .then(function () {
        // 提前初始化 AV，让 Valine 复用该实例（否则 Valine 会删除未初始化的 AV
        // 并从 elemecdn 重新加载，最终连到已失效的 api.lncld.net）
        if (window.AV && typeof window.AV.init === 'function') {
          window.AV.init({ appId: APP_ID, appKey: APP_KEY });
          if (typeof window.AV.setServerURLs === 'function') {
            window.AV.setServerURLs({ api: 'https://sk4busdg.lc-cn-n1-shared.com' });
          }
        }
        return loadScript('https://cdn.jsdelivr.net/npm/valine');
      })
      .then(function () {
        if (typeof window.Valine !== 'function') return;
        new window.Valine({
          el: '#vcomments',
          appId: APP_ID,
          appKey: APP_KEY,
          serverURLs: 'https://sk4busdg.lc-cn-n1-shared.com',
          path: normPath(location.pathname),
          placeholder: '来来来说点啥~~\n对你有用？赏一波！↘↘',
          avatar: 'mp',
          meta: ['nick', 'mail', 'link'],
          pageSize: 10,
          visitor: false
        });
      })
      .catch(noop);
  }

  function start() {
    initViews();
    initComments();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
