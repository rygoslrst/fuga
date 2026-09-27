// ============================================================================
//  Atlas.js — TODA la gráfica del juego en una sola textura, generada al cargar
// ----------------------------------------------------------------------------
//  Personaje, obstáculos, ciudad de fondo, cielo, partículas y tipografía se
//  dibujan con código en un canvas oculto. Con una única textura la placa de
//  video dibuja la escena entera en muy pocas llamadas: es la decisión que más
//  rinde en un celular de gama baja.
//
//  Todo se dibuja en BLANCO y se colorea en el juego con tint, salvo el cielo,
//  que ya viene con su degradé.
// ============================================================================

import { cuadrosDelPersonaje } from './Esqueleto.js';
import { COLOR } from '../config.js';

// roundRect no existe en Safari anterior a la 16: en esos teléfonos, esquinas rectas.
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h) { this.rect(x, y, w, h); };
}

const ANCHO_ATLAS = 2048;
const MARGEN = 2;          // píxeles vacíos entre piezas: evita que se "filtre" la vecina

// Generador pseudoaleatorio con semilla: la ciudad de fondo sale igual siempre.
function azar(semilla) {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hex = c => '#' + c.toString(16).padStart(6, '0');

function recortar(ctx, fn) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  fn();
  ctx.restore();
}

// ----------------------------------------------------------------------------
//  Obstáculos (siluetas con detalles calados: por los huecos se ve el cielo)
// ----------------------------------------------------------------------------
function caja(ctx, x, y) {
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.roundRect(x + 1, y + 1, 46, 44, 3); ctx.fill();
  recortar(ctx, () => {
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 7, y + 7, 34, 32);
    ctx.beginPath();
    ctx.moveTo(x + 8, y + 8); ctx.lineTo(x + 40, y + 38);
    ctx.moveTo(x + 40, y + 8); ctx.lineTo(x + 8, y + 38);
    ctx.stroke();
  });
}

function ventilacion(ctx, x, y) {
  ctx.fillStyle = '#fff';
  ctx.fillRect(x + 5, y + 11, 44, 31);
  ctx.beginPath();
  ctx.moveTo(x, y + 4); ctx.lineTo(x + 54, y + 4); ctx.lineTo(x + 49, y + 13); ctx.lineTo(x + 5, y + 13);
  ctx.closePath(); ctx.fill();
  recortar(ctx, () => {
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (const yy of [20, 26, 32]) { ctx.moveTo(x + 11, y + yy); ctx.lineTo(x + 43, y + yy); }
    ctx.stroke();
  });
}

function maquina(ctx, x, y) {
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.roundRect(x + 1, y + 3, 60, 49, 3); ctx.fill();
  recortar(ctx, () => {
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x + 39, y + 27, 15, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let k = 0; k < 3; k++) {
      const a = k * 2.094;
      ctx.moveTo(x + 39, y + 27);
      ctx.lineTo(x + 39 + Math.cos(a) * 11, y + 27 + Math.sin(a) * 11);
    }
    for (const xx of [8, 13, 18]) { ctx.moveTo(x + xx, y + 12); ctx.lineTo(x + xx, y + 44); }
    ctx.stroke();
  });
}

// Cartel colgante: hay que pasar por DEBAJO. Es alto a propósito para que no se
// pueda saltar por encima. Las franjas se repiten cada 18 px, que divide 72:
// dos columnas seguidas forman un cartel continuo sin costura.
function cartel(ctx, x, y) {
  ctx.fillStyle = '#fff';
  ctx.fillRect(x, y, 72, 118);
  recortar(ctx, () => {
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y + 7); ctx.lineTo(x + 72, y + 7);
    ctx.moveTo(x, y + 76); ctx.lineTo(x + 72, y + 76);
    ctx.stroke();
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y + 82, 72, 30); ctx.clip();
    ctx.beginPath();
    for (let k = -2; k < 7; k++) {
      const bx = x + k * 18;
      ctx.moveTo(bx, y + 112); ctx.lineTo(bx + 9, y + 112); ctx.lineTo(bx + 39, y + 82); ctx.lineTo(bx + 30, y + 82);
      ctx.closePath();
    }
    ctx.fill();
    ctx.restore();
  });
}

