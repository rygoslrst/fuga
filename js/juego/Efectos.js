// ============================================================================
//  Efectos.js — lo que hace que cada acción se SIENTA
// ----------------------------------------------------------------------------
//  Partículas, textos que saltan, destello y la viñeta roja de peligro.
//  Presupuesto fijo: 48 partículas y 6 textos, creados al arrancar. Si se
//  acaban, el efecto nuevo simplemente no aparece: nunca se crea nada extra.
// ============================================================================

import { ANCHO, ALTO, COLOR, RENDIMIENTO } from '../config.js';

export class Efectos {
  constructor(escena) {
    this.escena = escena;

    this.particulas = [];
    for (let i = 0; i < RENDIMIENTO.PARTICULAS_MAX; i++) {
      const img = escena.add.image(0, 0, 'atlas', 'punto').setDepth(11).setVisible(false);
      this.particulas.push({ img, vivo: false, x: 0, y: 0, vx: 0, vy: 0, g: 0, t: 0, dur: 1, s0: 1, s1: 0 });
    }

    this.textos = [];
    for (let i = 0; i < RENDIMIENTO.TEXTOS_FLOTANTES_MAX; i++) {
      const bt = escena.add.bitmapText(0, 0, 'anton', '', 30).setOrigin(0.5)
        .setScrollFactor(0).setDepth(12).setVisible(false);
      this.textos.push({ bt, vivo: false, t: 0, dur: 0.9, x: 0, y: 0 });
    }

    this.vineta = escena.add.image(0, 0, 'atlas', 'vineta').setOrigin(0, 0).setScrollFactor(0)
      .setDisplaySize(440, ALTO).setTint(COLOR.PELIGRO).setAlpha(0).setDepth(13);
    this.flash = escena.add.image(0, 0, 'atlas', 'blanco').setOrigin(0, 0).setScrollFactor(0)
      .setDisplaySize(ANCHO, ALTO).setAlpha(0).setDepth(20);
    this.flashA = 0;
  }

  redimensionar(w) { this.flash.setDisplaySize(w, ALTO); }

  limpiar() {
    for (const p of this.particulas) { p.vivo = false; p.img.setVisible(false); }
    for (const t of this.textos) { t.vivo = false; t.bt.setVisible(false); }
    this.flashA = 0;
    this.flash.setAlpha(0);
    this.vineta.setAlpha(0);
  }

  _particula() {
    for (const p of this.particulas) if (!p.vivo) return p;
    return null;
  }

  emitir(x, y, vx, vy, g, dur, color, s0, s1, alfa = 1) {
    const p = this._particula();
    if (!p) return;
    p.vivo = true; p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.g = g;
    p.t = 0; p.dur = dur; p.s0 = s0; p.s1 = s1; p.alfa = alfa;
    p.img.setVisible(true).setTint(color).setPosition(x, y).setScale(s0).setAlpha(alfa);
  }

  // Polvo al despegar (dir -1) o al aterrizar (dir 1)
  polvo(x, y, n, dir) {
    for (let i = 0; i < n; i++) {
      const lado = i % 2 ? 1 : -1;
      this.emitir(x + lado * 6, y - 3, lado * (40 + Math.random() * 90) - 120, -(20 + Math.random() * 70) * (dir > 0 ? 1 : 0.6),
                  260, 0.35 + Math.random() * 0.2, 0xf6c7a2, 1.1 + Math.random() * 0.8, 2.2, 0.55);
    }
  }

  chispas(x, y, n, color) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
      const v = 160 + Math.random() * 180;
      this.emitir(x, y, Math.cos(a) * v, Math.sin(a) * v - 60, 380, 0.4 + Math.random() * 0.25, color, 0.9, 0);
    }
  }

  escombros(x, y, n) {
    for (let i = 0; i < n; i++) {
      this.emitir(x, y, 80 + Math.random() * 260, -(120 + Math.random() * 260), 1400,
                  0.55 + Math.random() * 0.3, COLOR.EDIFICIO, 0.7 + Math.random() * 0.5, 0.4);
    }
  }

  // Texto en coordenadas de PANTALLA, sobre el corredor: se lee siempre.
  texto(xPantalla, yPantalla, cadena, color, tam = 30) {
    let elegido = null;
    for (const t of this.textos) if (!t.vivo) { elegido = t; break; }
    if (!elegido) {                         // se recicla el más viejo
      elegido = this.textos[0];
      for (const t of this.textos) if (t.t > elegido.t) elegido = t;
    }
    elegido.vivo = true; elegido.t = 0; elegido.x = xPantalla; elegido.y = yPantalla;
    elegido.bt.setVisible(true).setText(cadena).setFontSize(tam).setTint(color)
      .setPosition(xPantalla, yPantalla).setAlpha(1).setScale(1.4);
  }

  destello(color, alfa) {
    this.flash.setTint(color);
    this.flashA = alfa;
  }

  actualizar(dt, peligro) {
    for (const p of this.particulas) {
      if (!p.vivo) continue;
      p.t += dt;
      if (p.t >= p.dur) { p.vivo = false; p.img.setVisible(false); continue; }
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const k = p.t / p.dur;
      p.img.setPosition(p.x, p.y).setScale(p.s0 + (p.s1 - p.s0) * k).setAlpha(p.alfa * (1 - k));
    }
    for (const t of this.textos) {
      if (!t.vivo) continue;
      t.t += dt;
      if (t.t >= t.dur) { t.vivo = false; t.bt.setVisible(false); continue; }
      const k = t.t / t.dur;
      const esc = k < 0.12 ? 1.4 - (k / 0.12) * 0.4 : 1;           // entra grande y se asienta
      t.bt.setPosition(t.x, t.y - k * 46).setScale(esc).setAlpha(k > 0.6 ? 1 - (k - 0.6) / 0.4 : 1);
    }
    if (this.flashA > 0) {
      this.flashA = Math.max(0, this.flashA - dt * 3.2);
      this.flash.setAlpha(this.flashA);
    }
    // La viñeta late más rápido cuanto más cerca está.
    const lat = 0.8 + 0.2 * Math.sin(performance.now() / (180 - peligro * 90));
    this.vineta.setAlpha(peligro * 0.62 * lat);
  }
}
