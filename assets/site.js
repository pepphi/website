(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const root = document.documentElement;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } }
  };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- Theme ---------- */
  const themeBtn = $('.theme-btn');
  if (themeBtn) themeBtn.addEventListener('click', () => {
    const current = root.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = current === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    store.set('theme', next);
  });

  /* ---------- Language ---------- */
  const LANGS = ['fi', 'en', 'sv'];
  const dict = window.I18N || {};
  let lang = 'fi';
  const t = key => (dict[lang] && dict[lang][key] !== undefined ? dict[lang][key] : dict.fi[key]);

  function pickLang() {
    const fromUrl = new URLSearchParams(location.search).get('lang');
    if (LANGS.includes(fromUrl)) return fromUrl;
    const saved = store.get('lang');
    if (LANGS.includes(saved)) return saved;
    for (const l of navigator.languages || [navigator.language || '']) {
      const code = l.slice(0, 2).toLowerCase();
      if (LANGS.includes(code)) return code;
    }
    return 'fi';
  }

  function movePill() {
    const pill = $('.langs .pill');
    const active = $(`.langs button[data-lang="${lang}"]`);
    if (!pill || !active) return;
    pill.style.width = active.offsetWidth + 'px';
    pill.style.transform = `translateX(${active.offsetLeft - 3}px)`;
  }

  function applyLang(next, save) {
    lang = next;
    root.lang = lang;
    if (save) store.set('lang', lang);
    $$('[data-i18n]').forEach(el => { const v = t(el.dataset.i18n); if (v !== undefined) el.textContent = v; });
    $$('[data-i18n-html]').forEach(el => { const v = t(el.dataset.i18nHtml); if (v !== undefined) el.innerHTML = v; });
    $$('[data-i18n-attr]').forEach(el => {
      el.dataset.i18nAttr.split(',').forEach(pair => {
        const [attr, key] = pair.split(':').map(s => s.trim());
        const v = t(key);
        if (v !== undefined) el.setAttribute(attr, v);
      });
    });
    $$('[data-i18n-list]').forEach(el => {
      const items = t(el.dataset.i18nList) || [];
      el.innerHTML = items.map(i => `<li>${esc(i)}</li>`).join('');
    });
    $$('.langs button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
    $$('a[data-keep-lang]').forEach(a => {
      const url = new URL(a.getAttribute('href'), location.href);
      url.searchParams.set('lang', lang);
      a.setAttribute('href', url.pathname.split('/').pop() + url.search + url.hash);
    });
    if (new URLSearchParams(location.search).has('lang')) {
      const url = new URL(location.href);
      url.searchParams.set('lang', lang);
      history.replaceState(null, '', url);
    }
    movePill();
    document.dispatchEvent(new CustomEvent('langchange'));
  }

  $$('.langs button').forEach(b => b.addEventListener('click', () => applyLang(b.dataset.lang, true)));
  addEventListener('resize', movePill);
  if (document.fonts) document.fonts.ready.then(movePill);
  applyLang(pickLang(), false);

  /* ---------- Nav: scroll state, progress, mobile menu, active link ---------- */
  const nav = $('.nav');
  const progress = $('.progress');
  const onScroll = () => {
    if (nav) nav.classList.toggle('scrolled', scrollY > 8);
    if (progress) {
      const max = document.documentElement.scrollHeight - innerHeight;
      progress.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
    }
  };
  onScroll();
  addEventListener('scroll', onScroll, { passive: true });

  const menuBtn = $('.menu-btn');
  const closeMenu = () => { nav.classList.remove('open'); menuBtn && menuBtn.setAttribute('aria-expanded', 'false'); };
  if (menuBtn) {
    menuBtn.addEventListener('click', () => {
      const open = !nav.classList.contains('open');
      nav.classList.toggle('open', open);
      menuBtn.setAttribute('aria-expanded', String(open));
    });
    $$('.nav-links a').forEach(a => a.addEventListener('click', closeMenu));
    addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
    document.addEventListener('click', e => { if (!nav.contains(e.target)) closeMenu(); });
  }

  const navLinks = $$('.nav-links a');
  if (navLinks.length && 'IntersectionObserver' in window) {
    const so = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) navLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id));
    }), { rootMargin: '-45% 0px -50% 0px' });
    $$('section[id]').forEach(s => so.observe(s));
  }

  /* ---------- Marquee ---------- */
  const track = $('.marquee .track');
  const buildMarquee = () => {
    if (!track) return;
    const words = t('traits') || [];
    const html = words.map(w => `<span>${esc(w)}</span>`).join('');
    track.innerHTML = html + html;
  };
  buildMarquee();
  document.addEventListener('langchange', buildMarquee);

  /* ---------- Rotating roles (typewriter) ---------- */
  const word = $('.rotator .word');
  if (word) {
    let i = 0, timer;
    const words = () => t('hero.roles') || [];
    const run = () => {
      clearTimeout(timer);
      const list = words();
      if (reduceMotion) {
        word.textContent = list[i % list.length];
        timer = setTimeout(() => { i++; run(); }, 2600);
        return;
      }
      const target = list[i % list.length];
      let n = 0, deleting = false;
      const step = () => {
        word.textContent = target.slice(0, n);
        if (!deleting && n < target.length) { n++; timer = setTimeout(step, 70); }
        else if (!deleting) { deleting = true; timer = setTimeout(step, 1800); }
        else if (n > 0) { n--; timer = setTimeout(step, 35); }
        else { i++; timer = setTimeout(run, 250); }
      };
      step();
    };
    run();
    document.addEventListener('langchange', () => { i = 0; run(); });
  }

  /* ---------- Photo stack ---------- */
  const stack = $('.stack');
  if (stack) {
    const photos = $$('.photo', stack);
    const dots = $$('.dots-nav button');
    let busy = false, startX = null, swiped = false;
    const topIndex = () => photos.findIndex(p => p.dataset.pos === '0');
    const sync = () => {
      const top = topIndex();
      dots.forEach((d, i) => d.setAttribute('aria-current', String(i === top)));
      photos.forEach(p => p.setAttribute('aria-hidden', String(p.dataset.pos !== '0')));
    };
    const next = (dir = 1) => {
      if (busy) return;
      busy = true;
      const top = photos[topIndex()];
      top.classList.add('throw');
      top.classList.toggle('left', dir < 0);
      setTimeout(() => {
        photos.forEach(p => { p.dataset.pos = String((+p.dataset.pos + 2) % 3); });
        top.classList.remove('throw', 'left');
        sync();
        setTimeout(() => { busy = false; }, 250);
      }, reduceMotion ? 0 : 380);
    };
    const goTo = i => {
      photos.forEach((p, j) => { p.dataset.pos = String((j - i + 3) % 3); });
      sync();
    };
    stack.addEventListener('click', () => { if (swiped) { swiped = false; return; } next(1); });
    stack.addEventListener('pointerdown', e => { startX = e.clientX; swiped = false; });
    stack.addEventListener('pointerup', e => {
      if (startX === null) return;
      const dx = e.clientX - startX;
      startX = null;
      if (Math.abs(dx) > 40) { swiped = true; next(dx > 0 ? 1 : -1); }
    });
    stack.addEventListener('pointercancel', () => { startX = null; });
    dots.forEach((d, i) => d.addEventListener('click', () => goTo(i)));
    sync();
  }

  /* hero glow follows the pointer */
  const hero = $('.hero');
  if (hero && finePointer && !reduceMotion) {
    hero.addEventListener('pointermove', e => {
      const r = hero.getBoundingClientRect();
      hero.style.setProperty('--gx', ((e.clientX - r.left) / r.width * 100) + '%');
      hero.style.setProperty('--gy', ((e.clientY - r.top) / r.height * 100) + '%');
    });
  }

  /* ---------- Hobby chips: emoji burst ---------- */
  $$('.tag').forEach(tag => tag.addEventListener('click', () => {
    const on = tag.getAttribute('aria-pressed') !== 'true';
    tag.setAttribute('aria-pressed', String(on));
    if (!on || reduceMotion) return;
    const r = tag.getBoundingClientRect();
    for (let k = 0; k < 7; k++) {
      const s = document.createElement('span');
      s.className = 'burst';
      s.textContent = tag.dataset.emoji;
      s.style.left = (r.left + r.width / 2 - 11) + 'px';
      s.style.top = (r.top - 6) + 'px';
      const a = (Math.PI * 2 * k) / 7 - Math.PI / 2;
      s.style.setProperty('--bx', Math.cos(a) * (50 + Math.random() * 30) + 'px');
      s.style.setProperty('--by', Math.sin(a) * (50 + Math.random() * 30) - 30 + 'px');
      s.style.setProperty('--br', (Math.random() * 80 - 40) + 'deg');
      document.body.appendChild(s);
      s.addEventListener('animationend', () => s.remove());
    }
  }));

  /* ---------- Work accordion ---------- */
  $$('.job-head').forEach(btn => btn.addEventListener('click', () => {
    const job = btn.closest('.job');
    const open = job.dataset.open !== 'true';
    job.dataset.open = String(open);
    btn.setAttribute('aria-expanded', String(open));
  }));

  /* ---------- Language levels ---------- */
  const langCard = $('#lang');
  const labelLevels = () => $$('#lang .row').forEach(row => {
    $('.lvl-dots', row).setAttribute('aria-label', (t('lang.level') || '').replace('{n}', row.dataset.level));
  });
  if (langCard) {
    $$('.row', langCard).forEach(row => {
      const dots = $('.lvl-dots', row);
      for (let k = 0; k < 5; k++) {
        const d = document.createElement('i');
        if (k < +row.dataset.level) d.className = 'on';
        d.style.transitionDelay = (k * 90) + 'ms';
        dots.appendChild(d);
      }
      row.addEventListener('click', () => {
        $$('.row', langCard).forEach(r => r !== row && r.classList.remove('say'));
        row.classList.toggle('say');
      });
    });
    labelLevels();
    document.addEventListener('langchange', labelLevels);
  }

  /* ---------- Tilt cards ---------- */
  if (finePointer && !reduceMotion) {
    $$('.role').forEach(card => {
      card.addEventListener('pointermove', e => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - .5;
        const y = (e.clientY - r.top) / r.height - .5;
        card.classList.add('tilting');
        card.style.setProperty('--ry', (x * 10) + 'deg');
        card.style.setProperty('--rx', (-y * 10) + 'deg');
      });
      card.addEventListener('pointerleave', () => {
        card.classList.remove('tilting');
        card.style.setProperty('--ry', '0deg');
        card.style.setProperty('--rx', '0deg');
      });
    });
  }

  /* ---------- Flip cards ---------- */
  $$('.flip').forEach(f => f.addEventListener('click', () => {
    f.setAttribute('aria-pressed', String(f.getAttribute('aria-pressed') !== 'true'));
  }));

  /* ---------- Copy email ---------- */
  const toast = $('.toast');
  let toastTimer;
  const showToast = msg => {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2200);
  };
  $$('.copy').forEach(btn => btn.addEventListener('click', async () => {
    const text = btn.dataset.copy;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch { /* ignore */ }
      ta.remove();
    }
    showToast(t('contact.copied'));
  }));

  /* ---------- Reveal on scroll ---------- */
  const fillBars = () => $$('#lang .row').forEach(r => { $('.bar b', r).style.width = (r.dataset.level * 20) + '%'; });
  const reveal = $$('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      if (e.target.id === 'lang') fillBars();
      io.unobserve(e.target);
    }), { threshold: 0.15 });
    reveal.forEach((el, i) => { el.style.transitionDelay = (i % 4) * 70 + 'ms'; io.observe(el); });
  } else {
    reveal.forEach(el => el.classList.add('in'));
    fillBars();
  }

  const year = $('#year');
  if (year) year.textContent = new Date().getFullYear();
})();
