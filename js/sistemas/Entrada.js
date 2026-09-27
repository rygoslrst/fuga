// ============================================================================
//  Entrada.js  —  UN SOLO lugar donde se lee al jugador
// ----------------------------------------------------------------------------
//  PC:      Z / flecha arriba / espacio = SALTAR   |   X / flecha derecha = GOLPEAR
//  Celular: mitad izquierda de la pantalla = SALTAR |  mitad derecha = GOLPEAR
//  Sin joystick, sin gestos. Multitouch: se puede saltar y golpear a la vez.
// ============================================================================

import { RITMO } from '../config/ritmo.js';

export class Entrada {
  constructor(escena) {
    this.escena = escena;
    this.esTactil = false;

    this.saltoPedidoEn = -Infinity;  // ms del reloj del navegador
    this.golpePedidoEn = -Infinity;
    this.mitadIzqActiva = false;
    this.mitadDerActiva = false;

    const teclado = escena.input.keyboard;
    this.teclasSalto = [
      teclado.addKey('Z'), teclado.addKey('UP'), teclado.addKey('SPACE'),
    ];
    this.teclasGolpe = [
      teclado.addKey('X'), teclado.addKey('RIGHT'), teclado.addKey('C'),
    ];
    this.teclasSalto.forEach(t => t.on('down', () => this.pedirSalto()));
    this.teclasGolpe.forEach(t => t.on('down', () => this.pedirGolpe()));

    escena.input.addPointer(3); // hasta 4 dedos a la vez
    escena.input.on('pointerdown', p => this.tocar(p, true));
    escena.input.on('pointerup',   p => this.tocar(p, false));
  }

  tocar(puntero, abajo) {
    if (puntero.wasTouch) this.esTactil = true;
    const mitad = this.escena.scale.width / 2;
    const izquierda = puntero.x < mitad;
    if (abajo) {
      if (izquierda) { this.mitadIzqActiva = true;  this.pedirSalto(); }
      else           { this.mitadDerActiva = true;  this.pedirGolpe(); }
    } else {
      if (izquierda) this.mitadIzqActiva = false;
      else           this.mitadDerActiva = false;
    }
  }

  pedirSalto() { this.saltoPedidoEn = performance.now(); }
  pedirGolpe() { this.golpePedidoEn = performance.now(); }

  // "Consumir" = el pedido se gasta. Devuelve true una sola vez por pulsacion.
  // El buffer hace que apretar un poco ANTES de aterrizar igual valga.
  consumirSalto() {
    const edad = performance.now() - this.saltoPedidoEn;
    if (edad <= RITMO.BUFFER_SALTO_MS) { this.saltoPedidoEn = -Infinity; return true; }
    return false;
  }

  consumirGolpe() {
    const edad = performance.now() - this.golpePedidoEn;
    if (edad <= 90) { this.golpePedidoEn = -Infinity; return true; }
    return false;
  }

  // Cualquier toque, para "tocar para reiniciar" y para desbloquear el audio.
  huboToqueRecien(ms = 200) {
    const ahora = performance.now();
    return (ahora - this.saltoPedidoEn <= ms) || (ahora - this.golpePedidoEn <= ms);
  }
}
