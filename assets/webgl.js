/*
  WebGL effects (three.js):
  1. Hero photo: liquid ripple that follows the mouse + noise-dissolve transition between photos.
  2. Contact: a gold 3D medallion of the logo that spins on drag and while scrolling.
  Both fall back to the plain images when WebGL is unavailable or the visitor prefers reduced motion.
*/
import * as THREE from './vendor/three.min.js';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const gsap = window.gsap;

function webglSupported() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

// Render only while the element is on screen.
function whenVisible(el, onChange, rootMargin = '0px') {
  if (!('IntersectionObserver' in window)) { onChange(true); return; }
  new IntersectionObserver(entries => onChange(entries[0].isIntersecting), { rootMargin }).observe(el);
}

function tween(target, vars) {
  if (gsap) return gsap.to(target, vars);
  Object.assign(target, Object.fromEntries(Object.entries(vars).filter(([k]) => k === 'value')));
  if (vars.onComplete) vars.onComplete();
  return null;
}

/* =========================================================
   1. Hero photo
   ========================================================= */
const HERO_VERT = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position, 1.0); }
`;
const HERO_FRAG = /* glsl */`
  precision highp float;
  uniform sampler2D uTex0;
  uniform sampler2D uTex1;
  uniform float uProgress;
  uniform float uHover;
  uniform float uTime;
  uniform float uDir;
  uniform vec2 uMouse;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  vec3 sampleMix(vec2 uv, float n, float m) {
    vec2 uv0 = uv + vec2(0.0, uProgress * 0.18 * n * uDir);
    vec2 uv1 = uv - vec2(0.0, (1.0 - uProgress) * 0.18 * n * uDir);
    return mix(texture2D(uTex0, uv0).rgb, texture2D(uTex1, uv1).rgb, m);
  }
  void main() {
    vec2 uv = vUv;
    vec2 toM = uv - uMouse;
    float d = length(toM);
    vec2 dirM = normalize(toM + 1e-5);
    float falloff = smoothstep(0.5, 0.0, d) * uHover;

    // liquid ripple around the cursor + slow breathing warp
    uv += dirM * sin(d * 40.0 - uTime * 5.0) * 0.011 * falloff;
    uv += (vec2(noise(uv * 3.0 + uTime * 0.15), noise(uv * 3.0 - uTime * 0.12)) - 0.5) * 0.014 * uHover;

    // noise-dissolve transition from uTex0 to uTex1
    float n = noise(uv * 5.0 + 3.0);
    float v = mix(uDir > 0.0 ? 1.0 - uv.y : uv.y, n, 0.4);
    float p = uProgress * 1.3 - 0.15;
    float m = 1.0 - smoothstep(p - 0.12, p + 0.12, v);

    // tiny chromatic split near the cursor
    vec2 shift = dirM * 0.005 * falloff;
    vec3 col;
    col.r = sampleMix(uv + shift, n, m).r;
    col.g = sampleMix(uv, n, m).g;
    col.b = sampleMix(uv - shift, n, m).b;

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

async function initHero() {
  const photo = document.querySelector('.hero-photo');
  const frame = photo && photo.querySelector('.frame');
  if (!frame) return;
  const imgs = [...frame.querySelectorAll('img')];

  const canvas = document.createElement('canvas');
  canvas.className = 'gl';
  canvas.setAttribute('aria-hidden', 'true');
  frame.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const loader = new THREE.TextureLoader();
  const textures = await Promise.all(imgs.map(img => loader.loadAsync(img.getAttribute('src'))));
  textures.forEach(tex => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  });

  const uniforms = {
    uTex0: { value: textures[0] }, uTex1: { value: textures[0] },
    uProgress: { value: 0 }, uHover: { value: 0 }, uTime: { value: 0 }, uDir: { value: 1 },
    uMouse: { value: new THREE.Vector2(0.5, 0.5) }
  };
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms, vertexShader: HERO_VERT, fragmentShader: HERO_FRAG })));

  const resize = () => {
    const w = frame.clientWidth, h = frame.clientHeight;
    if (w && h) renderer.setSize(w, h, false);
  };
  resize();
  new ResizeObserver(resize).observe(frame);

  // mouse
  const target = new THREE.Vector2(0.5, 0.5);
  photo.addEventListener('pointermove', e => {
    const r = frame.getBoundingClientRect();
    target.set((e.clientX - r.left) / r.width, 1 - (e.clientY - r.top) / r.height);
  });
  photo.addEventListener('pointerenter', () => tween(uniforms.uHover, { value: 1, duration: 0.8, ease: 'power2.out' }));
  photo.addEventListener('pointerleave', () => tween(uniforms.uHover, { value: 0, duration: 1.2, ease: 'power2.out' }));

  // photo transitions (site.js announces the new index)
  let current = 0, active = null;
  document.addEventListener('photochange', e => {
    const next = e.detail.index;
    if (active) { active.kill(); uniforms.uTex0.value = textures[current]; }
    uniforms.uTex0.value = textures[current];
    uniforms.uTex1.value = textures[next];
    uniforms.uDir.value = e.detail.dir >= 0 ? 1 : -1;
    uniforms.uProgress.value = 0;
    current = next;
    active = tween(uniforms.uProgress, {
      value: 1, duration: 1.4, ease: 'expo.inOut',
      onComplete: () => { uniforms.uTex0.value = textures[next]; uniforms.uProgress.value = 0; active = null; }
    });
  });

  const start = performance.now();
  const render = () => {
    uniforms.uTime.value = (performance.now() - start) / 1000;
    uniforms.uMouse.value.lerp(target, 0.08);
    renderer.render(scene, camera);
  };
  render();
  canvas.classList.add('ready');
  whenVisible(frame, visible => renderer.setAnimationLoop(visible ? render : null));
}

