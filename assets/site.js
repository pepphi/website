(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const root = document.documentElement;
  const store = {
    get(k, s = localStorage) { try { return s.getItem(k); } catch { return null; } },
    set(k, v, s = localStorage) { try { s.setItem(k, v); } catch { /* storage unavailable */ } }
  };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hasGsap = !!(window.gsap && window.ScrollTrigger);
  const motion = hasGsap && !reduceMotion;
  if (!hasGsap) root.classList.add('no-gsap');
  if (hasGsap) gsap.registerPlugin(...[window.ScrollTrigger, window.SplitText].filter(Boolean));
  const refresh = () => hasGsap && ScrollTrigger.refresh();

  /* =========================================================
     Theme
     ========================================================= */
  $$('.theme-btn').forEach(btn => btn.addEventListener('click', () => {
    const current = root.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = current === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    store.set('theme', next);
  }));

  /* =========================================================
     Language
     ========================================================= */
  const LANGS = ['fi', 'en', 'sv'];
  const dict = window.I18N || {};
  let lang = 'fi';
  const t = key => (dict[lang] && dict[lang][key] !== undefined ? dict[lang][key] : (dict.fi || {})[key]);

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
    document.dispatchEvent(new CustomEvent('langwillchange'));
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
      el.innerHTML = (t(el.dataset.i18nList) || []).map(i => `<li>${esc(i)}</li>`).join('');
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

  $$('.langs button').forEach(b => b.addEventListener('click', () => { applyLang(b.dataset.lang, true); setTimeout(refresh, 60); }));
  addEventListener('resize', movePill);
  applyLang(pickLang(), false);

  /* =========================================================
     Smooth scroll (Lenis)
     ========================================================= */
  let lenis = null;
  if (motion && window.Lenis) {
    lenis = new Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 1 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(time => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  const scrollToTarget = target => {
    if (lenis) { lenis.scrollTo(target, { duration: 1.6, easing: x => 1 - Math.pow(1 - x, 4) }); return; }
    if (target === 0) scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    else target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
  };
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    const target = id === '#top' ? 0 : $(id);
    if (target === null) return;
    e.preventDefault();
    closeMenu();
    scrollToTarget(target);
    if (target !== 0) history.replaceState(null, '', id);
  });
  $$('.to-top').forEach(b => b.addEventListener('click', () => scrollToTarget(0)));

  /* =========================================================
     Nav: scrolled / hide on scroll down / progress / menu
     ========================================================= */
  const nav = $('.nav');
  const progress = $('.progress');
  let lastY = scrollY;
  const onScroll = () => {
    const y = scrollY;
    if (nav) {
      nav.classList.toggle('scrolled', y > 10);
      if (!root.classList.contains('menu-open')) nav.classList.toggle('hide', y > lastY && y > 300);
    }
    if (progress) {
      const max = document.documentElement.scrollHeight - innerHeight;
      progress.style.transform = `scaleX(${max > 0 ? Math.min(1, y / max) : 0})`;
    }
    lastY = y;
  };
  onScroll();
  addEventListener('scroll', onScroll, { passive: true });

  const menuBtn = $('.menu-btn');
  function closeMenu() {
    if (!root.classList.contains('menu-open')) return;
    root.classList.remove('menu-open');
    menuBtn && menuBtn.setAttribute('aria-expanded', 'false');
    $$('.menu-btn [data-i18n]').forEach(s => { s.dataset.i18n = 'nav.menu'; s.textContent = t('nav.menu'); });
    lenis && lenis.start();
  }
  if (menuBtn) {
    menuBtn.addEventListener('click', () => {
      if (root.classList.contains('menu-open')) { closeMenu(); return; }
      root.classList.add('menu-open');
      menuBtn.setAttribute('aria-expanded', 'true');
      $$('.menu-btn [data-i18n]').forEach(s => { s.dataset.i18n = 'nav.close'; s.textContent = t('nav.close'); });
      lenis && lenis.stop();
    });
    addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
    matchMedia('(min-width: 961px)').addEventListener('change', closeMenu);
  }

  const navLinks = $$('.nav-links a');
  if (navLinks.length && 'IntersectionObserver' in window) {
    const so = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) navLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id));
    }), { rootMargin: '-45% 0px -50% 0px' });
    $$('section[id]').forEach(s => so.observe(s));
  }

  /* =========================================================
     Helsinki clock
     ========================================================= */
  const times = $$('.time');
  if (times.length) {
    const fmt = new Intl.DateTimeFormat('fi-FI', { timeZone: 'Europe/Helsinki', hour: '2-digit', minute: '2-digit' });
    const tick = () => { const s = fmt.format(new Date()).replace('.', ':'); times.forEach(el => { el.textContent = s; }); };
    tick();
    setInterval(tick, 15000);
  }

  /* =========================================================
     Custom cursor + magnetic elements
     ========================================================= */
  const cursor = $('.cursor');
  if (cursor && finePointer && motion) {
    root.classList.add('has-cursor');
    cursor.classList.add('is-hidden');
    const ring = $('.cursor-ring', cursor), dot = $('.cursor-dot', cursor), label = $('.label', cursor);
    const rx = gsap.quickTo(ring, 'x', { duration: 0.5, ease: 'power3' });
    const ry = gsap.quickTo(ring, 'y', { duration: 0.5, ease: 'power3' });
    const dx = gsap.quickSetter(dot, 'x', 'px'), dy = gsap.quickSetter(dot, 'y', 'px');
    gsap.set([ring, dot], { x: innerWidth / 2, y: innerHeight / 2 });
    let labelKey = null;
    addEventListener('pointermove', e => { dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY); cursor.classList.remove('is-hidden'); }, { passive: true });
    document.addEventListener('pointerover', e => {
      const labelled = e.target.closest('[data-cursor]');
      const clickable = e.target.closest('a, button, [tabindex], .tag');
      if (labelled) {
        labelKey = labelled.dataset.cursor;
        label.textContent = t(labelKey) || '';
        cursor.classList.add('is-label'); cursor.classList.remove('is-link');
      } else {
        labelKey = null;
        cursor.classList.remove('is-label');
        cursor.classList.toggle('is-link', !!clickable);
      }
    });
    document.addEventListener('pointerdown', () => cursor.classList.add('is-down'));
    document.addEventListener('pointerup', () => cursor.classList.remove('is-down'));
    document.documentElement.addEventListener('pointerleave', () => cursor.classList.add('is-hidden'));
    document.addEventListener('langchange', () => { if (labelKey) label.textContent = t(labelKey) || ''; });
  }

  if (finePointer && motion) {
    $$('[data-magnetic]').forEach(el => {
      const strength = el.classList.contains('badge') ? 0.4 : 0.3;
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        gsap.to(el, { x: (e.clientX - r.left - r.width / 2) * strength, y: (e.clientY - r.top - r.height / 2) * strength, duration: 0.6, ease: 'power3.out' });
      });
      el.addEventListener('pointerleave', () => gsap.to(el, { x: 0, y: 0, duration: 1.1, ease: 'elastic.out(1, .35)' }));
    });
  }

  /* =========================================================
     Hero
     ========================================================= */
  // rotating role (typewriter)
  const word = $('.rotator .word');
  if (word) {
    let i = 0, timer;
    const run = () => {
      clearTimeout(timer);
      const list = t('hero.roles') || [];
      if (!list.length) return;
      if (reduceMotion) { word.textContent = list[i % list.length]; timer = setTimeout(() => { i++; run(); }, 2600); return; }
      const target = list[i % list.length];
      let n = 0, deleting = false;
      const step = () => {
        word.textContent = target.slice(0, n);
        if (!deleting && n < target.length) { n++; timer = setTimeout(step, 70); }
        else if (!deleting) { deleting = true; timer = setTimeout(step, 1900); }
        else if (n > 0) { n--; timer = setTimeout(step, 32); }
        else { i++; timer = setTimeout(run, 250); }
      };
      step();
    };
    run();
    document.addEventListener('langchange', () => { i = 0; run(); });
  }

  // rotating badge text
  const badgeText = $('.badge-text');
  const setBadge = () => {
    if (!badgeText) return;
    const s = (t('hero.cta1') || '').toUpperCase();
    badgeText.textContent = `${s} · ${s} · `;
    badgeText.setAttribute('textLength', '296');
    badgeText.setAttribute('lengthAdjust', 'spacing');
  };
  setBadge();
  document.addEventListener('langchange', setBadge);

  // photo cycler
  const photo = $('.hero-photo');
  if (photo) {
    const imgs = $$('img', photo);
    const now = $('.c-now', photo);
    let idx = 0, busy = false, startX = null, swiped = false;
    const show = dir => {
      if (busy) return;
      busy = true;
      const prev = imgs[idx];
      idx = (idx + dir + imgs.length) % imgs.length;
      const next = imgs[idx];
      next.hidden = false;
      prev.classList.replace('cur', 'prev');
      next.classList.add('cur');
      if (now) now.textContent = String(idx + 1).padStart(2, '0');
      const done = () => { prev.classList.remove('prev'); prev.hidden = true; busy = false; };
      if (motion) {
        gsap.fromTo(next, { clipPath: dir > 0 ? 'inset(100% 0% 0% 0%)' : 'inset(0% 0% 100% 0%)', scale: 1.25 },
          { clipPath: 'inset(0% 0% 0% 0%)', scale: 1, duration: 1.1, ease: 'expo.inOut', onComplete: done });
        gsap.to(prev, { scale: 1.1, duration: 1.1, ease: 'expo.inOut', clearProps: 'scale' });
      } else done();
    };
    photo.addEventListener('click', () => { if (swiped) { swiped = false; return; } show(1); });
    photo.addEventListener('pointerdown', e => { startX = e.clientX; swiped = false; });
    photo.addEventListener('pointerup', e => {
      if (startX === null) return;
      const d = e.clientX - startX; startX = null;
      if (Math.abs(d) > 40) { swiped = true; show(d < 0 ? 1 : -1); }
    });
    photo.addEventListener('pointercancel', () => { startX = null; });
  }

  // mouse parallax in hero
  const hero = $('.hero');
  if (hero && photo && finePointer && motion) {
    const px = gsap.quickTo(photo, 'x', { duration: 1, ease: 'power3' });
    const py = gsap.quickTo(photo, 'y', { duration: 1, ease: 'power3' });
    const tl1 = gsap.quickTo('.ht-1', 'x', { duration: 1.2, ease: 'power3' });
    const tl2 = gsap.quickTo('.ht-2', 'x', { duration: 1.2, ease: 'power3' });
    hero.addEventListener('pointermove', e => {
      const nx = e.clientX / innerWidth - 0.5, ny = e.clientY / innerHeight - 0.5;
      px(nx * 40); py(ny * 30); tl1(nx * -24); tl2(nx * 24);
    });
  }

  /* =========================================================
     Marquee (direction + speed follow the scroll)
     ========================================================= */
  const rows = $$('.marquee .row');
  let marqueeTweens = [];
  const buildMarquee = () => {
    if (!rows.length) return;
    marqueeTweens.forEach(tw => tw.kill());
    marqueeTweens = [];
    const words = t('traits') || [];
    rows.forEach((row, r) => {
      const list = r ? [...words].reverse() : words;
      const html = list.map(w => `<span>${esc(w)}</span>`).join('');
      row.innerHTML = html + html;
      if (motion) {
        gsap.set(row, { xPercent: r ? -50 : 0 });
        marqueeTweens.push(gsap.to(row, { xPercent: r ? 0 : -50, duration: 46, ease: 'none', repeat: -1 }));
      }
    });
  };
  buildMarquee();
  document.addEventListener('langchange', buildMarquee);
  if (motion && rows.length) {
    let speed = 1, dir = 1;
    gsap.ticker.add(() => {
      const v = lenis ? lenis.velocity : 0;
      if (v > 0.1) dir = 1; else if (v < -0.1) dir = -1;
      const target = dir * (1 + Math.min(Math.abs(v) / 4, 6));
      speed += (target - speed) * 0.08;
      marqueeTweens.forEach(tw => tw.timeScale(speed));
    });
  }

  /* =========================================================
     About statement: words light up while scrolling
     ========================================================= */
  const statement = $('.statement');
  let stSplit = null, stTween = null;
  const buildStatement = () => {
    if (!statement || !motion || !window.SplitText) return;
    stSplit = new SplitText(statement, { type: 'words', wordsClass: 'word' });
    stTween = gsap.fromTo(stSplit.words, { opacity: 0.14 }, {
      opacity: 1, ease: 'none', stagger: 0.1,
      scrollTrigger: { trigger: statement, start: 'top 82%', end: 'bottom 45%', scrub: true }
    });
  };
  const killStatement = () => {
    if (stTween) { stTween.scrollTrigger && stTween.scrollTrigger.kill(); stTween.kill(); stTween = null; }
    if (stSplit) { stSplit.revert(); stSplit = null; }
  };
  buildStatement();
  document.addEventListener('langwillchange', killStatement);
  document.addEventListener('langchange', buildStatement);

  /* =========================================================
     Horizontal world gallery
     ========================================================= */
  const pin = $('.world-pin');
  const scroller = $('.world-scroller');
  const track = $('.world-track');
  const worldBar = $('.world-progress b');
  if (pin && track) {
    const swipeMode = () => {
      scroller.classList.add('swipe');
      const upd = () => {
        const max = scroller.scrollWidth - scroller.clientWidth;
        if (worldBar) worldBar.style.transform = `scaleX(${max > 0 ? scroller.scrollLeft / max : 0})`;
      };
      scroller.addEventListener('scroll', upd, { passive: true });
      upd();
      return () => { scroller.classList.remove('swipe'); scroller.removeEventListener('scroll', upd); };
    };
    if (motion) {
      const mm = gsap.matchMedia();
      mm.add('(min-width: 901px)', () => {
        const dist = () => Math.max(0, track.scrollWidth - innerWidth);
        const tween = gsap.to(track, {
          x: () => -dist(), ease: 'none',
          scrollTrigger: {
            trigger: pin, start: 'center center', end: () => '+=' + dist(), pin: true, scrub: 1, invalidateOnRefresh: true, anticipatePin: 1,
            onUpdate: self => { if (worldBar) worldBar.style.transform = `scaleX(${self.progress})`; }
          }
        });
        $$('.panel.photo img', track).forEach(img => {
          gsap.fromTo(img, { xPercent: -7 }, { xPercent: 7, ease: 'none', scrollTrigger: { trigger: img.parentNode, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true } });
        });
        $$('.panel.story .emo', track).forEach(e => {
          gsap.fromTo(e, { rotate: -20, scale: 0.6 }, { rotate: 0, scale: 1, ease: 'back.out(2)', scrollTrigger: { trigger: e.closest('.panel'), containerAnimation: tween, start: 'left 85%', end: 'left 45%', scrub: true } });
        });
      });
      mm.add('(max-width: 900px)', swipeMode);
    } else swipeMode();
  }

  /* =========================================================
     Work list: accordion + floating preview card
     ========================================================= */
  $$('.work-item').forEach(item => {
    const btn = $('.work-row', item);
    btn.addEventListener('click', () => {
      const open = !item.classList.contains('open');
      item.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', String(open));
      setTimeout(refresh, 650);
    });
  });
  const preview = $('.work-preview');
  const workList = $('.work-list');
  if (preview && workList && finePointer && motion) {
    const qx = gsap.quickTo(preview, 'x', { duration: 0.7, ease: 'power3' });
    const qy = gsap.quickTo(preview, 'y', { duration: 0.7, ease: 'power3' });
    gsap.set(preview, { x: innerWidth / 2, y: innerHeight / 2 });
    workList.addEventListener('pointermove', e => { qx(e.clientX); qy(e.clientY); });
    $$('.work-item', workList).forEach(item => {
      $('.work-row', item).addEventListener('pointerenter', () => {
        $('.emo', preview).textContent = item.dataset.emoji;
        $('ul', preview).innerHTML = $$('.work-body li', item).map(li => `<li>${esc(li.textContent)}</li>`).join('');
        preview.className = 'work-preview show c' + item.dataset.c;
      });
    });
    workList.addEventListener('pointerleave', () => preview.classList.remove('show'));
  }

  /* =========================================================
     Language rings
     ========================================================= */
  const rings = $$('.ring');
  const fillRings = () => rings.forEach(r => { $('.val', r).style.strokeDashoffset = String(276.46 * (1 - r.dataset.level / 5)); });
  rings.forEach(r => r.addEventListener('click', () => { rings.forEach(o => o !== r && o.classList.remove('say')); r.classList.toggle('say'); }));
  if (rings.length) {
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { fillRings(); io.disconnect(); } }, { threshold: 0.3 });
      io.observe($('#lang'));
    } else fillRings();
  }

  /* =========================================================
     Stacking cards
     ========================================================= */
  const cards = $$('.scard');
  if (motion && cards.length > 1) {
    cards.forEach((card, i) => {
      if (i === cards.length - 1) return;
      gsap.to(card, {
        scale: 1 - (cards.length - i) * 0.035, ease: 'none',
        scrollTrigger: { trigger: cards[i + 1], start: 'top bottom', end: 'top 30%', scrub: true }
      });
    });
  }

  /* =========================================================
     Draggable notes
     ========================================================= */
  const board = $('.board');
  if (board) {
    const canDrag = () => finePointer && innerWidth > 760;
    let z = 10;
    $$('.note', board).forEach(note => {
      let sx = 0, sy = 0, ox = 0, oy = 0, dragging = false;
      note.addEventListener('pointerdown', e => {
        if (!canDrag()) return;
        e.preventDefault();
        note.setPointerCapture(e.pointerId);
        dragging = true;
        sx = e.clientX; sy = e.clientY;
        ox = parseFloat(note.style.getPropertyValue('--dx')) || 0;
        oy = parseFloat(note.style.getPropertyValue('--dy')) || 0;
        note.style.zIndex = ++z;
        note.classList.add('dragging');
      });
      note.addEventListener('pointermove', e => {
        if (!dragging) return;
        const minX = -note.offsetLeft, maxX = board.clientWidth - note.offsetLeft - note.offsetWidth;
        const minY = -note.offsetTop + 12, maxY = board.clientHeight - note.offsetTop - note.offsetHeight;
        const nx = Math.min(maxX, Math.max(minX, ox + e.clientX - sx));
        const ny = Math.min(maxY, Math.max(minY, oy + e.clientY - sy));
        note.style.setProperty('--dx', nx + 'px');
        note.style.setProperty('--dy', ny + 'px');
      });
      const end = () => {
        if (!dragging) return;
        dragging = false;
        note.classList.remove('dragging');
        note.style.setProperty('--r', (Math.random() * 14 - 7).toFixed(1) + 'deg');
      };
      note.addEventListener('pointerup', end);
      note.addEventListener('pointercancel', end);
    });
    if (motion) {
      gsap.from($$('.note', board), {
        y: -120, opacity: 0, rotate: () => Math.random() * 40 - 20, duration: 1.2, ease: 'back.out(1.6)', stagger: 0.12, clearProps: 'transform,opacity',
        scrollTrigger: { trigger: board, start: 'top 75%', once: true }
      });
    }
  }

  /* =========================================================
     Hobby chips: emoji burst
     ========================================================= */
  $$('.tag').forEach(tag => tag.addEventListener('click', () => {
    const on = tag.getAttribute('aria-pressed') !== 'true';
    tag.setAttribute('aria-pressed', String(on));
    if (!on || reduceMotion) return;
    const r = tag.getBoundingClientRect();
    for (let k = 0; k < 8; k++) {
      const s = document.createElement('span');
      s.className = 'burst';
      s.textContent = tag.dataset.emoji;
      s.style.left = (r.left + r.width / 2 - 11) + 'px';
      s.style.top = (r.top - 6) + 'px';
      const a = (Math.PI * 2 * k) / 8 - Math.PI / 2;
      s.style.setProperty('--bx', Math.cos(a) * (50 + Math.random() * 40) + 'px');
      s.style.setProperty('--by', Math.sin(a) * (50 + Math.random() * 40) - 30 + 'px');
      s.style.setProperty('--br', (Math.random() * 80 - 40) + 'deg');
      document.body.appendChild(s);
      s.addEventListener('animationend', () => s.remove());
    }
  }));

  /* =========================================================
     Copy email + toast
     ========================================================= */
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
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch { /* ignore */ }
      ta.remove();
    }
    showToast(t('contact.copied'));
  }));

  /* =========================================================
     Scroll reveals
     ========================================================= */
  const sig = $('.sig');
  if (motion) {
    $$('.reveal').forEach(el => {
      gsap.set(el, { opacity: 0, y: 46 });
      ScrollTrigger.create({
        trigger: el, start: 'top 92%', once: true,
        onEnter: () => gsap.to(el, { opacity: 1, y: 0, duration: 1.2, ease: 'expo.out' })
      });
    });
    $$('.contact h2').forEach(h => gsap.from($$('.line', h), {
      yPercent: 115, rotate: 3, duration: 1.4, ease: 'expo.out', stagger: 0.12,
      scrollTrigger: { trigger: h, start: 'top 88%', once: true }
    }));
    if (sig) ScrollTrigger.create({ trigger: sig, start: 'top 95%', once: true, onEnter: () => sig.classList.add('in') });
  } else if (sig) {
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(es => { if (es[0].isIntersecting) { sig.classList.add('in'); io.disconnect(); } });
      io.observe(sig);
    } else sig.classList.add('in');
  }

  /* =========================================================
     Intro: loader on first visit, curtain otherwise
     ========================================================= */
  const loader = $('.loader');
  const curtain = $('.curtain');
  const finish = () => { clearTimeout(window.__introFailsafe); root.classList.add('intro-done'); };

  const heroIn = () => {
    if (!motion || !$('.hero-title')) return;
    const chars = [];
    $$('.hero-title .ht').forEach(line => {
      if (window.SplitText) chars.push(...new SplitText(line, { type: 'chars', charsClass: 'char' }).chars);
      else chars.push(line);
    });
    const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
    tl.from(chars, { yPercent: 115, rotate: 6, duration: 1.5, stagger: 0.035 })
      .from('.hero-photo .frame', { clipPath: 'inset(100% 0% 0% 0%)', scale: 1.15, duration: 1.6, ease: 'expo.inOut' }, 0.1)
      .from('.hero-photo .frame img.cur', { scale: 1.4, duration: 2, ease: 'expo.out' }, 0.3)
      .from(['.hero-meta', '.hero-bottom > *', '.hero-photo .count', '.hero-photo .hint', '.nav'], { y: 24, opacity: 0, duration: 1.1, stagger: 0.06 }, 0.5);
  };

  if (!motion) {
    loader && loader.remove();
    curtain && curtain.remove();
    finish();
  } else if (loader && !store.get('introSeen', sessionStorage)) {
    store.set('introSeen', '1', sessionStorage);
    curtain && gsap.set(curtain, { yPercent: -100 });
    lenis && lenis.stop();
    const count = $('.l-count', loader);
    const counter = { v: 0 };
    gsap.timeline({ onComplete: () => { loader.remove(); lenis && lenis.start(); finish(); } })
      .from('.l-logo', { scale: 0.5, rotate: -30, opacity: 0, duration: 1.1, ease: 'expo.out' })
      .from('.l-hello, .l-top, .l-bottom', { y: 20, opacity: 0, duration: 0.8, stagger: 0.08, ease: 'expo.out' }, 0.15)
      .to(counter, { v: 100, duration: 1.6, ease: 'power2.inOut', onUpdate: () => { count.textContent = Math.round(counter.v); } }, 0.1)
      .to('.l-bar', { scaleX: 1, duration: 1.6, ease: 'power2.inOut' }, 0.1)
      .to('.l-center', { y: -40, opacity: 0, duration: 0.6, ease: 'power3.in' }, 1.8)
      .to(loader, { yPercent: -100, duration: 1.1, ease: 'expo.inOut' }, 2)
      .add(heroIn, 2.35);
  } else {
    loader && loader.remove();
    if (curtain) {
      gsap.to(curtain, { yPercent: -100, duration: 1, ease: 'expo.inOut', delay: 0.1, onComplete: finish });
      gsap.delayedCall(0.45, heroIn);
    } else { finish(); heroIn(); }
  }

  // page transition to other pages
  if (motion && curtain) {
    $$('a[data-transition], a[data-keep-lang]').forEach(a => a.addEventListener('click', e => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0 || a.target === '_blank') return;
      const href = a.getAttribute('href');
      if (!href || href.startsWith('#')) return;
      e.preventDefault();
      gsap.fromTo(curtain, { yPercent: 100 }, { yPercent: 0, duration: 0.8, ease: 'expo.inOut', onComplete: () => { location.href = href; } });
    }));
    addEventListener('pageshow', e => { if (e.persisted) gsap.set(curtain, { yPercent: -100 }); });
  }

  /* =========================================================
     Misc
     ========================================================= */
  const year = $('#year');
  if (year) year.textContent = new Date().getFullYear();
  if (document.fonts) document.fonts.ready.then(() => { movePill(); refresh(); });
  addEventListener('load', refresh);
})();
