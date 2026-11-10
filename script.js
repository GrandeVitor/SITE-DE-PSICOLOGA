/* =========================================================
   TEMA CLARO / ESCURO
   ========================================================= */
(function () {
  const root   = document.documentElement;
  const toggle = document.querySelector('.theme-toggle');
  const meta   = document.getElementById('theme-color-meta');

  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    if (toggle) {
      const isDark = theme === 'dark';
      toggle.setAttribute('aria-pressed', isDark ? 'true' : 'false');
      toggle.setAttribute('aria-label', isDark ? 'Ativar tema claro' : 'Ativar tema escuro');
    }
    if (meta) {
      meta.setAttribute('content', theme === 'dark' ? '#0F0E0C' : '#ECE9E4');
    }
  }

  // Aplica o tema inicial
  applyTheme(root.getAttribute('data-theme') || 'dark');

  if (toggle) {
    toggle.addEventListener('click', function () {
      const current = root.getAttribute('data-theme') || 'dark';
      const next    = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      try { localStorage.setItem('theme', next); } catch (e) {}
    });
  }
})();

/* =========================================================
   MENU MOBILE
   ========================================================= */
(function () {
  const toggle = document.querySelector('.menu-toggle');
  const nav    = document.getElementById('main-nav');
  if (!toggle || !nav) return;

  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  nav.querySelectorAll('a').forEach(a =>
    a.addEventListener('click', () => {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    })
  );
})();

/* =========================================================
   DESTAQUE DO LINK ATIVO
   ========================================================= */
(function () {
  const sections = document.querySelectorAll('main > section[id]');
  const navLinks = document.querySelectorAll('.main-nav a');
  if (!sections.length || !navLinks.length || !('IntersectionObserver' in window)) return;

  const map = new Map();
  navLinks.forEach(a => map.set(a.getAttribute('href').slice(1), a));

  const io = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          navLinks.forEach(a => a.classList.remove('active'));
          const link = map.get(entry.target.id);
          if (link) link.classList.add('active');
        }
      });
    },
    { rootMargin: '-45% 0px -50% 0px', threshold: 0 }
  );

  sections.forEach(s => io.observe(s));
})();

/* =========================================================
   CARROSSEL DE RECOMENDAÇÕES — lê de /content/recomendacoes.json
   =========================================================
   Para adicionar/editar, use o painel do Decap (/admin) ou
   edite o arquivo content/recomendacoes.json.
   Agora com filtros por tipo (Todos / Vídeos / Textos ...).
   A animação usa requestAnimationFrame (impossível de travar).
   ========================================================= */
