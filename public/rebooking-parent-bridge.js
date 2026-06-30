/**
 * Страница-родитель online.mosgortur.ru/new/rebooking: iframe с motrip.ru/rebooking
 * и прокидывание query (order, cert, name, …) в src.
 *
 * <script src="https://motrip.ru/rebooking-parent-bridge.js" defer></script>
 * <iframe class="rebooking-page__frame" title="Перебронирование"></iframe>
 */
(function () {
  var MOTRIP_ORIGIN = 'https://motrip.ru';
  var IFRAME_SELECTOR =
    'iframe.rebooking-page__frame, iframe[src*="motrip.ru/rebooking"]';

  var PASSTHROUGH_KEYS = [
    'order',
    'cert',
    'name',
    'people',
    'kids',
    'kid1',
    'kid2',
    'kid3',
    'price',
    'nights',
    'date',
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_content',
    'utm_term',
  ];

  function parentParams() {
    return new URLSearchParams(window.location.search);
  }

  function buildMotripRebookingUrl() {
    var url = new URL(MOTRIP_ORIGIN + '/rebooking');
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
    var nextSrc = buildMotripRebookingUrl();
    if (iframe.src !== nextSrc) iframe.src = nextSrc;
    return true;
  }

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
