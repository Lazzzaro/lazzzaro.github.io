/**
 * Donation entry for article, homepage and guestbook pages.
 *
 * A visible in-page banner replaces the previous small floating button. It
 * opens an accessible modal with WeChat and Alipay QR codes.
 */
(function () {
  'use strict';

  if (document.getElementById('donate-overlay')) return;

  var methods = {
    wechat: {
      label: '微信支付',
      src: '/images/donate/wechatpayimg.png',
      tip: '打开微信扫一扫，识别二维码赞赏'
    },
    alipay: {
      label: '支付宝',
      src: '/images/donate/alipayimg.png',
      tip: '打开支付宝扫一扫，识别二维码赞赏'
    }
  };

  var currentMethod = 'wechat';
  var closeTimer = null;
  var lastFocus = null;

  var banner = document.createElement('div');
  banner.className = 'donate-banner';
  banner.setAttribute('role', 'note');
  banner.innerHTML =
    '<span class="donate-banner__icon" aria-hidden="true">☕</span>' +
    '<div class="donate-banner__copy">' +
      '<strong>如果内容对你有帮助</strong>' +
      '<span>欢迎赞赏支持，感谢鼓励</span>' +
    '</div>' +
    '<button type="button" class="donate-banner__button" aria-haspopup="dialog" aria-controls="donate-dialog">' +
      '<span aria-hidden="true">♥</span> 赞赏' +
    '</button>';

  var overlay = document.createElement('div');
  overlay.id = 'donate-overlay';
  overlay.className = 'donate-overlay';
  overlay.hidden = true;
  overlay.innerHTML =
    '<div class="donate-dialog" id="donate-dialog" role="dialog" aria-modal="true" aria-labelledby="donate-title">' +
      '<button type="button" class="donate-close" aria-label="关闭赞赏窗口">×</button>' +
      '<h2 id="donate-title">赞赏支持</h2>' +
      '<p class="donate-subtitle">如果内容对你有帮助，欢迎请我喝杯咖啡 ☕</p>' +
      '<div class="donate-tabs" role="tablist" aria-label="选择赞赏方式">' +
        '<button type="button" class="donate-tab" role="tab" data-method="wechat">微信支付</button>' +
        '<button type="button" class="donate-tab" role="tab" data-method="alipay">支付宝</button>' +
      '</div>' +
      '<div class="donate-qr-wrap">' +
        '<img class="donate-qr" alt="微信支付赞赏二维码" width="370" height="370">' +
      '</div>' +
      '<p class="donate-tip"></p>' +
    '</div>';

  var dialog = overlay.querySelector('.donate-dialog');
  var closeButton = overlay.querySelector('.donate-close');
  var qrImage = overlay.querySelector('.donate-qr');
  var tip = overlay.querySelector('.donate-tip');
  var tabs = Array.prototype.slice.call(overlay.querySelectorAll('.donate-tab'));
  var bannerButton = banner.querySelector('.donate-banner__button');

  function setMethod(method) {
    var item = methods[method] || methods.wechat;
    currentMethod = methods[method] ? method : 'wechat';

    tabs.forEach(function (tab) {
      tab.setAttribute(
        'aria-selected',
        tab.getAttribute('data-method') === currentMethod ? 'true' : 'false'
      );
    });

    qrImage.src = item.src;
    qrImage.alt = item.label + '赞赏二维码';
    tip.textContent = item.tip;
  }

  function openDialog() {
    window.clearTimeout(closeTimer);
    lastFocus = document.activeElement;
    overlay.hidden = false;
    document.body.classList.add('donate-modal-open');

    window.requestAnimationFrame(function () {
      overlay.classList.add('is-open');
      closeButton.focus();
    });
  }

  function closeDialog() {
    overlay.classList.remove('is-open');
    document.body.classList.remove('donate-modal-open');

    closeTimer = window.setTimeout(function () {
      overlay.hidden = true;
      if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
    }, 180);
  }

  document.body.appendChild(banner);
  document.body.appendChild(overlay);
  document.body.classList.add('donate-banner-active');

  bannerButton.addEventListener('click', openDialog);
  closeButton.addEventListener('click', closeDialog);

  overlay.addEventListener('click', function (event) {
    if (event.target === overlay) closeDialog();
  });

  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      setMethod(tab.getAttribute('data-method'));
    });
  });

  document.addEventListener('keydown', function (event) {
    if (overlay.hidden) return;

    if (event.key === 'Escape') {
      closeDialog();
      return;
    }

    if (event.key !== 'Tab') return;

    var focusable = Array.prototype.slice.call(
      dialog.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    );
    if (!focusable.length) return;

    var first = focusable[0];
    var last = focusable[focusable.length - 1];

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  setMethod(currentMethod);
})();