(function () {
  const track    = document.getElementById('carousel-track');
  const viewport = document.getElementById('carousel-viewport');
  const carousel = document.getElementById('carousel');
  if (!track || !viewport || !carousel) return;

  const filtersEl = document.getElementById('rec-filters');
  const prevBtn = carousel.querySelector('.carousel-arrow--prev');
  const nextBtn = carousel.querySelector('.carousel-arrow--next');

  const isEN = (document.documentElement.lang || 'pt').toLowerCase().startsWith('en');
  const TXT = isEN
    ? {
        all: 'All',
        plural: { 'Vídeo': 'Videos', 'Texto': 'Texts', 'Podcast': 'Podcasts', 'Artigo': 'Articles', 'Capítulo': 'Chapters', 'Livro': 'Books' },
        single: { 'Vídeo': 'Video', 'Texto': 'Text', 'Podcast': 'Podcast', 'Artigo': 'Article', 'Capítulo': 'Chapter', 'Livro': 'Book' },
        error: 'Could not load the recommendations right now.',
        empty: 'No recommendations published yet.'
      }
    : {
        all: 'Todos',
        plural: { 'Vídeo': 'Vídeos', 'Texto': 'Textos', 'Podcast': 'Podcasts', 'Artigo': 'Artigos', 'Capítulo': 'Capítulos', 'Livro': 'Livros' },
        single: {},
        error: 'Não foi possível carregar as recomendações agora.',
        empty: 'Nenhuma recomendação publicada ainda.'
      };

  /* ---------- helpers ---------- */
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }
  function escapeAttr(s) { return escapeHtml(s); }

  const YT_RE = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

  function autoImage(item) {
    if (item.imagem) return item.imagem;
    if (item.tipo === 'Vídeo') {
      const m = (item.link || '').match(YT_RE);
      if (m) return `https://img.youtube.com/vi/${m[1]}/maxresdefault.jpg`;
    }
    return '';
  }

  function cardHTML(item, isClone) {
    const tipo  = item.tipo || 'Conteúdo';
    const label = TXT.single[tipo] || tipo;
    const img   = autoImage(item);

    const ytId = (item.tipo === 'Vídeo' && item.link)
      ? (item.link.match(YT_RE) || [])[1]
      : null;

    let thumb;
    if (img && ytId && !item.imagem) {
      // YouTube: tenta maxresdefault (HD). Se falhar, cai pra hqdefault.
      const hd       = `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`;
      const fallback = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
      thumb = `<img src="${hd}"
                    onload="if(this.naturalWidth<200){this.onload=null;this.src='${fallback}';}"
                    onerror="this.onerror=null;this.src='${fallback}';"
                    alt="" loading="lazy">`;
    } else if (img) {
      thumb = `<img src="${escapeAttr(img)}" alt="" loading="lazy">`;
    } else {
      thumb = `<span class="thumb-fallback" aria-hidden="true">${escapeHtml(label.charAt(0))}</span>`;
    }

    const extra = isClone ? ' tabindex="-1" aria-hidden="true"' : '';
    return `
      <a class="card" href="${escapeAttr(item.link || '#')}" target="_blank" rel="noopener"${extra}>
        <div class="card-thumb">${thumb}</div>
        <div class="card-body">
          <span class="card-type">${escapeHtml(label)}</span>
          <span class="card-title">${escapeHtml(item.titulo)}</span>
        </div>
      </a>`;
  }

  /* ---------- estado ---------- */
  const CLONES = 3;
  let ALL = [];
  let current = [];
  let N = 0;
  let looping = false;
  let stepWidth = 0;
  let pos = CLONES;
  let currentOffset = 0;
  let animating = false;
  let animToken = 0;

  /* ---------- construir trilho (modo loop) ---------- */
  function build() {
    const clonesStart = current.slice(-CLONES).map(c => cardHTML(c, true)).join('');
    const reals       = current.map(c => cardHTML(c, false)).join('');
    const clonesEnd   = current.slice(0, CLONES).map(c => cardHTML(c, true)).join('');
    track.innerHTML = clonesStart + reals + clonesEnd;
  }

  function measure() {
    const card = track.querySelector('.card');
    if (!card) return;
    const gap = parseFloat(getComputedStyle(track).gap) || 24;
    stepWidth = card.getBoundingClientRect().width + gap;
  }

  function applyTransform() {
    track.style.transform = `translate3d(${currentOffset}px, 0, 0)`;
  }

  /* ---------- montar uma lista (todos ou filtrada) ---------- */
  function mount(list) {
    current = list;
    N = list.length;
    animToken++;
    animating = false;
    looping = N > CLONES;

    carousel.classList.toggle('is-static', !looping);
    track.classList.toggle('is-static', !looping);

    if (!looping) {
      // Poucos itens: mostra todos em grade simples, sem loop.
      track.innerHTML = list.map(c => cardHTML(c, false)).join('');
      currentOffset = 0;
      track.style.transform = 'none';
      return;
    }

    build();
    measure();
    pos = CLONES;
    currentOffset = -pos * stepWidth;
    applyTransform();
    void track.offsetWidth;
  }

  /* ---------- animação via requestAnimationFrame ---------- */
  function animateTo(targetOffset, onDone) {
    const myToken = ++animToken;
    const start = currentOffset;
    const delta = targetOffset - start;
    const t0 = performance.now();
    const duration = 420;

    function frame(now) {
      if (myToken !== animToken) return;
      const t = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      currentOffset = start + delta * eased;
      applyTransform();
      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        currentOffset = targetOffset;
        applyTransform();
        if (onDone) onDone();
      }
    }
    requestAnimationFrame(frame);
  }

  /* ---------- navegação ---------- */
  function stepBy(direction) {
    if (!looping || animating) return;
    animating = true;

    const newPos = pos + direction;
    const targetOffset = -newPos * stepWidth;

    animateTo(targetOffset, () => {
      pos = newPos;

      // Loop: se saiu da zona real, "salta" para a posição equivalente
      if (pos > CLONES + N - 1) {
        pos -= N;
        currentOffset = -pos * stepWidth;
        applyTransform();
        void track.offsetWidth;
      } else if (pos < CLONES) {
        pos += N;
        currentOffset = -pos * stepWidth;
        applyTransform();
        void track.offsetWidth;
      }

      animating = false;
    });
  }

  if (prevBtn) prevBtn.addEventListener('click', () => stepBy(-1));
  if (nextBtn) nextBtn.addEventListener('click', () => stepBy(+1));

  /* ---------- teclado ---------- */
  carousel.setAttribute('tabindex', '0');
  carousel.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft')  { e.preventDefault(); stepBy(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); stepBy(+1); }
  });

  /* ---------- swipe (toque) ---------- */
  let touchStartX = 0, touchStartY = 0;
  viewport.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }
  }, { passive: true });

  viewport.addEventListener('touchend', (e) => {
    if (e.changedTouches.length !== 1) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      stepBy(dx < 0 ? +1 : -1);
    }
  }, { passive: true });

  /* ---------- resize ---------- */
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (current.length) mount(current); }, 200);
  });

  /* ---------- filtros por tipo ---------- */
  function renderFilters() {
    if (!filtersEl) return;
    const types = [];
    ALL.forEach(i => { const t = i.tipo || 'Conteúdo'; if (!types.includes(t)) types.push(t); });
    if (types.length < 2) { filtersEl.hidden = true; return; }

    const chip = (key, label, count, pressed) =>
      `<button type="button" class="chip" data-type="${escapeAttr(key)}" aria-pressed="${pressed}">
         ${escapeHtml(label)} <span class="chip-count">${count}</span>
       </button>`;

    filtersEl.innerHTML =
      chip('*', TXT.all, ALL.length, true) +
      types.map(t => chip(t, TXT.plural[t] || t, ALL.filter(i => (i.tipo || 'Conteúdo') === t).length, false)).join('');
    filtersEl.hidden = false;

    filtersEl.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-type]');
      if (!btn) return;
      filtersEl.querySelectorAll('[data-type]').forEach(b =>
        b.setAttribute('aria-pressed', b === btn ? 'true' : 'false')
      );
      const t = btn.dataset.type;
      mount(t === '*' ? ALL : ALL.filter(i => (i.tipo || 'Conteúdo') === t));
    });
  }

  /* ---------- carrega o JSON ---------- */
  fetch('/content/recomendacoes.json')
    .then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(data => {
      ALL = data.itens || [];
      if (!ALL.length) {
        track.innerHTML = `<p style="padding:40px;color:var(--muted)">${TXT.empty}</p>`;
        return;
      }
      renderFilters();
      mount(ALL);
      // Reajusta medidas quando fontes/imagens terminarem de carregar.
      window.addEventListener('load', () => { if (current.length) mount(current); });
    })
    .catch(err => {
      console.error('Erro ao carregar recomendações:', err);
      track.innerHTML = `<p style="padding:40px;color:var(--muted)">${TXT.error}</p>`;
    });
})();

