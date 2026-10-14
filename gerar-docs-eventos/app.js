// Interface do HTML gerado (JS puro, sem build). O YAML vem em window.__SPEC__ = { title, text }.
(function () {
  var THEME_KEY = 'events-docs-theme';
  var CONFIG = { show: { sidebar: true }, sidebar: { showOperations: 'byDefault' } };
  var root = document.getElementById('root');

  var theme = localStorage.getItem(THEME_KEY) ||
    (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  function applyTheme() {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
    var label = theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro';
    themeBtn.title = label;
    themeBtn.setAttribute('aria-label', label);
    themeIcon.innerHTML = theme === 'dark' ? SUN : MOON; // strings fixas abaixo
  }

  function el(tag, props, children) {
    var n = document.createElement(tag);
    Object.assign(n, props || {});
    (children || []).forEach(function (c) { n.append(c); });
    return n;
  }

  // tema: botão flutuante, no mesmo grupo dos botões de exportação (export.js os adiciona antes dele)
  var SUN = '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
  var MOON = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
  var themeIcon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  ['viewBox:0 0 24 24', 'width:20', 'height:20', 'fill:none', 'stroke:currentColor', 'stroke-width:2', 'stroke-linecap:round', 'stroke-linejoin:round'].forEach(function (a) {
    themeIcon.setAttribute(a.split(':')[0], a.split(':')[1]);
  });
  var themeBtn = el('button', { className: 'fab' }, [themeIcon]);
  var fabGroup = el('div', { className: 'fab-group' }, [themeBtn]);
  document.body.append(fabGroup);
  themeBtn.onclick = function () { theme = theme === 'dark' ? 'light' : 'dark'; applyTheme(); };
  // menu lateral: recolher/exibir (lembra a escolha). No layout estreito, o componente usa o botão hambúrguer.
  var MENU_KEY = 'events-docs-menu-hidden';
  var menuBtn = el('button', { className: 'tab menu-btn', textContent: '☰', title: 'Ocultar/exibir o menu lateral', ariaLabel: 'Ocultar ou exibir o menu lateral' });
  function applyMenu(hidden) {
    document.documentElement.classList.toggle('sidebar-hidden', hidden);
    menuBtn.setAttribute('aria-pressed', String(!hidden));
  }
  applyMenu(localStorage.getItem(MENU_KEY) === '1');
  menuBtn.onclick = function () {
    var burger = document.querySelector('.burger-menu');
    if (burger && burger.getClientRects().length > 0) { burger.click(); return; }
    var hidden = !document.documentElement.classList.contains('sidebar-hidden');
    localStorage.setItem(MENU_KEY, hidden ? '1' : '0');
    applyMenu(hidden);
  };
  var header = el('header', { className: 'top' }, [
    menuBtn,
    el('strong', { textContent: window.__SPEC__.title || 'Catálogo de eventos' }),
    el('nav'),
  ]);
  var error = el('p', { className: 'error', hidden: true });
  var target = el('div');
  root.append(header, el('main', {}, [error, target]));

  // ---------- Sidebar: busca + operações agrupadas (Receber / Enviar) ----------
  // Só mexemos em atributos/estilo e inserimos nós novos; os nós do componente não são removidos.
  var GROUPS = { RECEIVE: { label: 'Receber', order: 0 }, SEND: { label: 'Enviar', order: 2 } };

  function filterSidebar(sc, input, empty) {
    var q = input.value.trim().toLowerCase();
    var any = false;
    var top = sc.querySelector(':scope > ul');
    if (!top) return;
    Array.prototype.forEach.call(top.children, function (li) {
      var sub = li.querySelector(':scope > ul');
      var head = li.querySelector(':scope > a');
      var headText = head ? head.textContent.toLowerCase() : '';
      if (!sub) {
        li.hidden = !!q && headText.indexOf(q) < 0;
        if (!li.hidden) any = true;
        return;
      }
      var headMatch = !!q && headText.indexOf(q) >= 0;
      var shown = 0;
      Array.prototype.forEach.call(sub.children, function (child) {
        if (child.classList.contains('ev-group')) return;
        var m = !q || headMatch || child.textContent.toLowerCase().indexOf(q) >= 0;
        child.hidden = !m;
        if (m) shown++;
      });
      Array.prototype.forEach.call(sub.querySelectorAll(':scope > .ev-group'), function (g) {
        g.hidden = !sub.querySelector(':scope > li:not(.ev-group)[data-kind="' + g.dataset.kind + '"]:not([hidden])');
      });
      li.hidden = shown === 0;
      if (shown) any = true;
    });
    empty.hidden = any;
  }

  function enhanceSidebar() {
    Array.prototype.forEach.call(document.querySelectorAll('.sidebar--content'), function (sc) {
      var box = sc.querySelector('.ev-search');
      if (!box) {
        var input = el('input', { type: 'search', placeholder: 'Buscar…', ariaLabel: 'Buscar no menu' });
        var empty = el('p', { className: 'ev-empty', textContent: 'Nada encontrado.', hidden: true });
        box = el('div', { className: 'ev-search' }, [input]);
        sc.insertBefore(box, sc.children[1] || null);
        box.after(empty);
        input.oninput = function () { filterSidebar(sc, input, empty); };
        input.onkeydown = function (e) { if (e.key === 'Escape') { input.value = ''; filterSidebar(sc, input, empty); } };
      }
      // operações: agrupa por tipo, Receber antes de Enviar (via CSS `order`; ordem original mantida dentro do grupo)
      var opsLink = sc.querySelector('a[href="#operations"]');
      var ul = opsLink && opsLink.parentElement.querySelector(':scope > ul');
      if (ul) {
        ul.classList.add('ev-ops');
        Array.prototype.forEach.call(ul.querySelectorAll(':scope > li:not(.ev-group)'), function (li) {
          var kind = (li.querySelector('strong[title]') || {}).title;
          if (!GROUPS[kind]) return;
          li.dataset.kind = kind;
          li.style.order = GROUPS[kind].order + 1;
        });
        Object.keys(GROUPS).forEach(function (kind) {
          if (ul.querySelector(':scope > .ev-group[data-kind="' + kind + '"]')) return;
          if (!ul.querySelector(':scope > li[data-kind="' + kind + '"]')) return;
          var h = el('li', { className: 'ev-group', textContent: GROUPS[kind].label });
          h.dataset.kind = kind;
          h.style.order = GROUPS[kind].order;
          ul.append(h);
        });
      }
      filterSidebar(sc, box.querySelector('input'), box.nextElementSibling);
    });
  }
  var pending = false;
  new MutationObserver(function () {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () { pending = false; enhanceSidebar(); });
  }).observe(target, { childList: true, subtree: true });

  applyTheme();
  try {
    window.AsyncApiStandalone.render({ schema: window.__SPEC__.text, config: CONFIG }, target);
  } catch (e) {
    error.textContent = 'Erro ao renderizar: ' + e.message;
    error.hidden = false;
  }
})();