// ----------------------------------------------------------------------------
//  La ciudad de fondo: dos franjas que se repiten sin costura
// ----------------------------------------------------------------------------
function skyline(ctx, x0, y0, W, H, semilla, hMin, hMax, conVentanas) {
  const r = azar(semilla);
  const edificios = [];
  let x = 0;
  while (x < W) {
    const w = 26 + r() * 74;
    edificios.push({ x, w, h: hMin + r() * (hMax - hMin), tipo: r() });
    x += w + (r() < 0.3 ? 2 + r() * 8 : 0);
  }
  ctx.save();
  ctx.beginPath(); ctx.rect(x0, y0, W, H); ctx.clip();
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#fff';
  const uno = (e, dx) => {
    const bx = x0 + e.x + dx, by = y0 + H - e.h;
    ctx.fillRect(bx, by, e.w, e.h + 1);
    if (e.tipo < 0.22) {                         // antena
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(bx + e.w * 0.6, by); ctx.lineTo(bx + e.w * 0.6, by - 14 - e.tipo * 90); ctx.stroke();
    } else if (e.tipo < 0.42) {                  // remate escalonado
      ctx.fillRect(bx + e.w * 0.2, by - 10, e.w * 0.6, 10);
      ctx.fillRect(bx + e.w * 0.35, by - 18, e.w * 0.3, 8);
    } else if (e.tipo < 0.58) {                  // tanque de agua
      const tx = bx + e.w * 0.25;
      ctx.fillRect(tx, by - 16, 16, 11);
      ctx.fillRect(tx + 2, by - 5, 2, 5); ctx.fillRect(tx + 12, by - 5, 2, 5);
    } else if (e.tipo < 0.66) {                  // aguja
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(bx + e.w / 2, by - 30); ctx.lineTo(bx + e.w, by); ctx.fill();
    }
    if (conVentanas) {
      recortar(ctx, () => {
        for (let vy = by + 8; vy < y0 + H - 6; vy += 11) {
          for (let vx = bx + 5; vx < bx + e.w - 7; vx += 8) {
            if (r() < 0.13) ctx.fillRect(vx, vy, 3, 5);
          }
        }
      });
    }
  };
  for (const e of edificios) {
    uno(e, 0);
    if (e.x + e.w > W) uno(e, -W);
  }
  ctx.restore();
}

// ----------------------------------------------------------------------------
//  Piezas sueltas
// ----------------------------------------------------------------------------
function radial(ctx, x, y, s, paradas) {
  const g = ctx.createRadialGradient(x + s / 2, y + s / 2, 0, x + s / 2, y + s / 2, s / 2);
  for (const [k, a] of paradas) g.addColorStop(k, `rgba(255,255,255,${a})`);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, s, s);
}

function piezasSueltas() {
  return [
    { nombre: 'blanco', w: 16, h: 16, interior: 4,
      dibujar: (c, x, y) => { c.fillStyle = '#fff'; c.fillRect(x, y, 16, 16); } },
    { nombre: 'punto', w: 16, h: 16, dibujar: (c, x, y) => radial(c, x, y, 16, [[0, 1], [0.45, 0.85], [1, 0]]) },
    { nombre: 'brillo', w: 64, h: 64, dibujar: (c, x, y) => radial(c, x, y, 64, [[0, 0.9], [0.35, 0.35], [1, 0]]) },
    { nombre: 'sol', w: 128, h: 128,
      dibujar: (c, x, y) => radial(c, x, y, 128, [[0, 1], [0.4, 1], [0.44, 0.45], [0.7, 0.12], [1, 0]]) },
    { nombre: 'vineta', w: 128, h: 32, dibujar: (c, x, y) => {
        const g = c.createLinearGradient(x, 0, x + 128, 0);
        g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.45)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = g; c.fillRect(x, y, 128, 32);
      } },
    { nombre: 'estela', w: 64, h: 4, dibujar: (c, x, y) => {
        const g = c.createLinearGradient(x, 0, x + 64, 0);
        g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,1)');
        c.fillStyle = g; c.fillRect(x, y, 64, 4);
      } },
    { nombre: 'cielo', w: 8, h: 128, dibujar: (c, x, y) => {
        const g = c.createLinearGradient(0, y, 0, y + 128);
        COLOR.CIELO.forEach((col, i) => g.addColorStop(i / (COLOR.CIELO.length - 1), hex(col)));
        c.fillStyle = g; c.fillRect(x, y, 8, 128);
      } },
    { nombre: 'caja', w: 48, h: 46, dibujar: caja },
    { nombre: 'ventilacion', w: 54, h: 42, dibujar: ventilacion },
    { nombre: 'maquina', w: 62, h: 52, dibujar: maquina },
    { nombre: 'cartel', w: 72, h: 118, dibujar: cartel },
    { nombre: 'ciudad_lejos', w: 960, h: 190,
      dibujar: (c, x, y) => skyline(c, x, y, 960, 190, 7, 40, 150, false) },
    { nombre: 'ciudad_medio', w: 960, h: 250,
      dibujar: (c, x, y) => skyline(c, x, y, 960, 250, 23, 70, 220, true) },
  ];
}