/* =========================================================
   DETECÇÃO DE IDIOMA (com memória) — PT/EN
   ========================================================= */
(function () {
  const pathname = window.location.pathname;
  const isRoot = pathname === '/' || pathname === '/index.html';

  if (!isRoot) return;

  let chosen = null;
  try { chosen = localStorage.getItem('lang-chosen'); } catch (e) {}

  if (chosen === 'en') { window.location.replace('/en/'); return; }
  if (chosen === 'pt') return;

  // Sem detecção de navegador: fica em PT por padrão.
  // (Quem quiser EN, clica no seletor "EN".)
})();

/* =========================================================
   SELETOR DE IDIOMA — salva a escolha
   ========================================================= */
(function () {
  document.querySelectorAll('.lang-link').forEach(link => {
    link.addEventListener('click', () => {
      try {
        localStorage.setItem('lang-chosen', link.dataset.lang);
      } catch (e) { /* ignora */ }
    });
  });
})();

/* =========================================================
   AVISO DE REDIRECIONAMENTO — PT/EN
   ========================================================= */
(function () {
  const path = window.location.pathname;
  const isEN = path.startsWith('/en/');
  if (!isEN) return;

  let chosen = null;
  try { chosen = localStorage.getItem('lang-chosen'); } catch (e) {}

  if (chosen) return;

  const msg = {
    text: 'You are viewing this site in English.',
    linkText: 'View in Portuguese',
    linkHref: '/',
    closeLabel: 'Close notice'
  };

  const banner = document.createElement('div');
  banner.className = 'lang-banner';
  banner.setAttribute('role', 'status');
  banner.setAttribute('aria-live', 'polite');

  banner.innerHTML = `
    <span>${msg.text}</span>
    <a href="${msg.linkHref}" class="lang-banner-link">${msg.linkText}</a>
    <button class="lang-banner-close" aria-label="${msg.closeLabel}">×</button>
  `;
  document.body.prepend(banner);

  banner.querySelector('.lang-banner-close').addEventListener('click', () => {
    banner.remove();
    try { localStorage.setItem('lang-chosen', 'en'); } catch (e) {}
  });
})();

