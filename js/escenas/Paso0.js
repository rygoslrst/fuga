// ============================================================================
//  Paso0.js  —  PRUEBA DE HUMO. No es el juego.
// ----------------------------------------------------------------------------
//  Existe para verificar en un teléfono REAL, antes de construir nada:
//   1. Escalado a cualquier pantalla (Scale Manager, resolución virtual fija)
//   2. Pantalla de "girá el teléfono" en vertical
//   3. Audio desbloqueado en el primer toque (iOS)
//   4. Los toques no producen scroll / zoom / recarga
//   5. Mitad izquierda = saltar, mitad derecha = golpear
//   6. FPS visibles
//   7. Que un salto dure EXACTAMENTE un pulso, medido contra el reloj de audio
// ============================================================================

import { PANTALLA, COLORES, DEPURACION } from '../config/ajustes.js';
import { RITMO, SEG_POR_PULSO, MS_POR_PULSO, TIEMPO_EN_AIRE,
         VELOCIDAD, GRAVEDAD, VELOCIDAD_SALTO, alturaDeSalto } from '../config/ritmo.js';
import { Reloj } from '../sistemas/Reloj.js';
import { Entrada } from '../sistemas/Entrada.js';
import { Fps } from '../sistemas/Fps.js';
import { Personaje } from '../sistemas/Personaje.js';

const ADELANTO = 0.12; // segundos de anticipación para programar los clicks

export class Paso0 extends Phaser.Scene {
  constructor() { super('Paso0'); }

  preload() {
    Personaje.precargar(this);
  }

  create() {
    const { ANCHO, ALTO, PISO_Y } = PANTALLA;
    this.reloj = new Reloj();
    this.entrada = new Entrada(this);

    this.arrancado = false;
    this.proximoPulsoAProgramar = 0;
    this.enElAire = false;
    this.tDespegue = 0;
    this.retrasoCuadro = 0;
    this.peorRetraso = 0;
    this.ultimoDesvio = 0;
    this.saltos = 0;
    this.tGolpe = -9999;

    this.cameras.main.setBackgroundColor(COLORES.FONDO);

    // --- mitades táctiles, apenas visibles ---------------------------------
    this.panelIzq = this.add.rectangle(ANCHO * 0.25, ALTO / 2, ANCHO / 2, ALTO, 0xffffff, 0.03);
    this.panelDer = this.add.rectangle(ANCHO * 0.75, ALTO / 2, ANCHO / 2, ALTO, 0xffffff, 0.06);
    this.add.line(0, 0, ANCHO / 2, 0, ANCHO / 2, ALTO, 0xffffff, 0.08).setOrigin(0);
    const est = { fontFamily: 'monospace', fontSize: '15px', color: COLORES.TENUE_CSS };
    this.add.text(ANCHO * 0.25, ALTO - 34, 'SALTAR', est).setOrigin(0.5);
    this.add.text(ANCHO * 0.75, ALTO - 34, 'GOLPEAR', est).setOrigin(0.5);

    // --- piso ----------------------------------------------------------------
    // El suelo se dibuja POR ENCIMA del personaje. El cuadro del golpe llega
    // hasta 13 px por debajo de la línea de los pies (el martillo entrando en
    // la tierra): si el suelo va atrás, ese pedazo del arco queda flotando.
    // Como los pies terminan justo en PISO_Y, taparlo no esconde nada del rey.
    this.add.rectangle(ANCHO / 2, PISO_Y + 30, ANCHO, 60, COLORES.PISO)
      .setOrigin(0.5).setDepth(10);

    // Marcas verticales cada pulso: se mueven a VELOCIDAD y muestran que el
    // avance del personaje está enganchado a la música.
    this.marcas = [];
    for (let i = 0; i < 8; i++) {
      this.marcas.push(
        this.add.rectangle(i * RITMO.PX_POR_PULSO, PISO_Y + 30, 3, 60, 0xffffff, 0.18)
          .setDepth(11)
      );
    }

    // --- metrónomo visual: 4 puntos = 1 compás -------------------------------
    this.puntos = [];
    for (let i = 0; i < 4; i++) {
      this.puntos.push(this.add.circle(ANCHO / 2 - 90 + i * 60, 56, 11, 0x3a3757));
    }

    // --- el rey --------------------------------------------------------------
    this.rey = new Personaje(this, 256, PISO_Y);

    // Caja del golpe. Se dibuja SOLO mientras probamos: tiene que coincidir con
    // lo que se ve del martillo, si no el juego se siente tramposo.
    this.cajaGolpe = this.add.rectangle(
      256 + RITMO.GOLPE_ALCANCE / 2, PISO_Y - 58,
      RITMO.GOLPE_ALCANCE, 116, COLORES.PELIGRO, 0.22
    ).setVisible(false);

    // --- textos ---------------------------------------------------------------
    this.fps = new Fps(this, 8, 8);

    this.lectura = this.add.text(ANCHO / 2, 172, '', {
      fontFamily: 'monospace', fontSize: '19px', color: COLORES.TEXTO_CSS, align: 'center',
    }).setOrigin(0.5, 0);

    this.diag = this.add.text(8, 32, '', {
      fontFamily: 'monospace', fontSize: '13px', color: COLORES.TENUE_CSS, lineSpacing: 3,
    }).setVisible(DEPURACION.MOSTRAR_DIAGNOSTICO);

    // --- portada: hace falta un toque para que iOS deje sonar -----------------
    this.portada = this.add.container(0, 0).setDepth(500);
    this.portada.add(this.add.rectangle(ANCHO / 2, ALTO / 2, ANCHO, ALTO, 0x0b0a14, 0.93));
    this.portada.add(this.add.text(ANCHO / 2, ALTO / 2 - 46, 'PASO 0 · PRUEBA DE HUMO', {
      fontFamily: 'monospace', fontSize: '30px', color: COLORES.ACENTO_CSS,
    }).setOrigin(0.5));
    this.portada.add(this.add.text(ANCHO / 2, ALTO / 2 + 16,
      'TOCÁ LA PANTALLA PARA EMPEZAR\n(el toque también desbloquea el audio)', {
      fontFamily: 'monospace', fontSize: '17px', color: COLORES.TEXTO_CSS, align: 'center',
    }).setOrigin(0.5));

    this.input.once('pointerdown', () => this.arrancar());
    this.input.keyboard.once('keydown', () => this.arrancar());
  }

