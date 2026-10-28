/*!
 * match 文章目录：任意层级都按折叠组处理。
 * 只对带有 data-match-toc="true" 的文章页生效，由 scripts/match-toc-inject.js 注入。
 */
(function () {
  'use strict';

  var body = document.body;
  if (!body || body.getAttribute('data-match-toc') !== 'true') return;

  function directLink(li) {
    for (var i = 0; i < li.children.length; i++) {
      var child = li.children[i];
      if (child.tagName === 'A' && child.classList.contains('toc-link')) return child;
    }
    return null;
  }

  function directChildList(li) {
    for (var i = 0; i < li.children.length; i++) {
      var child = li.children[i];
      if (child.tagName === 'OL' && child.classList.contains('toc-child')) return child;
    }
    return null;
  }

  function setOpen(li, open) {
    li.classList.toggle('is-open', open);
    var link = directLink(li);
    if (link) link.setAttribute('aria-expanded', open ? 'true' : 'false');

    if (!open) {
      // 收起父级时一并重置后代，避免下次展开时残留旧状态。
      Array.prototype.forEach.call(li.querySelectorAll('.toc-item.is-open'), function (child) {
        child.classList.remove('is-open');
        var childLink = directLink(child);
        if (childLink) childLink.setAttribute('aria-expanded', 'false');
      });
    }
  }

  function initList(list, seq) {
    var groups = [];

    Array.prototype.forEach.call(list.children, function (li) {
      if (!li.classList || !li.classList.contains('toc-item')) return;
      var child = directChildList(li);
      if (!child) return;
      groups.push({ li: li, child: child, link: directLink(li) });
    });

    groups.forEach(function (group) {
      group.li.classList.add('match-toc-group');
      if (!group.child.id) group.child.id = 'match-toc-group-' + ++seq.value;
      if (group.link) {
        group.link.setAttribute('aria-controls', group.child.id);
        group.link.setAttribute('aria-expanded', 'false');
      }
      setOpen(group.li, false);

      if (!group.link) return;
      group.link.addEventListener('click', function () {
        var open = !group.li.classList.contains('is-open');
        groups.forEach(function (other) {
          if (other !== group) setOpen(other.li, false);
        });
        setOpen(group.li, open);
      });
    });

    // 下一层级同样处理。
    groups.forEach(function (group) {
      initList(group.child, seq);
    });
  }

  function openChain(link) {
    var li = link.closest('li.toc-item');
    while (li) {
      if (li.classList.contains('match-toc-group')) setOpen(li, true);
      var parent = li.parentElement;
      li = parent ? parent.closest('li.toc-item') : null;
    }
  }

  function setup(toc) {
    var seq = { value: 0 };
    initList(toc, seq);

    // 带锚点打开页面时，展开目标题目所在的整条目录链。
    var hash = location.hash.replace(/^#/, '');
    try { hash = decodeURIComponent(hash); } catch (error) { void error; }
    if (!hash) return;

    var links = toc.querySelectorAll('a.toc-link');
    for (var i = 0; i < links.length; i++) {
      var href = links[i].getAttribute('href') || '';
      if (!href || href.charAt(0) !== '#') continue;
      var id = href.slice(1);
      try { id = decodeURIComponent(id); } catch (error) { void error; }
      if (id === hash) {
        openChain(links[i]);
        break;
      }
    }
  }

  function start() {
    var tocs = document.querySelectorAll('#data-toc .toc');
    Array.prototype.forEach.call(tocs, setup);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