/* =========================================================
   VALIDAÇÃO DO TELEFONE — máscara (53) 98406-0277, só números
   ========================================================= */
(function () {
  const tel = document.getElementById('telefone');
  if (!tel) return;

  tel.addEventListener('input', function () {
    let v = this.value.replace(/\D/g, '');
    if (v.length > 11) v = v.slice(0, 11);

    if (v.length > 0) {
      if (v.length <= 2) {
        v = '(' + v;
      } else if (v.length <= 6) {
        v = '(' + v.slice(0, 2) + ') ' + v.slice(2);
      } else if (v.length <= 10) {
        v = '(' + v.slice(0, 2) + ') ' + v.slice(2, 6) + '-' + v.slice(6);
      } else {
        v = '(' + v.slice(0, 2) + ') ' + v.slice(2, 7) + '-' + v.slice(7);
      }
    }

    this.value = v;
  });

  tel.addEventListener('paste', function () {
    setTimeout(() => {
      this.dispatchEvent(new Event('input'));
    }, 0);
  });
})();

/* =========================================================
   LER MAIS (collapse de texto) — com suporte a PT/EN
   ========================================================= */
(function () {
  const buttons = document.querySelectorAll('.read-more-btn');
  if (!buttons.length) return;

  // Detecta o idioma da página (<html lang="pt-BR"> ou <html lang="en">)
  const lang = (document.documentElement.lang || 'pt').toLowerCase().startsWith('en') ? 'en' : 'pt';

  // Textos do botão por idioma
  const TEXTS = {
    pt: { open: 'Continuar lendo', close: 'Mostrar menos' },
    en: { open: 'Continue reading', close: 'Show less' }
  };

  const labels = TEXTS[lang];

  buttons.forEach(btn => {
    const targetId = btn.dataset.target;
    const content = document.getElementById(targetId);
    if (!content) return;

    const label = btn.querySelector('.read-more-label');

    // Garante que o texto inicial esteja no idioma certo
    if (label && !content.classList.contains('is-open')) {
      label.textContent = labels.open;
    }

    btn.addEventListener('click', () => {
      const isOpen = content.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      if (label) {
        label.textContent = isOpen ? labels.close : labels.open;
      }
    });
  });
})();

/* =========================================================
   NETLIFY IDENTITY — trata o token de convite na URL
   (para o link do convite abrir a tela de definir senha)
   ========================================================= */
(function () {
  if (!window.netlifyIdentity) return;

  // Se a URL tem #invite_token=..., abre o modal de definir senha
  if (window.location.hash.includes('invite_token')) {
    window.netlifyIdentity.on('init', function (user) {
      if (!user) {
        window.netlifyIdentity.open('signup');
      }
    });
  }

  // Se a URL tem #recovery_token=..., abre o modal de redefinir senha
  if (window.location.hash.includes('recovery_token')) {
    window.netlifyIdentity.on('init', function (user) {
      if (!user) {
        window.netlifyIdentity.open('recovery');
      }
    });
  }
})();
/* =========================================================
   VERSÃO DINÂMICA — animações e interações
   ========================================================= */

