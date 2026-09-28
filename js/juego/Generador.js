// ============================================================================
//  Generador.js — encadena segmentos para siempre
// ----------------------------------------------------------------------------
//  Elige el próximo segmento según una curva de dificultad que sube con la
//  distancia, con reglas para que la combinación sea siempre superable:
//    · nunca dos segmentos de dificultad 4-5 seguidos
//    · cada tanto, un descanso obligatorio
//    · no repite ninguno de los últimos tres
//    · la altura de los techos es continua: el segmento se "monta" a la altura
//      donde terminó el anterior, y si no entra en el rango, se elige otro
// ============================================================================

import { SEGMENTOS } from '../datos/segmentos.js';
import { TERRENO, SALTO, RITMO, PX_POR_COLUMNA as COL } from '../config.js';

export const OBST = { NADA: 0, CAJA: 1, VENT: 2, MAQ: 3 };
const LETRA_OBST = { c: OBST.CAJA, v: OBST.VENT, m: OBST.MAQ };

// ----------------------------------------------------------------------------
//  Lectura y validación
// ----------------------------------------------------------------------------
function leer(seg) {
  const [arriba, medio, suelo] = seg.grilla;
  const n = suelo.length;
  const niv = new Int8Array(n), obs = new Uint8Array(n), bar = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    niv[i] = suelo[i] === '_' ? -1 : suelo.charCodeAt(i) - 48;
    obs[i] = LETRA_OBST[medio[i]] || 0;
    bar[i] = arriba[i] === '=' ? 1 : 0;
  }
  let min = 9, max = -9;
  for (const v of niv) if (v >= 0) { min = Math.min(min, v); max = Math.max(max, v); }
  const s = { ...seg, n, niv, obs, bar, min, max, primero: niv[0], ultimo: niv[n - 1] };
  s.monedas = ubicarMonedas(s);
  return s;
}

// ----------------------------------------------------------------------------
//  Monedas: se ubican SOLAS, con reglas, al leer cada segmento. Un segmento
//  nuevo no pide ubicar monedas a mano (costo acotado).
//    · tres sobre el arco del salto bien hecho de cada caja, hueco y escalón
//    · una debajo de cada columna de cartel, a la altura de la barrida
//    · en los descansos, un arco optativo: saltar a tiempo "porque sí" paga
//  Cada una: x desde el comienzo del segmento (donde pasa el centro del
//  cuerpo), nivel del techo desde donde se mide y altura en px sobre él.
// ----------------------------------------------------------------------------
const CUERPO = 40;           // del pie al centro del cuerpo: ahí va la moneda
const BAJA = 22;             // moneda de barrida: pasa por debajo de un cartel

function ubicarMonedas(s) {
  const lista = [];
  const pulso = RITMO.PX_POR_PULSO;
  // Arco de un salto que despega en x0: en 1/4, 1/2 y 3/4 del pulso.
  const arco = (x0, nivel) => {
    for (const p of [0.25, 0.5, 0.75]) {
      lista.push({ x: x0 + p * pulso, nivel, h: 4 * SALTO.ALTURA * p * (1 - p) + CUERPO });
    }
  };
  if (s.nombre === 'inicio') return lista;           // la largada, limpia
  for (let i = 1; i < s.n; i++) {
    const n = s.niv[i], antes = s.niv[i - 1];
    if (s.obs[i]) arco(i * COL + COL / 2 - pulso / 2, n);            // cumbre sobre la caja
    else if (n < 0 && antes >= 0) arco(i * COL - COL / 2, antes);    // despegue junto al borde
    else if (n >= 0 && antes >= 0 && n > antes) arco(i * COL - COL, antes);
    if (s.bar[i]) lista.push({ x: i * COL + COL / 2, nivel: n, h: BAJA });
  }
  if (s.exige === 'descanso') {
    const x0 = s.n * COL / 2 - pulso / 2;
    arco(x0, s.niv[Math.floor(x0 / COL)]);
  }
  return lista;
}

