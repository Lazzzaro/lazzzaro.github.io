/*!
 * Self-hosted site visit counter for the footer.
 * One POST per page load: increments PV and dedupes UV by visitor id.
 */
(function () {
  'use strict';

  var SERVER_URL =
    'https://waline-blog-d3gbzr2yad290351c-1304475470.ap-shanghai.app.tcloudbase.com/waline';
  var pvElement = document.getElementById('site-pv');
  var uvElement = document.getElementById('site-uv');
  if (!pvElement || !uvElement) return;

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

  function format(value) {
    return Number(value || 0).toLocaleString('zh-CN');
  }

  fetch(SERVER_URL + '/api/site-visit', {
    method: 'POST',
    cache: 'no-store',
    credentials: 'omit',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ visitorId: getVisitorId() })
  })
    .then(function (response) {
      if (!response.ok) throw new Error('Waline HTTP ' + response.status);
      return response.json();
    })
    .then(function (json) {
      if (!json || json.errno || !json.data) throw new Error('Waline error');
      pvElement.textContent = format(json.data.pv);
      uvElement.textContent = format(json.data.uv);
    })
    .catch(function () {
      // 计数服务不可用时保留占位符。
    });
})();
