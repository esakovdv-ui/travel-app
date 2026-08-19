/**
 * Подключается на странице-родителе (online.mosgortur.ru).
 * 1. Прокидывает ?shift= и UTM в src iframe motrip.ru/raduga.
 * 2. Слушает staff-resize от staff.motrip.ru и растягивает iframe портала сотрудников.
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

  var STAFF_ORIGIN = 'https://staff.motrip.ru';
  var STAFF_IFRAME_SELECTOR = 'iframe.for-staff-page__frame, iframe[src*="staff.motrip.ru"]';

  function onMessage(event) {
    // Raduga: shift handshake
    if (event.data && event.data.type === 'raduga-request-shift' && event.origin === MOTRIP_ORIGIN) {
      patchIframe();
      var shift = getShiftId();
      if (shift && event.source) {
        event.source.postMessage({ type: 'raduga-set-shift', shift: shift }, event.origin);
      }
      return;
    }

    // Staff portal: resize iframe to fit content height
    if (event.data && event.data.type === 'staff-resize' && event.origin === STAFF_ORIGIN) {
      var staffFrame = document.querySelector(STAFF_IFRAME_SELECTOR);
      if (staffFrame && event.data.height > 0) {
        staffFrame.style.height = event.data.height + 'px';
        staffFrame.style.minHeight = event.data.height + 'px';
      }
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