  async arrancar() {
    if (this.arrancado) return;
    const ok = await this.reloj.desbloquear();
    this.reloj.iniciar();
    this.arrancado = true;
    this.portada.setVisible(false);
    if (!ok) {
      this.lectura.setText('El audio NO se desbloqueó.\nDecime qué muestra el diagnóstico.');
    }
    // Se gasta el pedido del toque de arranque, para que no salte solo.
    this.entrada.consumirSalto();
    this.entrada.consumirGolpe();
  }

  // --- sonidos sintetizados: no dependen de ningún archivo -------------------
  click(cuando, fuerte) {
    const ctx = this.reloj.ctx; if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = fuerte ? 1320 : 880;
    g.gain.setValueAtTime(fuerte ? 0.22 : 0.10, cuando);
    g.gain.exponentialRampToValueAtTime(0.0001, cuando + 0.05);
    o.connect(g); g.connect(this.reloj.master);
    o.start(cuando); o.stop(cuando + 0.06);
  }

  ruidoGolpe() {
    const ctx = this.reloj.ctx; if (!ctx) return;
    const largo = Math.floor(ctx.sampleRate * 0.12);
    const buf = ctx.createBuffer(1, largo, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < largo; i++) {
      const caida = 1 - i / largo;
      d[i] = (Math.random() * 2 - 1) * caida * caida;
    }
    const s = ctx.createBufferSource(); s.buffer = buf;
    const g = ctx.createGain(); g.gain.value = 0.3;
    s.connect(g); g.connect(this.reloj.master); s.start(ctx.currentTime);
  }

  programarClicks() {
    const ctx = this.reloj.ctx; if (!ctx) return;
    let limite = 0;
    while (this.reloj.t0 + this.proximoPulsoAProgramar * SEG_POR_PULSO
           < ctx.currentTime + ADELANTO && limite++ < 64) {
      const cuando = this.reloj.t0 + this.proximoPulsoAProgramar * SEG_POR_PULSO;
      if (cuando >= ctx.currentTime) this.click(cuando, this.proximoPulsoAProgramar % 4 === 0);
      this.proximoPulsoAProgramar++;
    }
  }

