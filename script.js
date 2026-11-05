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
   A animação usa requestAnimationFrame (impossível de travar).
   ========================================================= */
(function () {
  const track    = document.getElementById('carousel-track');
  const viewport = document.getElementById('carousel-viewport');
  const carousel = document.getElementById('carousel');
  if (!track || !viewport || !carousel) return;

  const prevBtn = carousel.querySelector('.carousel-arrow--prev');
  const nextBtn = carousel.querySelector('.carousel-arrow--next');

  /* ---------- helpers ---------- */
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[c]));
  }
  function escapeAttr(s) { return escapeHtml(s); }

  function autoImage(item) {
    if (item.imagem) return item.imagem;
    if (item.tipo === 'Vídeo') {
      const m = (item.link || '').match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      if (m) return `https://img.youtube.com/vi/${m[1]}/maxresdefault.jpg`;
    }
    return '';
  }

  function cardHTML(item, isClone) {
    const label = item.tipo || 'Conteúdo';
    const img = autoImage(item);

    // Extrai o ID do YouTube (se for vídeo)
    const ytId = (item.tipo === 'Vídeo' && item.link)
      ? (item.link.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/) || [])[1]
      : null;

    let thumb;
    if (img && ytId) {
      // YouTube: tenta maxresdefault (HD). Se falhar, cai pra hqdefault (SD com barras).
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

  /* ---------- carrega o JSON e inicializa o carrossel ---------- */
  fetch('/content/recomendacoes.json')
    .then(r => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(data => {
      const RECOMENDACOES = data.itens || [];
      initCarrossel(RECOMENDACOES);
    })
    .catch(err => {
      console.error('Erro ao carregar recomendações:', err);
      track.innerHTML = '<p style="padding:40px;color:var(--muted)">Não foi possível carregar as recomendações agora.</p>';
    });

  function initCarrossel(RECOMENDACOES) {
    if (!RECOMENDACOES.length) {
      track.innerHTML = '<p style="padding:40px;color:var(--muted)">Nenhuma recomendação publicada ainda.</p>';
      return;
    }

    /* ---------- estado ---------- */
    const N = RECOMENDACOES.length;
    const CLONES = 3;
    let stepWidth = 0;
    let pos = CLONES;
    let currentOffset = 0;
    let animating = false;

    /* ---------- construir trilho ---------- */
    function build() {
      const clonesStart = RECOMENDACOES.slice(-CLONES).map(c => cardHTML(c, true)).join('');
      const reals       = RECOMENDACOES.map(c => cardHTML(c, false)).join('');
      const clonesEnd   = RECOMENDACOES.slice(0, CLONES).map(c => cardHTML(c, true)).join('');
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

    /* ---------- animação via requestAnimationFrame (nunca trava) ---------- */
    let animToken = 0;
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
      if (animating) return;
      animating = true;

      const newPos = pos + direction;
      const targetOffset = -newPos * stepWidth;

      animateTo(targetOffset, () => {
        pos = newPos;

        // Loop: se saiu da zona real, "salta" para a posição equivalente (sem animação)
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

    /* ---------- setas ---------- */
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
      resizeTimer = setTimeout(() => {
        animToken++;
        animating = false;
        build();
        measure();
        pos = CLONES;
        currentOffset = -pos * stepWidth;
        applyTransform();
        void track.offsetWidth;
      }, 200);
    });

    /* ---------- init ---------- */
    function init() {
      build();
      measure();
      pos = CLONES;
      currentOffset = -pos * stepWidth;
      applyTransform();
      void track.offsetWidth;
    }

    if (document.readyState === 'complete') init();
    else window.addEventListener('load', init);
  }
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