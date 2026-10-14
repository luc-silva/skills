// Botões flutuantes: baixar .md, imprimir/PDF e copiar. O Markdown é gerado a partir do próprio spec
// (window.__SPEC__.text, lido com js-yaml), não do HTML renderizado.
(function () {
  var spec = window.__SPEC__;
  var doc;
  try { doc = window.jsyaml.load(spec.text); } catch (e) { doc = null; }

  // ---------- helpers de $ref e schema ----------
  function lookup(ref) {
    var node = doc;
    ref.replace(/^#\//, '').split('/').forEach(function (p) {
      node = node && node[decodeURIComponent(p).replace(/~1/g, '/').replace(/~0/g, '~')];
    });
    return node;
  }
  // segue cadeias de $ref; `name` = último segmento da última referência seguida
  function deref(o) {
    var name = '';
    var guard = 0;
    while (o && typeof o === 'object' && o.$ref && guard++ < 20) {
      name = o.$ref.split('/').pop();
      o = lookup(o.$ref);
    }
    return { value: o, name: name };
  }
  function cell(s) { return String(s == null ? '' : s).replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ').trim(); }
  function code(s) { return '`' + String(s).replace(/`/g, "'") + '`'; }
  function json(v) { return JSON.stringify(v); }

  // junta allOf em um schema só
  function merge(schema, stack) {
    var r = deref(schema);
    var s = r.value || {};
    var out = Object.assign({}, s);
    out.__name = r.name;
    if (s.allOf) {
      out.properties = Object.assign({}, s.properties);
      out.required = (s.required || []).slice();
      s.allOf.forEach(function (part) {
        var m = merge(part, stack);
        Object.assign(out.properties, m.properties || {});
        out.required = out.required.concat(m.required || []);
        ['type', 'description', 'items'].forEach(function (k) { if (out[k] == null && m[k] != null) out[k] = m[k]; });
        if (!out.__name && m.__name) out.__name = m.__name;
      });
    }
    return out;
  }

  function typeOf(m) {
    var t = Array.isArray(m.type) ? m.type.join(' | ') : m.type;
    if (!t && m.properties) t = 'object';
    if (!t && (m.oneOf || m.anyOf)) t = m.oneOf ? 'oneOf' : 'anyOf';
    if (t === 'array' && m.items) {
      var it = merge(m.items);
      t = (it.__name || typeOf(it) || 'any') + '[]'; // sem <>: viraria tag HTML no Markdown
    } else if (m.__name && (t === 'object' || !t)) {
      t = m.__name;
    }
    if (m.format) t += ' (' + m.format + ')';
    return t || 'any';
  }

  function descOf(m) {
    var parts = [];
    if (m.description) parts.push(m.description);
    if (m.enum) parts.push('valores: ' + m.enum.map(function (v) { return code(v); }).join(', '));
    if (m.const !== undefined) parts.push('fixo: ' + code(json(m.const)));
    if (m.default !== undefined) parts.push('padrão: ' + code(json(m.default)));
    if (m.examples && m.examples.length) parts.push('ex.: ' + code(json(m.examples[0])));
    if (m.nullable) parts.push('pode ser nulo');
    return parts.join(' — ');
  }

  function rows(schema, prefix, depth, stack, out) {
    var m = merge(schema);
    var key = m.__name;
    if (key && stack.indexOf(key) >= 0) return;
    var next = key ? stack.concat(key) : stack;
    var req = m.required || [];
    var props = m.properties || {};
    Object.keys(props).forEach(function (k) {
      var p = merge(props[k]);
      out.push({ name: prefix + k, type: typeOf(p), req: req.indexOf(k) >= 0, desc: descOf(p) });
      if (depth < 6) {
        if (p.properties || p.allOf) rows(props[k], prefix + k + '.', depth + 1, next, out);
        else if (p.type === 'array' && p.items) {
          var it = merge(p.items);
          if (it.properties || it.allOf) rows(p.items, prefix + k + '[].', depth + 1, next, out);
        }
      }
    });
  }

  function schemaMd(schema) {
    var m = merge(schema);
    var out = [];
    rows(schema, '', 0, [], out);
    var md = '';
    if (!out.length) {
      return 'Tipo: ' + code(typeOf(m)) + (descOf(m) ? ' — ' + descOf(m) : '') + '\n';
    }
    md += '| Campo | Tipo | Obrig. | Descrição |\n|---|---|:-:|---|\n';
    out.forEach(function (r) {
      md += '| ' + code(r.name) + ' | ' + cell(r.type) + ' | ' + (r.req ? 'sim' : '') + ' | ' + cell(r.desc) + ' |\n';
    });
    return md;
  }

  function extMd(o) {
    var md = '';
    Object.keys(o || {}).forEach(function (k) {
      if (k.indexOf('x-') !== 0 || k === 'x-cloudevents') return;
      var v = o[k];
      if (Array.isArray(v)) {
        md += '- **' + k + '**:\n' + v.map(function (i) { return '  - ' + (typeof i === 'string' ? i : code(json(i))); }).join('\n') + '\n';
      } else {
        md += '- **' + k + '**: ' + (typeof v === 'string' ? code(v) : code(json(v))) + '\n';
      }
    });
    return md;
  }

  // ---------- Markdown ----------
  function toMarkdown() {
    if (!doc) return spec.text; // YAML ilegível: exporta o texto original
    var info = doc.info || {};
    var md = '# ' + (info.title || 'Eventos') + (info.version ? ' (v' + info.version + ')' : '') + '\n\n';
    // títulos da descrição descem um nível, para ficarem abaixo do título do documento
    if (info.description) md += info.description.trim().replace(/^(#{1,5}) /gm, '#$1 ') + '\n\n';

    var servers = doc.servers || {};
    if (Object.keys(servers).length) {
      md += '## Servidores\n\n| Nome | Protocolo | Host | Descrição |\n|---|---|---|---|\n';
      Object.keys(servers).forEach(function (k) {
        var s = deref(servers[k]).value || {};
        md += '| ' + code(k) + ' | ' + cell(s.protocol) + ' | ' + code(s.host || '') + ' | ' + cell(s.description) + ' |\n';
      });
      md += '\n';
    }

    var ops = doc.operations || {};
    var opKeys = Object.keys(ops);
    if (opKeys.length) {
      md += '## Operações\n\n';
      [['receive', 'Receber (o serviço consome)'], ['send', 'Enviar (o serviço publica)']].forEach(function (g) {
        var list = opKeys.filter(function (k) { return ops[k].action === g[0]; });
        if (!list.length) return;
        md += '### ' + g[1] + '\n\n';
        list.forEach(function (k) {
          var op = ops[k];
          md += '#### ' + code(k) + (op.title ? ' — ' + op.title : '') + '\n\n';
          if (op.summary) md += op.summary + '\n\n';
          if (op.description) md += op.description.trim() + '\n\n';
          var ch = op.channel && deref(op.channel);
          if (ch && ch.value) {
            md += '- **Canal**: ' + code(ch.name) + (ch.value.address ? ' → ' + code(ch.value.address) : '') + '\n';
          }
          var names = (op.messages || []).map(function (m) { return code(deref(m).name); });
          if (names.length) md += '- **Mensagens**: ' + names.join(', ') + '\n';
          if (op.tags && op.tags.length) md += '- **Tags**: ' + op.tags.map(function (t) { return code(t.name); }).join(', ') + '\n';
          md += extMd(op) + '\n';
        });
      });
    }

    var channels = doc.channels || {};
    if (Object.keys(channels).length) {
      md += '## Canais\n\n';
      Object.keys(channels).forEach(function (k) {
        var c = channels[k];
        md += '### ' + code(k) + (c.title ? ' — ' + c.title : '') + '\n\n';
        if (c.description) md += c.description.trim() + '\n\n';
        if (c.address) md += '- **Endereço**: ' + code(c.address) + '\n';
        if (c.servers) md += '- **Servidor**: ' + c.servers.map(function (s) { return code(deref(s).name); }).join(', ') + '\n';
        if (c.bindings) md += '- **Bindings**: ' + code(json(c.bindings)) + '\n';
        var msgs = Object.keys(c.messages || {}).map(function (m) { return code(deref(c.messages[m]).name || m); });
        if (msgs.length) md += '- **Mensagens**: ' + msgs.join(', ') + '\n';
        md += extMd(c) + '\n';
      });
    }

    var messages = (doc.components || {}).messages || {};
    if (Object.keys(messages).length) {
      md += '## Mensagens\n\n';
      Object.keys(messages).forEach(function (k) {
        var m = messages[k];
        md += '### ' + code(m.name || k) + (m.title ? ' — ' + m.title : '') + '\n\n';
        if (m.summary) md += m.summary + '\n\n';
        if (m.description) md += m.description.trim() + '\n\n';
        if (m.contentType) md += '- **Content-Type**: ' + code(m.contentType) + '\n';
        var ce = m['x-cloudevents'];
        if (ce) md += '- **CloudEvents (proposta)**: ' + Object.keys(ce).map(function (x) { return x + ' = ' + code(ce[x]); }).join(', ') + '\n';
        md += extMd(m);
        if (m.payload) md += '\n**Payload**' + (deref(m.payload).name ? ' (' + code(deref(m.payload).name) + ')' : '') + '\n\n' + schemaMd(m.payload);
        (m.examples || []).forEach(function (ex, i) {
          md += '\n**Exemplo' + (ex.name ? ': ' + ex.name : (m.examples.length > 1 ? ' ' + (i + 1) : '')) + '**\n\n```json\n' + JSON.stringify(ex.payload !== undefined ? ex.payload : ex, null, 2) + '\n```\n';
        });
        md += '\n';
      });
    }

    var schemas = (doc.components || {}).schemas || {};
    if (Object.keys(schemas).length) {
      md += '## Schemas\n\n';
      Object.keys(schemas).forEach(function (k) {
        var s = schemas[k];
        md += '### ' + code(k) + '\n\n';
        if (s.description) md += s.description.trim() + '\n\n';
        md += schemaMd(s) + '\n';
      });
    }
    return md.replace(/\n{3,}/g, '\n\n').trim() + '\n';
  }

  // ---------- botões ----------
  var NS = 'http://www.w3.org/2000/svg';
  function icon(inner) {
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '20');
    svg.setAttribute('height', '20');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.innerHTML = inner; // strings fixas abaixo
    return svg;
  }
  function fab(label, svgInner, onClick) {
    var b = document.createElement('button');
    b.className = 'fab';
    b.title = label;
    b.setAttribute('aria-label', label);
    b.append(icon(svgInner));
    b.onclick = onClick;
    return b;
  }

  var toastTimer;
  var toast = document.createElement('div');
  toast.className = 'toast';
  toast.hidden = true;
  function say(msg) {
    toast.textContent = msg;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.hidden = true; }, 2200);
  }

  // execCommand serve de reserva (página sem permissão/contexto seguro para a Clipboard API)
  function legacyCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.append(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    return ok ? Promise.resolve() : Promise.reject(new Error('copy failed'));
  }
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(function () { return legacyCopy(text); });
    }
    return legacyCopy(text);
  }

  var group = document.querySelector('.fab-group') || document.body.appendChild(document.createElement('div'));
  group.className = 'fab-group';
  group.prepend(
    fab('Baixar como Markdown (.md)', '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>', function () {
      var blob = new Blob([toMarkdown()], { type: 'text/markdown;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = String(spec.name || 'eventos').replace(/\.(ya?ml|json)$/i, '') + '.md';
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
      say('Markdown baixado');
    }),
    fab('Gerar PDF (imprimir → Salvar como PDF)', '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>', function () { window.print(); }),
    fab('Copiar Markdown', '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>', function () {
      copyText(toMarkdown()).then(function () { say('Markdown copiado'); }, function () { say('Não foi possível copiar'); });
    })
  );
  document.body.append(toast);

  // impressão/PDF: imprime o mesmo Markdown (convertido em HTML), não a tela. O documento de impressão
  // é montado em `beforeprint` (vale também para Ctrl+P) e escondido na tela.
  var printDoc = document.createElement('div');
  printDoc.id = 'print-doc';
  document.body.append(printDoc);
  window.addEventListener('beforeprint', function () {
    printDoc.innerHTML = window.marked.parse(toMarkdown(), { mangle: false, headerIds: false });
  });
  window.addEventListener('afterprint', function () { printDoc.innerHTML = ''; });
})();
