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
    this.pista = bt(ANCHO / 2, 150, 54, COLOR.TEXTO);
    this.pistaSub = bt(ANCHO / 2, 218, 24, COLOR.BUFANDA);
    this.fps = DEBUG ? bt(10, 10, 18, COLOR.BUFANDA, 0) : null;

    this._p = -1; this._m = -1; this._c = -1;
    this.pulsoCombo = 0;
    this.mostrar(false);
  }

  redimensionar(w) {
    for (const o of [this.puntos, this.metros, this.combo, this.pista, this.pistaSub]) o.x = w / 2;
    this.record.x = w - 14;
  }

  mostrar(v) {
    for (const o of [this.puntos, this.metros, this.combo, this.record]) o.setVisible(v);
    this.ocultarPista();
  }

  reiniciar(record) {
    this._p = this._m = this._c = -1;
    this.record.setText(record > 0 ? `RÉCORD ${record}` : '');
    this.actualizar(0, 0, 0, 0);
  }

  actualizar(puntos, metros, combo, dt) {
    if (puntos !== this._p) { this._p = puntos; this.puntos.setText(String(puntos)); }
    if (metros !== this._m) { this._m = metros; this.metros.setText(`${metros} M`); }
    if (combo !== this._c) {
      if (combo > this._c && combo >= 2) this.pulsoCombo = 1;
      this._c = combo;
      this.combo.setText(combo >= 2 ? `×${combo}` : '');
    }
    this.pulsoCombo = Math.max(0, this.pulsoCombo - dt * 5);
    this.combo.setScale(1 + this.pulsoCombo * 0.35);
  }

  pistaVisible(texto, sub) {
    this.pista.setVisible(true).setText(texto);
    this.pistaSub.setVisible(true).setText(sub);
    const a = 0.75 + 0.25 * Math.sin(performance.now() / 110);
    this.pista.setAlpha(a);
  }

  ocultarPista() {
    this.pista.setVisible(false);
    this.pistaSub.setVisible(false);
  }

  medirFps(fps, peor) {
    if (this.fps) this.fps.setText(`${fps} FPS  PEOR ${peor}`);
  }
}