/* ---------- Revelar ao rolar + contadores ---------- */
(function () {
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const items  = document.querySelectorAll('[data-reveal]');
  const counters = document.querySelectorAll('[data-count]');

  function animateCount(el) {
    const target = parseInt(el.dataset.count, 10) || 0;
    if (reduce || target <= 0) { el.textContent = target; return; }
    const duration = 1100;
    const t0 = performance.now();
    el.textContent = '0';
    (function frame(now) {
      const t = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(target * eased);
      if (t < 1) requestAnimationFrame(frame);
    })(t0);
  }

  if (!('IntersectionObserver' in window)) {
    items.forEach(el => el.classList.add('in'));
    return;
  }

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('in');
      entry.target.querySelectorAll('[data-count]').forEach(animateCount);
      io.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

  items.forEach((el, i) => {
    // pequeno escalonamento entre irmãos
    if (!el.style.getPropertyValue('--d')) {
      const idx = Array.prototype.indexOf.call(el.parentElement.children, el);
      el.style.setProperty('--d', Math.min(idx, 5) * 70 + 'ms');
    }
    io.observe(el);
  });
})();

/* ---------- "Como atuo": cartões deslizantes ---------- */
(function () {
  const track = document.getElementById('story-track');
  if (!track) return;

  const cards  = Array.prototype.slice.call(track.children);
  const dotsEl = document.getElementById('story-dots');
  const prev   = document.getElementById('story-prev');
  const next   = document.getElementById('story-next');
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function step() {
    const gap = parseFloat(getComputedStyle(track).columnGap) || 16;
    return cards[0].getBoundingClientRect().width + gap;
  }

  function go(i) {
    i = Math.max(0, Math.min(cards.length - 1, i));
    track.scrollTo({ left: i * step(), behavior: reduce ? 'auto' : 'smooth' });
  }

  const dots = cards.map((c, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'story-dot';
    b.setAttribute('aria-label', (i + 1) + ' / ' + cards.length);
    b.addEventListener('click', () => go(i));
    dotsEl.appendChild(b);
    return b;
  });

  function currentIndex() {
    const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
    if (atEnd) return cards.length - 1;
    return Math.round(track.scrollLeft / step());
  }

  let ticking = false;
  function update() {
    ticking = false;
    const i = currentIndex();
    dots.forEach((d, j) => d.setAttribute('aria-current', j === i ? 'true' : 'false'));
    prev.disabled = i <= 0;
    next.disabled = i >= cards.length - 1;
  }
  track.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  window.addEventListener('resize', update);

  prev.addEventListener('click', () => go(currentIndex() - 1));
  next.addEventListener('click', () => go(currentIndex() + 1));

  track.addEventListener('keydown', (e) => {
    if (e.target.closest('summary')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); go(currentIndex() + 1); }
    if (e.key === 'ArrowLeft')  { e.preventDefault(); go(currentIndex() - 1); }
  });

  update();
})();

/* ---------- "O processo": abas ---------- */
(function () {
  const list = document.querySelector('.steps');
  if (!list) return;

  const tabs   = Array.prototype.slice.call(list.querySelectorAll('[role="tab"]'));
  const panels = tabs.map(t => document.getElementById(t.getAttribute('aria-controls')));

  function select(i, focus) {
    tabs.forEach((t, j) => {
      const on = i === j;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      panels[j].hidden = !on;
    });
    if (focus) tabs[i].focus();
  }

  tabs.forEach((t, i) => t.addEventListener('click', () => select(i, false)));

  list.addEventListener('keydown', (e) => {
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    let n = null;
    if (e.key === 'ArrowRight') n = (i + 1) % tabs.length;
    if (e.key === 'ArrowLeft')  n = (i - 1 + tabs.length) % tabs.length;
    if (e.key === 'Home') n = 0;
    if (e.key === 'End')  n = tabs.length - 1;
    if (n !== null) { e.preventDefault(); select(n, true); }
  });

  // Sem JS, todos os painéis ficam visíveis; com JS, só o primeiro.
  select(0, false);
})();

/* ---------- Hero: vídeo de fundo ---------- */
(function () {
  const v = document.querySelector('.hero-video');
  if (!v) return;

  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saveData = navigator.connection && navigator.connection.saveData;

  // Quem prefere menos movimento (ou economiza dados) vê só a imagem de capa.
  if (reduce || saveData) {
    v.removeAttribute('autoplay');
    v.pause();
    return;
  }

  function play() {
    const p = v.play();
    if (p && p.catch) p.catch(function () {});
  }
  play();

  // Pausa o vídeo quando o hero sai da tela (economiza bateria).
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { e.isIntersecting ? play() : v.pause(); });
    }, { threshold: 0.05 }).observe(v);
  }
})();