// ----------------------------------------------------------------------------
//  Tipografía: Anton horneada a una fuente bitmap
// ----------------------------------------------------------------------------
//  Un texto de Phaser común es un canvas propio que se re-sube a la placa de
//  video cada vez que cambia: con el puntaje cambiando 10 veces por segundo,
//  eso en un celular se nota. Una fuente bitmap vive en el atlas y cambiar el
//  texto no cuesta nada. El borde oscuro viene horneado: el tint colorea el
//  relleno y el borde queda oscuro, así se lee sobre cualquier fondo.
const FUENTE = {
  TAM: 64, BORDE: 5,
  CARACTERES: ' ABCDEFGHIJKLMNOPQRSTUVWXYZÁÉÍÓÚÑÜ0123456789!¡?¿.,:;-+×%\'"/()#↑↓',
};

function bloqueFuente() {
  const med = document.createElement('canvas').getContext('2d');
  med.font = `${FUENTE.TAM}px Anton`;
  const m = med.measureText('ÁÑ¿Qg');
  const asc = Math.ceil(m.fontBoundingBoxAscent || FUENTE.TAM * 0.98);
  const desc = Math.ceil(m.fontBoundingBoxDescent || FUENTE.TAM * 0.3);
  const altoCelda = asc + desc + FUENTE.BORDE * 2;
  const MAX_W = 2040;

  const glifos = [];
  let x = 0, y = 0;
  for (const ch of FUENTE.CARACTERES) {
    const avance = Math.ceil(med.measureText(ch).width);
    const w = avance + FUENTE.BORDE * 2;
    if (x + w > MAX_W) { x = 0; y += altoCelda; }
    glifos.push({ ch, x, y, w, avance });
    x += w;
  }
  const W = MAX_W, H = y + altoCelda;

  let xml = `<?xml version="1.0"?><font><info face="Anton" size="${FUENTE.TAM}"/>` +
            `<common lineHeight="${asc + desc + 2}" base="${asc}"/><chars count="${glifos.length}">`;
  for (const g of glifos) {
    xml += `<char id="${g.ch.codePointAt(0)}" x="${g.x}" y="${g.y}" width="${g.w}" height="${altoCelda}" ` +
           `xoffset="${-FUENTE.BORDE}" yoffset="0" xadvance="${g.avance + 2}"/>`;
  }
  xml += '</chars></font>';

  return {
    nombre: 'fuente', w: W, h: H, xml,
    dibujar: (c, bx, by) => {
      c.save();
      c.font = `${FUENTE.TAM}px Anton`;
      c.textBaseline = 'alphabetic';
      c.lineJoin = 'round';
      c.lineWidth = FUENTE.BORDE * 2;
      c.strokeStyle = '#140a1c';
      c.fillStyle = '#fff';
      for (const g of glifos) {
        if (g.ch === ' ') continue;
        const px = bx + g.x + FUENTE.BORDE, py = by + g.y + FUENTE.BORDE + asc;
        c.strokeText(g.ch, px, py);
        c.fillText(g.ch, px, py);
      }
      c.restore();
    },
  };
}

// ----------------------------------------------------------------------------
//  Empaquetado en estantes y dibujo final
// ----------------------------------------------------------------------------
export function crearAtlas() {
  const piezas = [...cuadrosDelPersonaje(), ...piezasSueltas(), bloqueFuente()];

  // Las más altas primero: desperdicia menos espacio.
  const orden = [...piezas].sort((a, b) => b.h - a.h || b.w - a.w);
  let x = 0, y = 0, altoFila = 0;
  for (const p of orden) {
    if (x + p.w + MARGEN > ANCHO_ATLAS) { x = 0; y += altoFila + MARGEN; altoFila = 0; }
    p.x = x + MARGEN;
    p.y = y + MARGEN;
    x += p.w + MARGEN;
    altoFila = Math.max(altoFila, p.h + MARGEN);
  }
  const usado = y + altoFila + MARGEN;
  let alto = 256;
  while (alto < usado) alto *= 2;

  const canvas = document.createElement('canvas');
  canvas.width = ANCHO_ATLAS;
  canvas.height = alto;
  const ctx = canvas.getContext('2d');

  const marcos = [];
  const meta = {};
  let xmlFuente = null;
  for (const p of piezas) {
    ctx.save();
    ctx.beginPath(); ctx.rect(p.x, p.y, p.w, p.h); ctx.clip();
    p.dibujar(ctx, p.x, p.y);
    ctx.restore();
    const i = p.interior || 0;
    marcos.push({ nombre: p.nombre, x: p.x + i, y: p.y + i, w: p.w - 2 * i, h: p.h - 2 * i });
    if (p.meta) meta[p.nombre] = p.meta;
    if (p.xml) xmlFuente = p.xml;
  }

  return { canvas, marcos, meta, xmlFuente, usado };
}