  update(tiempo) {
    this.fps.actualizar(tiempo);
    this.panelIzq.setFillStyle(0xffffff, this.entrada.mitadIzqActiva ? 0.14 : 0.03);
    this.panelDer.setFillStyle(0xffffff, this.entrada.mitadDerActiva ? 0.18 : 0.06);
    if (!this.arrancado) return;

    this.programarClicks();
    const t = this.reloj.tiempo;
    const { PISO_Y } = PANTALLA;

    // --- metrónomo visual ----------------------------------------------------
    const enCompas = ((this.reloj.pulso % 4) + 4) % 4;
    const fase = this.reloj.faseDelPulso;
    this.puntos.forEach((p, i) => {
      const activo = i === enCompas;
      p.setFillStyle(activo ? (i === 0 ? 0xffffff : COLORES.ACENTO) : 0x3a3757);
      p.setScale(activo ? 1 + (1 - fase) * 0.5 : 1);
    });

    // --- las marcas del piso avanzan a la velocidad de carrera ---------------
    const avance = (t * VELOCIDAD) % RITMO.PX_POR_PULSO;
    this.marcas.forEach((m, i) => { m.x = i * RITMO.PX_POR_PULSO - avance; });

    // --- salto: parábola cerrada contra el reloj de AUDIO --------------------
    // No se integra la gravedad paso a paso a propósito: así la duración del
    // salto es idéntica a 60 fps y a 24 fps.
    if (this.entrada.consumirSalto() && this.rey.saltar(t)) {
      this.tDespegue = t;
      this.saltos++;
      this.enElAire = true;
    }

    if (this.enElAire) {
      const dt = t - this.tDespegue;
      if (dt >= TIEMPO_EN_AIRE) {
        this.enElAire = false;
        // La parábola dura TIEMPO_EN_AIRE exacto por construcción. Lo que varía
        // de aparato en aparato es CUÁNDO el juego se entera: como mucho un
        // cuadro tarde. Ese retraso es el número que hay que mirar en el
        // teléfono, porque dice de qué tamaño tiene que ser la ventana de
        // perdón. A 60 fps son ~16 ms; si acá sale mucho más, el celular va lento.
        this.retrasoCuadro = (dt - TIEMPO_EN_AIRE) * 1000;
        this.peorRetraso = Math.max(this.peorRetraso, this.retrasoCuadro);
        this.ultimoDesvio = this.reloj.desvioAlPulso(this.tDespegue + TIEMPO_EN_AIRE);
      }
    }

    // El personaje resuelve solo su altura y su cuadro de animación, contra el
    // mismo reloj musical. pulsoFraccion es lo que engancha los pies al pulso.
    this.rey.actualizar(t, this.reloj.pulsoFraccion);

    // --- golpe ----------------------------------------------------------------
    if (this.entrada.consumirGolpe() && tiempo - this.tGolpe > RITMO.GOLPE_ENFRIAMIENTO_MS) {
      this.tGolpe = tiempo;
      this.rey.golpear(t);
      this.ruidoGolpe();
      this.cameras.main.shake(70, 0.006);
    }
    this.cajaGolpe.setVisible(tiempo - this.tGolpe < RITMO.GOLPE_DURACION_MS);
    this.cajaGolpe.y = this.rey.sprite.y - 58;

    // --- lecturas -------------------------------------------------------------
    const objetivo = MS_POR_PULSO * RITMO.PULSOS_EN_EL_AIRE;
    const signo = n => (n >= 0 ? '+' : '');
    this.lectura.setText(
      'un salto dura ' + objetivo.toFixed(0) + ' ms = 1 pulso a ' + RITMO.BPM + ' bpm\n' +
      (this.saltos === 0
        ? 'tocá la mitad izquierda para saltar'
        : 'retraso de detección del aterrizaje: ' + this.retrasoCuadro.toFixed(0) +
          ' ms  (peor ' + this.peorRetraso.toFixed(0) + ')\n' +
          'aterrizaje respecto del pulso: ' + signo(this.ultimoDesvio) +
          this.ultimoDesvio.toFixed(0) + ' ms   ·   saltos: ' + this.saltos)
    );

    if (DEPURACION.MOSTRAR_DIAGNOSTICO) {
      const c = this.scale.canvas;
      this.diag.setText(
        'audio: ' + this.reloj.estadoAudio +
          '   latencia de salida: ' + this.reloj.latenciaSalida.toFixed(1) + ' ms\n' +
        'bpm ' + RITMO.BPM + ' · ' + RITMO.PX_POR_PULSO + ' px/pulso · vel ' +
          VELOCIDAD.toFixed(0) + ' px/s\n' +
        'gravedad ' + GRAVEDAD.toFixed(0) + ' · impulso ' + VELOCIDAD_SALTO.toFixed(0) +
          ' · altura ' + RITMO.ALTURA_SALTO + ' px\n' +
        'virtual ' + PANTALLA.ANCHO + 'x' + PANTALLA.ALTO +
          ' · canvas ' + c.width + 'x' + c.height +
          ' · ventana ' + window.innerWidth + 'x' + window.innerHeight +
          ' · dpr ' + window.devicePixelRatio + '\n' +
        'entrada: ' + (this.entrada.esTactil ? 'táctil' : 'teclado/mouse') +
          ' · render: ' + (this.game.renderer.type === Phaser.WEBGL ? 'WebGL' : 'Canvas')
      );
    }
  }
}
