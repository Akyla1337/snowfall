/*
 * Снегопад — анимированные обои для Lively Wallpaper.
 * Падающий снег на HTML5 Canvas.
 *
 * Все параметры (количество, скорость, угол, размер, цвет снега и фона)
 * настраиваются в панели Lively Wallpaper — см. LivelyProperties.json.
 */

"use strict";

/* ---------- Настройки (значения по умолчанию = LivelyProperties.json) ---------- */
const config = {
  snowCount:   300,     // количество снежинок
  fallSpeed:   2.5,     // скорость падения (множитель)
  windAngle:   0,       // угол падения, °: -90 — влево, 0 — строго вниз, 90 — вправо
  swayAmount:  0.6,     // покачивание («живой» ветер)
  flakeSize:   4,       // базовый размер снежинки, px
  sizeSpread:  0.6,     // разброс размеров: 0 — все одинаковые, 1 — максимальный
  snowOpacity: 0.9,     // яркость снежинок
  snowColor:   "#ffffff",
  bgColor:     "#101b33",
  bgGradient:  false,   // плавное затемнение фона к низу экрана
};

/* ---------- Полотно ---------- */
const canvas = document.getElementById("snow");
const ctx = canvas.getContext("2d");
let W = 0, H = 0;
let bgFill = null; // кэш фонового градиента

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2); // не выше 2x — экономия GPU
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width  = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  canvas.style.width  = W + "px";
  canvas.style.height = H + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  bgFill = null; // градиент зависит от высоты — пересоздаём
}
window.addEventListener("resize", resize);

