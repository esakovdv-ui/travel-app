/**
 * Подключается на странице-родителе (online.mosgortur.ru), где лендинг в iframe motrip.ru/raduga.
 * Прокидывает ?shift= и UTM в src iframe и отвечает на postMessage из raduga.html.
 *
 * <script src="https://motrip.ru/raduga-parent-bridge.js" defer></script>
 */
(function () {
  var MOTRIP_ORIGIN = 'https://motrip.ru';
  var IFRAME_SELECTOR = 'iframe.raduga-page__frame, iframe[src*="motrip.ru/raduga"]';
  var PASSTHROUGH_KEYS = [
    'shift',
    'shift_id',
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_content',
    'utm_term',
    'clckid',
  ];

  function parentParams() {
    return new URLSearchParams(window.location.search);
  }

  function getShiftId() {
    var params = parentParams();
    return params.get('shift') || params.get('shift_id');
  }

  function buildMotripRadugaUrl() {
    var url = new URL(MOTRIP_ORIGIN + '/raduga');
    var params = parentParams();
    PASSTHROUGH_KEYS.forEach(function (key) {
      var value = params.get(key);
      if (value) url.searchParams.set(key, value);
    });
    return url.toString();
  }

  function patchIframe() {
    var iframe = document.querySelector(IFRAME_SELECTOR);
    if (!iframe) return false;

    var shift = getShiftId();
    if (shift) iframe.name = 'shift:' + shift;
    else iframe.removeAttribute('name');

    var nextSrc = buildMotripRadugaUrl();
    if (iframe.src !== nextSrc) iframe.src = nextSrc;
    return true;
  }

  function onMessage(event) {
    if (!event.data || event.data.type !== 'raduga-request-shift') return;
    if (event.origin !== MOTRIP_ORIGIN) return;

    patchIframe();

    var shift = getShiftId();
    if (shift && event.source) {
      event.source.postMessage({ type: 'raduga-set-shift', shift: shift }, event.origin);
    }
  }

  window.addEventListener('message', onMessage);
  window.addEventListener('popstate', patchIframe);
  window.addEventListener('hashchange', patchIframe);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', patchIframe);
  } else {
    patchIframe();
  }

  var observer = new MutationObserver(patchIframe);
  observer.observe(document.documentElement, { childList: true, subtree: true });
})();
