/*!
 * 留言板：滚动到最下方时自动加载更早的留言，
 * 免去手动点击 Waline 的“加载更多”。
 */
(function () {
  'use strict';

  if (!/^\/guestbook\/?$/i.test(location.pathname)) return;

  var SCOPE = /加载更多|載入更多|Load more|もっと見る/i;
  var COOLDOWN = 800;
  var loading = false;
  var timer = null;
  var observer = null;
  var observed = null;

  function getContainer() {
    return document.getElementById('waline_container');
  }

  function isLoadMore(button) {
    return SCOPE.test((button.textContent || '').trim());
  }

  function nearBottom(button) {
    var rect = button.getBoundingClientRect();
    var viewport = window.innerHeight || document.documentElement.clientHeight;
    return rect.top < viewport + 240;
  }

  function check() {
    if (loading) return;

    var container = getContainer();
    if (!container) return;

    var buttons = container.querySelectorAll('.wl-operation .wl-btn');
    for (var i = 0; i < buttons.length; i++) {
      var button = buttons[i];
      if (!isLoadMore(button)) continue;
      if (button.disabled || !nearBottom(button)) continue;

      loading = true;
      button.click();
      window.setTimeout(function () {
        loading = false;
        schedule();
      }, COOLDOWN);
      return;
    }
  }

  function schedule() {
    if (timer) return;
    timer = window.setTimeout(function () {
      timer = null;
      check();
    }, 100);
  }

  function watch(container) {
    if (!('MutationObserver' in window)) return;
    if (observed === container) return;
    if (observer) observer.disconnect();
    observed = container;
    observer = new MutationObserver(schedule);
    observer.observe(container, { childList: true, subtree: true });
  }

  function start() {
    var container = getContainer();

    if (!container) {
      // 容器由评论扩展延迟注入时，等它出现后再接管。
      if ('MutationObserver' in window) {
        var waiting = new MutationObserver(function () {
          var found = getContainer();
          if (!found) return;
          waiting.disconnect();
          watch(found);
          check();
        });
        waiting.observe(document.body, { childList: true, subtree: true });
      }
      return;
    }

    watch(container);
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule, { passive: true });
    window.addEventListener('pageshow', schedule);
    check();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
