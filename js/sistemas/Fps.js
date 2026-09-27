// ============================================================================
//  Fps.js  —  contador visible durante TODO el desarrollo.
//  Muestra FPS actual y el peor de los ultimos 3 segundos: el peor es el que
//  te dice si el juego tironea, el promedio miente.
// ============================================================================

import { COLORES, DEPURACION } from '../config/ajustes.js';

export class Fps {
  constructor(escena, x = 8, y = 8) {
    this.escena = escena;
    this.peor = 999;
    this.desde = 0;
    this.texto = escena.add.text(x, y, '', {
      fontFamily: 'monospace', fontSize: '16px', color: COLORES.ACENTO_CSS,
    }).setScrollFactor(0).setDepth(9999);
    this.texto.setVisible(DEPURACION.MOSTRAR_FPS);
  }

  actualizar(tiempo) {
    const fps = this.escena.game.loop.actualFps;
    if (fps < this.peor) this.peor = fps;
    if (tiempo - this.desde > 3000) { this.peor = fps; this.desde = tiempo; }
    const color = this.peor < 50 ? '#ff5c72' : COLORES.ACENTO_CSS;
    this.texto.setColor(color);
    this.texto.setText(`${fps.toFixed(0)} fps  (peor ${this.peor.toFixed(0)})`);
  }
}
