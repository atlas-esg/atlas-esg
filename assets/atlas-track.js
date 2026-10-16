/* Atlas ESG · rastreador leve (um único arquivo para todas as páginas)
   - Envia eventos anônimos para o Apps Script que grava na planilha (aba "02. Eventos").
   - Para trocar o destino, edite SÓ a linha ATLAS_ENDPOINT abaixo.
   - Não guarda dados pessoais: usa apenas um ID aleatório de sessão (sessionStorage). */
(function () {
  var ATLAS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbzkv6uStyogphqY7UTOazF8lRL9_2sIuw3qVqIC0j6pRDN9M06yNI4i8ovZE3-F-X4USg/exec';
  window.ATLAS_ENDPOINT = ATLAS_ENDPOINT;

  function ss(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) {} return null; }

  /* ID anônimo da sessão (mesma chave que a demo já usava) */
  function sid() {
    var x = ss('atlas_sid');
    if (!x) { x = Math.random().toString(36).slice(2, 10); ss('atlas_sid', x); }
    return x || 'na';
  }

  /* Mercado: pela pasta (/br, /eu), por ?m=br|eu, ou o último visto na sessão */
  function market() {
    var m = '', p = location.pathname.toLowerCase();
    if (/^\/br(\/|$)/.test(p)) m = 'BR'; else if (/^\/eu(\/|$)/.test(p)) m = 'EU';
    if (!m) { try { var q = (new URLSearchParams(location.search).get('m') || '').toLowerCase(); if (q === 'br') m = 'BR'; if (q === 'eu') m = 'EU'; } catch (e) {} }
    if (m) ss('atlas_m', m); else m = ss('atlas_m') || '';
    return m;
  }

  /* Origem do tráfego: UTM > site de referência > direto (guardada na primeira página da sessão) */
  function source() {
    var s = ss('atlas_src');
    if (s) return s;
    s = 'direto';
    try {
      var q = new URLSearchParams(location.search), u = q.get('utm_source');
      if (u) { s = u + (q.get('utm_medium') ? ' / ' + q.get('utm_medium') : '') + (q.get('utm_campaign') ? ' / ' + q.get('utm_campaign') : ''); }
      else if (document.referrer) { var h = new URL(document.referrer).hostname.replace(/^www\./, ''); if (h && h !== location.hostname.replace(/^www\./, '')) s = h; }
    } catch (e) {}
    ss('atlas_src', s);
    return s;
  }

  window.atlasSid = sid; window.atlasMarket = market; window.atlasSrc = source;

  var sent = 0, MAX = 120;
  function post(body) {
    if (!ATLAS_ENDPOINT) return;
    try { fetch(ATLAS_ENDPOINT, { method: 'POST', mode: 'no-cors', keepalive: true, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) }).catch(function () {}); } catch (e) {}
  }
  function send(evento, props) {
    if (++sent > MAX) return;
    post({ tipo: 'evento', evento: evento, sessao: sid(), mercado: market(), origem: source(), pagina: location.pathname, idioma: document.documentElement.lang || '', props: props || {}, quando: new Date().toISOString() });
  }
  window.atlasTrack = send;

  /* Eventos que só contam uma vez por sessão e página */
  var ONCE = { visita_landing: 1, demo_iniciada: 1, preco_visualizado: 1, checkout_iniciado: 1, form_teste_visto: 1 };
  function once(n) { var k = 'atlas_once_' + n + '_' + location.pathname; if (ss(k)) return false; ss(k, '1'); return true; }
  function emit(n, props) { if (ONCE[n] && !once(n)) return; send(n, props); }

  /* Descobre se o último clique foi no botão de demo ou de teste (a landing já dispara "clique_cta") */
  var lastKind = '';
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target : null; if (!t) return;
    var d = t.closest('.demo-link'), f = t.closest('.free-link');
    lastKind = f ? 'teste' : d ? 'demo' : '';
    var el = f || d;
    if (el && !el.hasAttribute('data-cta')) emit(lastKind === 'teste' ? 'teste_clicado' : 'demo_clicada', { local: 'sem-rotulo' });
  }, true);

  /* As páginas já chamam window.plausible(nome, {props}). Este adaptador traduz para o vocabulário da planilha. */
  var MAP = {
    clique_plano: 'plano_clicado',
    precontratacao_vista: 'checkout_iniciado',
    teste_gratis_visto: 'form_teste_visto',
    step_complete: 'demo_concluida',
    precontratacao_enviada: null,   /* o servidor registra o envio (evento "formulario_enviado") */
    teste_gratis_enviado: null,
    interesse_abriu: null,          /* a demo já envia estes direto ao servidor */
    interesse_enviado: null,
    recurso_bloqueado: null
  };
  if (!window.plausible) {
    window.plausible = function (n, o) {
      var props = (o && o.props) || {}, name;
      if (n === 'clique_cta') name = lastKind === 'teste' ? 'teste_clicado' : lastKind === 'demo' ? 'demo_clicada' : 'cta_clicado';
      else if (Object.prototype.hasOwnProperty.call(MAP, n)) name = MAP[n];
      else name = n;
      if (name) emit(name, props);
    };
  }

  /* Visita à landing / demo iniciada, e "preço visualizado" quando a seção de planos aparece */
  function boot() {
    var p = location.pathname.toLowerCase().replace(/index\.html$/, '').replace(/\/+$/, '');
    if (p === '/br' || p === '/eu') emit('visita_landing', {});
    if (p === '/demo') emit('demo_iniciada', {});
    var pr = document.getElementById('precos');
    if (pr && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) { es.forEach(function (x) { if (x.isIntersecting) { emit('preco_visualizado', {}); io.disconnect(); } }); }, { threshold: 0.3 });
      io.observe(pr);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