/* ---------- Цвета ---------- */
function hexToRgb(hex) {
  let h = String(hex || "").replace("#", "").trim();
  if (h.length === 3) h = h.split("").map(c => c + c).join("");
  if (h.length !== 6 && h.length !== 8) return { r: 255, g: 255, b: 255 };
  const n = parseInt(h.slice(0, 6), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbStr(c) {
  return "rgb(" + c.r + "," + c.g + "," + c.b + ")";
}
function darken(c, f) {
  return { r: Math.round(c.r * f), g: Math.round(c.g * f), b: Math.round(c.b * f) };
}

/* ---------- Спрайт снежинки (мягкий светящийся шар) ---------- */
const SPRITE = 128;
const sprite = document.createElement("canvas");
sprite.width = sprite.height = SPRITE;

function rebuildSprite() {
  const c = sprite.getContext("2d");
  const col = hexToRgb(config.snowColor);
  const half = SPRITE / 2;
  const g = c.createRadialGradient(half, half, 0, half, half, half);
  g.addColorStop(0.00, "rgba(" + col.r + "," + col.g + "," + col.b + ",1)");
  g.addColorStop(0.25, "rgba(" + col.r + "," + col.g + "," + col.b + ",0.9)");
  g.addColorStop(0.50, "rgba(" + col.r + "," + col.g + "," + col.b + ",0.4)");
  g.addColorStop(1.00, "rgba(" + col.r + "," + col.g + "," + col.b + ",0)");
  c.clearRect(0, 0, SPRITE, SPRITE);
  c.fillStyle = g;
  c.fillRect(0, 0, SPRITE, SPRITE);
}

/* ---------- Снежинки ---------- */
const flakes = [];

function makeFlake() {
  return {
    x: Math.random() * W,             // позиция
    y: Math.random() * H,
    z: Math.random(),                 // «глубина»: 0 — дальние, 1 — ближние
    phase: Math.random() * Math.PI * 2, // фаза покачивания
    freq: 0.5 + Math.random() * 1.2,    // частота покачивания
  };
}

function syncCount() {
  const n = Math.max(0, Math.round(config.snowCount));
  while (flakes.length < n) flakes.push(makeFlake());
  if (flakes.length > n) flakes.length = n; // лишние просто убираем
}

/* Размер и прозрачность считаются каждый кадр из текущих настроек —
   поэтому ползунки «Размер»/«Цвет»/«Яркость» применяются мгновенно. */
function flakeRadius(f) {
  const minF = 1 - 0.75 * config.sizeSpread; // во сколько раз мельче самая маленькая
  return Math.max(0.5, config.flakeSize * (minF + (1 - minF) * f.z));
}
function flakeAlpha(f) {
  return config.snowOpacity * (0.35 + 0.65 * f.z); // дальние — прозрачнее
}

/* ---------- Физика ---------- */
const MARGIN = 48; // запас за краем экрана, чтобы снежинка исчезала незаметно

function step(dt, t) {
  const a = config.windAngle * Math.PI / 180;
  const ax = Math.sin(a);        // горизонтальная составляющая направления
  const ay = Math.cos(a);        // вертикальная
  const base = config.fallSpeed * 60; // базовая скорость, px/с

  for (const f of flakes) {
    const depth = 0.35 + 0.9 * f.z; // ближние падают быстрее — эффект объёма
    const sway = config.swayAmount * 30 * (0.3 + 0.7 * f.z) *
                 Math.sin(t * f.freq + f.phase);
    f.x += (base * depth * ax + sway) * dt;
    f.y += base * depth * ay * dt;

    // зацикливание: улетевшая за край снежинка возвращается с противоположной
    if (f.y > H + MARGIN)      { f.y -= H + 2 * MARGIN; f.x = Math.random() * W; }
    else if (f.y < -MARGIN)    { f.y += H + 2 * MARGIN; f.x = Math.random() * W; }
    if (f.x > W + MARGIN)        f.x -= W + 2 * MARGIN;
    else if (f.x < -MARGIN)      f.x += W + 2 * MARGIN;
  }
}

/* ---------- Отрисовка ---------- */
function draw() {
  // фон
  if (config.bgGradient) {
    if (!bgFill) {
      const c = hexToRgb(config.bgColor);
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, rgbStr(c));
      g.addColorStop(1, rgbStr(darken(c, 0.5)));
      bgFill = g;
    }
    ctx.fillStyle = bgFill;
  } else {
    ctx.fillStyle = config.bgColor;
  }
  ctx.fillRect(0, 0, W, H);

  // снег
  for (const f of flakes) {
    const r = flakeRadius(f);
    ctx.globalAlpha = flakeAlpha(f);
    ctx.drawImage(sprite, f.x - r, f.y - r, r * 2, r * 2);
  }
  ctx.globalAlpha = 1;
}

/* ---------- Главный цикл ---------- */
let last = performance.now();
let elapsed = 0;

function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05); // защита от скачка после «сна»
  last = now;
  elapsed += dt;
  step(dt, elapsed);
  draw();
  requestAnimationFrame(frame);
}

/* ---------- Связь с Lively Wallpaper ----------
 * Lively вызывает эту функцию один раз при загрузке обоев (сохранённые
 * значения) и далее при каждом движении ползунка в панели настроек. */
function livelyPropertyListener(name, val) {
  switch (name) {
    case "snowCount":   config.snowCount   = Math.round(+val); syncCount(); break;
    case "fallSpeed":   config.fallSpeed   = +val; break;
    case "windAngle":   config.windAngle   = +val; break;
    case "swayAmount":  config.swayAmount  = +val; break;
    case "flakeSize":   config.flakeSize   = +val; break;
    case "sizeSpread":  config.sizeSpread  = +val; break;
    case "snowOpacity": config.snowOpacity = +val; break;
    case "snowColor":   config.snowColor   = String(val); rebuildSprite(); break;
    case "bgColor":     config.bgColor     = String(val); bgFill = null; break;
    case "bgGradient":  config.bgGradient  = !!val; bgFill = null; break;
  }
}

/* ---------- Запуск ---------- */
resize();
rebuildSprite();
syncCount();
requestAnimationFrame(frame);
