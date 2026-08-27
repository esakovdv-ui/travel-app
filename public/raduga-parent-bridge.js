/**
 * Подключается на странице-родителе (online.mosgortur.ru).
 *
 * 1) /raduga — прокидывает ?shift= и UTM в src iframe, отвечает на postMessage.
 * 2) /forstaff — прячет плавающие кнопки чата Bitrix24 и Novofon/Comagic:
 *    они рисуются поверх iframe staff.motrip.ru и перекрывают «Выбрать».
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
  var FORSTAFF_WIDGET_STYLE_ID = 'motrip-forstaff-hide-chat-widgets';

  function isForstaffPath() {
    try {
      return /\/forstaff\/?$/.test(window.location.pathname);
    } catch (e) {
      return false;
    }
  }

  /**
   * Виджеты живут в родителе (не внутри iframe), поэтому прятать их можно
   * только отсюда. display:none надёжнее z-index: кнопка fixed и иначе
   * всё равно торчит из-под угла, если iframe не на весь экран.
   */
  function hideForstaffChatWidgets() {
    if (!isForstaffPath()) {
      var stale = document.getElementById(FORSTAFF_WIDGET_STYLE_ID);
      if (stale) stale.remove();
      return;
    }
    if (document.getElementById(FORSTAFF_WIDGET_STYLE_ID)) return;

    var style = document.createElement('style');
    style.id = FORSTAFF_WIDGET_STYLE_ID;
    style.textContent = [
      /* Bitrix24 CRM-кнопка (зелёный кружок с чатом) */
      '.b24-widget-button-wrapper,',
      '.b24-widget-button-shadow,',
      '[data-b24-crm-button-cont],',
      '[data-b24-crm-button-shadow],',
      /* Novofon / Comagic (телефонная стойка поверх портала) */
      '.comagic-widget,',
      '.comagic-o-rack,',
      '[c-wtype="rack"] {',
      '  display: none !important;',
      '  visibility: hidden !important;',
      '  pointer-events: none !important;',
      '  z-index: -1 !important;',
      '}',
    ].join('\n');
    (document.head || document.documentElement).appendChild(style);
  }

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
    hideForstaffChatWidgets();

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
