/**
 * ВРЕМЕННАЯ диагностика белого экрана на iPhone. Удалить после разбора.
 *
 * Портал на телефоне открывается пустым, при этом сервер отдаёт корректный HTML
 * с формой входа, а название страницы на устройстве видно. Значит разметку
 * стирает уже сам браузер — вероятнее всего падает гидратация React.
 *
 * Поэтому диагностика написана как обычный inline-скрипт без сборки и без React:
 * она обязана выжить там, где приложение умерло. Панель показывается только если
 * через три секунды на странице нет формы, то есть на рабочем портале её не видно.
 */
export const SELF_DIAGNOSTIC = String.raw`
(function(){
  var errs = [];
  function s(v){ return String(v == null ? '' : v); }

  window.addEventListener('error', function(e){
    if (e && e.target && e.target !== window && e.target.tagName) {
      errs.push('РЕСУРС не загрузился: ' + s(e.target.tagName) + ' ' + s(e.target.src || e.target.href));
      return;
    }
    errs.push('ОШИБКА JS: ' + s(e.message) + '\n    ' + s(e.filename) + ':' + s(e.lineno) + ':' + s(e.colno));
  }, true);

  window.addEventListener('unhandledrejection', function(e){
    var r = e ? e.reason : null;
    var msg = r && r.message ? r.message : r;
    var st = r && r.stack ? '\n    ' + s(r.stack).split('\n').slice(0, 5).join('\n    ') : '';
    errs.push('ОТКЛОНЁННОЕ ОБЕЩАНИЕ: ' + s(msg) + st);
  });

  function storage(){
    try { sessionStorage.setItem('__d', '1'); sessionStorage.removeItem('__d'); return 'работает'; }
    catch (e) { return 'заблокирован (' + s(e.name) + ')'; }
  }

  function framed(){
    try { return window.self !== window.top ? 'да' : 'нет'; } catch (e) { return 'да (кросс-домен)'; }
  }

  function sheets(){
    try {
      var n = document.styleSheets.length, rules = 0, i;
      for (i = 0; i < n; i++) { try { rules += document.styleSheets[i].cssRules.length; } catch (e) {} }
      return n + ' шт, правил ' + rules;
    } catch (e) { return 'ошибка: ' + s(e.message); }
  }

  function report(){
    if (document.querySelector('[data-diag]')) return;
    // Признак белого экрана — отсутствие видимого текста, а не отсутствие формы:
    // на /tours формы нет, и по ней панель всплыла бы поверх рабочего портала.
    var txt = '';
    try { txt = (document.body && document.body.innerText || '').replace(/\s+/g, ' ').trim(); } catch (e) {}
    if (txt.length > 40) return;

    var lines = [
      'ДИАГНОСТИКА ПОРТАЛА (временная)',
      '',
      'ошибок зафиксировано: ' + errs.length,
      errs.length ? errs.join('\n') : '(ни одной ошибки не поймано)',
      '',
      'элементов в body: ' + (document.body ? document.body.children.length : -1),
      'таблиц стилей: ' + sheets(),
      'вьюпорт: ' + window.innerWidth + 'x' + window.innerHeight + ', dpr ' + (window.devicePixelRatio || '?'),
      'высота документа: ' + (document.documentElement ? document.documentElement.scrollHeight : '?'),
      'внутри iframe: ' + framed(),
      'sessionStorage: ' + storage(),
      'cookie: ' + (navigator.cookieEnabled ? 'включены' : 'выключены'),
      'адрес: ' + location.href,
      '',
      navigator.userAgent
    ];

    var box = document.createElement('pre');
    box.setAttribute('data-diag', '1');
    box.style.cssText = 'position:fixed;left:0;top:0;right:0;bottom:0;overflow:auto;z-index:2147483647;'
      + 'margin:0;padding:14px;background:#ffe680;color:#111;'
      + 'font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;'
      + 'white-space:pre-wrap;word-break:break-word;-webkit-user-select:text;user-select:text';
    box.textContent = lines.join('\n');
    (document.body || document.documentElement).appendChild(box);
  }

  if (document.readyState === 'complete') setTimeout(report, 3000);
  else window.addEventListener('load', function(){ setTimeout(report, 3000); });
  setTimeout(report, 8000);
})();
`