/* =========================================================
   2. Gold medallion
   ========================================================= */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function faceTexture(draw) {
  const size = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size * 0.42, size * 0.38, size * 0.05, size / 2, size / 2, size / 2);
  grad.addColorStop(0, '#fbf6ec');
  grad.addColorStop(1, '#e4d4b6');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  g.strokeStyle = '#b8893f';
  g.lineWidth = 10;
  g.beginPath(); g.arc(size / 2, size / 2, size * 0.455, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 3;
  g.beginPath(); g.arc(size / 2, size / 2, size * 0.43, 0, Math.PI * 2); g.stroke();
  draw(g, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

async function initMedal() {
  const host = document.querySelector('.medal');
  if (!host) return;

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  camera.position.set(0, 0, 6.2);

  const key = new THREE.DirectionalLight(0xfff1dc, 1.6);
  key.position.set(3, 4, 5);
  scene.add(key, new THREE.AmbientLight(0xffffff, 0.25));

  // textures for the two faces
  const logo = await loadImage(host.dataset.logo);
  if (document.fonts) await Promise.all([document.fonts.load('italic 200px Fraunces'), document.fonts.load('600 40px Outfit')]).catch(() => {});
  const front = faceTexture((g, s) => { const w = s * 0.86; g.drawImage(logo, (s - w) / 2, (s - w) / 2, w, w); });
  const back = faceTexture((g, s) => {
    g.fillStyle = '#9a6a2a';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = 'italic 300 210px Fraunces, Georgia, serif';
    g.fillText('Peppi', s / 2, s * 0.47);
    g.font = '600 38px Outfit, sans-serif';
    g.fillText('H E L S I N K I  ·  2 0 2 6', s / 2, s * 0.64);
  });
  // cylinder caps map UVs sideways; turn both faces upright
  front.center.set(0.5, 0.5);
  front.rotation = Math.PI / 2;
  back.center.set(0.5, 0.5);
  back.rotation = Math.PI / 2;

  const gold = new THREE.MeshStandardMaterial({ color: 0xd2a55a, metalness: 1, roughness: 0.24 });
  const faceFront = new THREE.MeshStandardMaterial({ map: front, metalness: 0.25, roughness: 0.42 });
  const faceBack = new THREE.MeshStandardMaterial({ map: back, metalness: 0.25, roughness: 0.42 });

  const coin = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.16, 128, 1), [gold, faceFront, faceBack]);
  body.rotation.x = Math.PI / 2;
  coin.add(body);
  [0.08, -0.08].forEach(z => {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.985, 0.045, 24, 160), gold);
    rim.position.z = z;
    coin.add(rim);
  });
  scene.add(coin);

  const resize = () => {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  new ResizeObserver(resize).observe(host);

  // interaction: drag to spin (with inertia), tilt toward the pointer, spin with scroll speed
  let spin = 0.6, velocity = 0.012, dragging = false, lastX = 0, tiltX = 0, tiltY = 0, lastScroll = scrollY;
  canvas.addEventListener('pointerdown', e => {
    dragging = true; lastX = e.clientX;
    canvas.setPointerCapture(e.pointerId);
    document.dispatchEvent(new CustomEvent('medalgrab'));
  });
  canvas.addEventListener('pointermove', e => {
    const r = canvas.getBoundingClientRect();
    tiltX = ((e.clientY - r.top) / r.height - 0.5) * 0.5;
    tiltY = ((e.clientX - r.left) / r.width - 0.5) * 0.5;
    if (!dragging) return;
    velocity = (e.clientX - lastX) * 0.006;
    spin += velocity;
    lastX = e.clientX;
  });
  const release = () => { dragging = false; };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  canvas.addEventListener('pointerleave', () => { tiltX = tiltY = 0; });

  const render = () => {
    const ds = scrollY - lastScroll;
    lastScroll = scrollY;
    if (!dragging) {
      velocity += ds * 0.00012;
      velocity *= 0.96;
      velocity += (0.008 - velocity) * 0.02; // settle into a slow idle spin
      spin += velocity;
    }
    coin.rotation.y = spin;
    coin.rotation.x += (tiltX - coin.rotation.x) * 0.06;
    coin.rotation.z += (-tiltY * 0.3 - coin.rotation.z) * 0.06;
    coin.position.y = Math.sin(performance.now() / 1400) * 0.05;
    renderer.render(scene, camera);
  };
  render();
  host.classList.add('gl-ready');
  whenVisible(host, visible => renderer.setAnimationLoop(visible ? render : null));
}

if (!reduceMotion && webglSupported()) {
  initHero().catch(err => console.warn('Hero WebGL disabled:', err));
  const medal = document.querySelector('.medal');
  if (medal) whenVisible(medal, function once(visible) {
    if (!visible || medal.dataset.started) return;
    medal.dataset.started = '1';
    initMedal().catch(err => console.warn('Medal WebGL disabled:', err));
  }, '600px');
}
