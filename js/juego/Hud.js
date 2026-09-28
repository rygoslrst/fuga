// ============================================================================
//  Hud.js — lo mínimo en pantalla
// ----------------------------------------------------------------------------
//  Puntos arriba al centro, metros debajo, combo en dorado. Nada de vidas: el
//  "cuánto me queda" lo dice el perseguidor, que se ve. Los textos sólo se
//  reescriben cuando cambian.
// ============================================================================

import { ANCHO, COLOR, DEBUG } from '../config.js';

export class Hud {
  constructor(escena) {
    this.escena = escena;
    const bt = (x, y, tam, color, ox = 0.5) => escena.add.bitmapText(x, y, 'anton', '', tam)
      .setOrigin(ox, 0).setScrollFactor(0).setDepth(14).setTint(color);

    this.puntos = bt(ANCHO / 2, 10, 46, COLOR.TEXTO);
    this.metros = bt(ANCHO / 2, 64, 20, 0xffd9b8);
    this.combo = bt(ANCHO / 2, 88, 30, COLOR.ORO);
    this.record = bt(ANCHO - 14, 12, 18, 0xffd9b8, 1);
    this.monedas = bt(ANCHO - 14, 36, 26, COLOR.ORO, 1);
    this.icono = escena.add.image(0, 53, 'atlas', 'moneda').setScrollFactor(0).setDepth(14).setScale(0.85);
    this.pista = bt(ANCHO / 2, 150, 54, COLOR.TEXTO);
    this.pistaSub = bt(ANCHO / 2, 218, 24, COLOR.BUFANDA);
    // Tutorial: una flecha grande junto al corredor que muestra el gesto.
    this.flecha = bt(0, 0, 96, COLOR.BUFANDA).setOrigin(0.5);
    this.fps = DEBUG ? bt(10, 10, 18, COLOR.BUFANDA, 0) : null;

    this._p = -1; this._m = -1; this._c = -1; this._o = -1;
    this.pulsoCombo = 0;
    this.pulsoMoneda = 0;
    this.sacudida = 0;
    this.ancho = ANCHO;
    this.mostrar(false);
  }

  redimensionar(w) {
    this.ancho = w;
    for (const o of [this.puntos, this.metros, this.combo, this.pista, this.pistaSub]) o.x = w / 2;
    this.record.x = this.monedas.x = w - 14;
    this.ubicarIcono();
  }

  ubicarIcono() { this.icono.x = this.monedas.x - this.monedas.width - 16; }

  mostrar(v) {
    for (const o of [this.puntos, this.metros, this.combo, this.record, this.monedas, this.icono]) o.setVisible(v);
    this.ocultarPista();
  }

  reiniciar(record) {
    this._p = this._m = this._c = this._o = -1;
    this.record.setText(record > 0 ? `RÉCORD ${record}` : '');
    this.actualizar(0, 0, 0, 0, 0);
  }

  actualizar(puntos, metros, combo, monedas, dt) {
    if (puntos !== this._p) { this._p = puntos; this.puntos.setText(String(puntos)); }
    if (metros !== this._m) { this._m = metros; this.metros.setText(`${metros} M`); }
    if (combo !== this._c) {
      if (combo > this._c && combo >= 2) this.pulsoCombo = 1;
      this._c = combo;
      this.combo.setText(combo >= 2 ? `×${combo}` : '');
    }
    if (monedas !== this._o) {
      if (monedas > this._o && this._o >= 0) this.pulsoMoneda = 1;
      this._o = monedas;
      this.monedas.setText(String(monedas));
      this.ubicarIcono();
    }
    this.pulsoCombo = Math.max(0, this.pulsoCombo - dt * 5);
    this.combo.setScale(1 + this.pulsoCombo * 0.35);
    this.pulsoMoneda = Math.max(0, this.pulsoMoneda - dt * 6);
    this.icono.setScale(0.85 + this.pulsoMoneda * 0.35);
  }

  pistaVisible(texto, sub) {
    this.pista.setVisible(true).setText(texto);
    this.pistaSub.setVisible(true).setText(sub);
    const a = 0.75 + 0.25 * Math.sin(performance.now() / 110);
    this.pista.setAlpha(a);
  }

  // Lección del tutorial: el juego quieto, el texto arriba y una flecha que
  // hace el gesto una y otra vez junto al corredor (en coordenadas de pantalla).
  leccion(texto, sub, haciaArriba, xPantalla, yPantalla, dt) {
    this.pistaVisible(texto, sub);
    this.sacudida = Math.max(0, this.sacudida - dt * 4);
    this.pista.x = this.ancho / 2 + Math.sin(performance.now() / 18) * 14 * this.sacudida;
    const k = (performance.now() / 700) % 1;               // un gesto cada 0,7 s
    const recorrido = 70 * (k < 0.7 ? k / 0.7 : 1);
    this.flecha.setVisible(true).setText(haciaArriba ? '↑' : '↓')
      .setPosition(xPantalla, yPantalla + (haciaArriba ? -recorrido : recorrido))
      .setAlpha(k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3);
  }

  // El jugador hizo el gesto equivocado: el texto tiembla.
  sacudir() { this.sacudida = 1; }

  ocultarPista() {
    this.pista.setVisible(false);
    this.pistaSub.setVisible(false);
    this.flecha.setVisible(false);
    this.pista.x = this.ancho / 2;
  }

  medirFps(fps, peor) {
    if (this.fps) this.fps.setText(`${fps} FPS  PEOR ${peor}`);
  }
}