export function validar(seg) {
  const err = [];
  const [arriba, medio, suelo] = seg.grilla;
  const n = seg.pulsos * 4;
  if (arriba.length !== n || medio.length !== n || suelo.length !== n) {
    return [`las filas miden ${arriba.length}/${medio.length}/${suelo.length}, deberían medir ${n}`];
  }
  if (!/^[.=]+$/.test(arriba)) err.push('fila de arriba: sólo . y =');
  if (!/^[.cvm]+$/.test(medio)) err.push('fila del medio: sólo . c v m');
  if (!/^[0-3_]+$/.test(suelo)) err.push('suelo: sólo 0-3 y _');
  if (err.length) return err;

  const s = leer(seg);
  const limpia = i => s.niv[i] >= 0 && !s.obs[i] && !s.bar[i];
  for (const i of [0, 1, n - 2, n - 1]) if (!limpia(i)) err.push(`la columna ${i} del borde tiene que estar limpia`);
  if (s.niv[0] !== s.niv[1] || s.niv[n - 1] !== s.niv[n - 2]) err.push('los bordes tienen que ser planos');

  // Huecos y escalones
  let ultimoFirme = s.niv[0];
  for (let i = 0; i < n; i++) {
    if (s.niv[i] < 0) {
      let j = i;
      while (j < n && s.niv[j] < 0) j++;
      const ancho = j - i;
      const despues = s.niv[j];
      if (ancho > 3) err.push(`hueco de ${ancho} columnas en ${i} (máximo 3)`);
      if (despues > ultimoFirme && ancho > 2) err.push(`hueco de subida de ${ancho} en ${i} (máximo 2)`);
      if (despues - ultimoFirme > 1) err.push(`subida de ${despues - ultimoFirme} niveles tras el hueco en ${i}`);
      i = j - 1;
    } else {
      if (s.niv[i] - ultimoFirme > 1) err.push(`subida de ${s.niv[i] - ultimoFirme} niveles en ${i}`);
      ultimoFirme = s.niv[i];
    }
  }

  // Obstáculos y carteles sobre techo firme y parejo
  for (let i = 0; i < n; i++) {
    if (!s.obs[i] && !s.bar[i]) continue;
    if (s.obs[i] && s.bar[i]) err.push(`caja y cartel en la misma columna ${i}`);
    for (const k of [i - 1, i, i + 1]) {
      if (s.niv[k] < 0 || s.niv[k] !== s.niv[i]) err.push(`lo que hay en ${i} tiene que estar sobre techo parejo`);
    }
  }

  // Ritmo: separación entre cosas que piden salto, y carteles después de un salto
  const saltos = [];
  for (let i = 0; i < n; i++) {
    const subeAca = i > 0 && s.niv[i] >= 0 && s.niv[i - 1] >= 0 && s.niv[i] > s.niv[i - 1];
    const empiezaHueco = s.niv[i] < 0 && (i === 0 || s.niv[i - 1] >= 0);
    if (s.obs[i] || subeAca || empiezaHueco) saltos.push(i);
  }
  for (let k = 1; k < saltos.length; k++) {
    if (saltos[k] - saltos[k - 1] < 4) err.push(`saltos en ${saltos[k - 1]} y ${saltos[k]}: menos de un pulso`);
  }
  for (let i = 0; i < n; i++) {
    if (!s.bar[i] || s.bar[i - 1]) continue;              // sólo el comienzo de cada cartel
    for (const j of saltos) if (j < i && i - j < 5) err.push(`cartel en ${i} muy pegado al salto de ${j}`);
    let fin = i;
    while (s.bar[fin + 1]) fin++;
    for (const j of saltos) if (j > fin && j - fin < 3) err.push(`salto en ${j} muy pegado al cartel que termina en ${fin}`);
  }
  return [...new Set(err)];
}

// ----------------------------------------------------------------------------
//  Generador
// ----------------------------------------------------------------------------
export class Generador {
  constructor() {
    this.errores = [];
    const validos = [];
    for (const seg of SEGMENTOS) {
      const e = validar(seg);
      if (e.length) { this.errores.push({ nombre: seg.nombre, e }); console.error(`[segmento ${seg.nombre}]`, e); }
      else validos.push(leer(seg));
    }
    this.intro = validos.filter(s => s.tipo === 'intro');
    this.inicio = validos.find(s => s.nombre === 'inicio');
    this.normales = validos.filter(s => s.tipo !== 'intro');
    this.descanso = this.normales.find(s => s.nombre === 'plano');
    this.reiniciar(false);
  }

  reiniciar(conIntro) {
    this.cola = conIntro ? [...this.intro] : [this.inicio];
    this.nivel = 0;
    this.pulsos = 0;
    this.ultimos = [];
    this.desdeDescanso = 0;
    this.ultDif = 0;
    this.ultExige = '';
  }

  // Dificultad objetivo: arranca en 1 y se acerca a 5. A los ~110 pulsos
  // (unos 50 segundos) ronda 3.5.
  objetivo() { return 1 + 4 * (1 - Math.exp(-this.pulsos / 110)); }

  cabe(s) {
    const off = this.nivel - s.primero;
    return s.min + off >= 0 && s.max + off <= TERRENO.NIVEL_MAX;
  }

  siguiente() {
    let s = this.cola.length ? this.cola.shift() : this.elegir();
    if (!this.cabe(s)) s = this.descanso;
    const offset = this.nivel - s.primero;
    this.nivel = s.ultimo + offset;
    this.pulsos += s.pulsos;
    this.desdeDescanso = s.exige === 'descanso' ? 0 : this.desdeDescanso + s.pulsos;
    this.ultDif = s.dificultad;
    this.ultExige = s.exige;
    this.ultimos.push(s.nombre);
    if (this.ultimos.length > 3) this.ultimos.shift();
    return { seg: s, offset };
  }

  elegir() {
    const obj = this.objetivo();
    let total = 0;
    const cand = [];
    for (const s of this.normales) {
      if (s.dificultad > obj + 0.6) continue;
      if (this.ultimos.includes(s.nombre)) continue;
      if (this.ultDif >= 4 && s.dificultad >= 4) continue;
      if (!this.cabe(s)) continue;
      let w = Math.exp(-((obj - s.dificultad) ** 2) / 1.2);
      if (s.exige === this.ultExige) w *= 0.5;
      if (s.exige === 'descanso') w *= this.desdeDescanso >= 24 ? 6 : (this.desdeDescanso < 12 ? 0.15 : 1);
      else if (this.desdeDescanso >= 32) w *= 0.1;
      // Que la ciudad suba y baje: si estás en el piso, preferí subir, y viceversa.
      const neto = s.ultimo - s.primero;
      if (this.nivel <= 0 && neto > 0) w *= 1.7;
      if (this.nivel >= TERRENO.NIVEL_MAX && neto < 0) w *= 1.7;
      cand.push([s, w]);
      total += w;
    }
    if (!cand.length) return this.descanso;
    let r = Math.random() * total;
    for (const [s, w] of cand) { r -= w; if (r <= 0) return s; }
    return cand[cand.length - 1][0];
  }
}
