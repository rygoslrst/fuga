// ============================================================================
//  Juego.js — la única escena
// ----------------------------------------------------------------------------
//  Título, carrera, muerte y fin de partida son ESTADOS de una misma escena,
//  no escenas distintas. Por eso reintentar es instantáneo: no se carga ni se
//  crea nada, sólo se reacomodan los objetos que ya existen.
// ============================================================================

import { ANCHO, ALTO, VISTA, JUGADOR_X, RITMO, PERSEGUIDOR, PUNTOS, COLOR, DEBUG,
         CLAVE_RECORD, CLAVE_TUTORIAL, PX_POR_COLUMNA as COL, bpmParaTiempo } from '../config.js';
import { crearAtlas } from '../motor/Atlas.js';
import { Generador } from '../juego/Generador.js';
import { Mundo, ESTADO } from '../juego/Mundo.js';
import { Jugador, FR } from '../juego/Jugador.js';
import { Perseguidor } from '../juego/Perseguidor.js';
import { Efectos } from '../juego/Efectos.js';
import { Hud } from '../juego/Hud.js';

const X_INICIO = 8 * COL;
const NOMBRE_TRUCO = { valla: 'VALLA', barrida: 'BARRIDA', vuelo: 'VUELO', voltereta: 'VOLTERETA', subida: 'SUBIDA' };
const limitar = (v, a, b) => (v < a ? a : v > b ? b : v);

// La vibración sólo después de que el jugador tocó la pantalla (si no, el
// navegador la bloquea y llena la consola de avisos).
function vibrar(patron) {
  if (navigator.vibrate && (!navigator.userActivation || navigator.userActivation.hasBeenActive)) {
    navigator.vibrate(patron);
  }
}

function leer(clave, porDefecto) {
  try { const v = localStorage.getItem(clave); return v === null ? porDefecto : v; } catch (e) { return porDefecto; }
}
function guardar(clave, valor) {
  try { localStorage.setItem(clave, valor); } catch (e) { /* modo privado: no pasa nada */ }
}

export class Juego extends Phaser.Scene {
  constructor() { super('Juego'); }

  init(datos) {
    this.audio = datos.audio;
    this.ui = datos.ui;
  }

  create() {
    this.prepararAtlas();
    this.crearFondo();
    this.generador = new Generador();
    this.mundo = new Mundo(this);
    this.efectos = new Efectos(this);
    this.jugador = new Jugador(this, this.mundo, this.audio, this.meta);
    this.perseguidor = new Perseguidor(this, this.mundo, this.meta);
    this.hud = new Hud(this);

    this.record = parseInt(leer(CLAVE_RECORD, '0'), 10) || 0;
    this.tutorialPendiente = leer(CLAVE_TUTORIAL, '') !== '1';
    this.esTactil = window.matchMedia('(pointer: coarse)').matches;
    this.xEn = t => X_INICIO + Math.max(0, this.audio.beatEn(t)) * RITMO.PX_POR_PULSO;
    this.congeladoHasta = 0;
    this.congeladoMuerte = 0;
    this.ignorarHasta = 0;
    this.fps = { peor: 99, desde: 0 };

    this.conectarEntrada();
    this.irATitulo();
    this.redimensionar(VISTA.ancho);
    this.ui.conectar(this);
    if (DEBUG) window.escena = this;
  }

  // --------------------------------------------------------------------------
  //  Preparación
  // --------------------------------------------------------------------------
  prepararAtlas() {
    const { canvas, marcos, meta, xmlFuente } = crearAtlas();
    const tex = this.textures.addCanvas('atlas', canvas);
    for (const m of marcos) tex.add(m.nombre, 0, m.x, m.y, m.w, m.h);
    this.meta = meta;
    const xml = new DOMParser().parseFromString(xmlFuente, 'text/xml');
    this.cache.xml.add('fuente_xml', xml);
    Phaser.GameObjects.BitmapText.ParseFromAtlas(this, 'anton', 'atlas', 'fuente', 'fuente_xml');
  }

  crearFondo() {
    const fijo = (frame, d) => this.add.image(0, 0, 'atlas', frame).setOrigin(0, 0).setScrollFactor(0).setDepth(d);
    this.cielo = fijo('cielo', 0).setDisplaySize(ANCHO, ALTO);
    this.sol = this.add.image(700, 340, 'atlas', 'sol').setScrollFactor(0).setDisplaySize(320, 320)
      .setTint(0xffd98a).setDepth(1);
    this.nubes = [];
    for (let i = 0; i < 5; i++) {
      this.nubes.push({
        img: this.add.image(0, 0, 'atlas', 'blanco').setScrollFactor(0).setTint(0xffc9a8)
          .setAlpha(0.18 + (i % 3) * 0.06).setDisplaySize(180 + i * 50, 5 + (i % 2) * 3).setDepth(1.5),
        base: i * 290, y: 70 + i * 38, vel: 0.03 + i * 0.012,
      });
    }
    // Tres copias de cada franja de ciudad: alcanzan para cualquier ancho hasta 1920.
    this.lejos = [fijo('ciudad_lejos', 2), fijo('ciudad_lejos', 2), fijo('ciudad_lejos', 2)];
    this.medio = [fijo('ciudad_medio', 3), fijo('ciudad_medio', 3), fijo('ciudad_medio', 3)];
    for (const i of this.lejos) i.setTint(COLOR.LEJOS_2).setY(470 - 190);
    for (const i of this.medio) i.setTint(COLOR.LEJOS_1).setY(560 - 250);
  }

  fondo() {
    const x = this.camX;
    const f1 = (x * 0.12) % ANCHO, f2 = (x * 0.3) % ANCHO;
    for (let k = 0; k < 3; k++) {
      this.lejos[k].x = k * ANCHO - f1;
      this.medio[k].x = k * ANCHO - f2;
    }
    const ancho = VISTA.ancho + 400;
    for (const n of this.nubes) {
      let nx = (n.base - x * n.vel) % ancho;
      if (nx < 0) nx += ancho;
      n.img.setPosition(nx - 200, n.y);
    }
  }

  // Cuando cambia el ancho de la pantalla (girar el teléfono, cambiar la ventana).
  redimensionar(w) {
    VISTA.ancho = w;
    this.cameras.main.setSize(w, ALTO);
    this.cielo.setDisplaySize(w, ALTO);
    this.sol.x = w - 260;
    this.efectos.redimensionar(w);
    this.hud.redimensionar(w);
    this.fondo();
    this.mundo.asegurar(this.camX + w + 700);
  }

  // --------------------------------------------------------------------------
  //  Entrada: eventos nativos, no los de Phaser, para tomar la hora exacta del
  //  toque (Phaser puede procesarlos recién en el cuadro siguiente).
  // --------------------------------------------------------------------------
  conectarEntrada() {
    const canvas = this.game.canvas;
    canvas.addEventListener('pointerdown', e => {
      if (e.pointerType === 'touch') this.esTactil = true;
      if (this.estado !== 'jugando' || performance.now() < this.ignorarHasta) return;
      const r = canvas.getBoundingClientRect();
      const t = this.audio.ahora();
      if ((e.clientX - r.left) / r.width < 0.5) this.jugador.pedirSalto(t);
      else this.jugador.pedirDesliz(t);
    });
    window.addEventListener('keydown', e => {
      if (e.repeat || this.estado !== 'jugando' || performance.now() < this.ignorarHasta) return;
      const t = this.audio.ahora();
      switch (e.code) {
        case 'Space': case 'ArrowUp': case 'KeyW': case 'KeyZ':
          this.esTactil = false; this.jugador.pedirSalto(t); e.preventDefault(); break;
        case 'ArrowDown': case 'KeyS': case 'KeyX': case 'ShiftLeft':
          this.esTactil = false; this.jugador.pedirDesliz(t); e.preventDefault(); break;
        case 'Escape': case 'KeyP':
          this.pausar(); break;
      }
    });
  }

  // --------------------------------------------------------------------------
  //  Estados
  // --------------------------------------------------------------------------
  reiniciarMundo(conIntro) {
    this.generador.reiniciar(conIntro);
    this.mundo.reiniciar(this.generador);
    this.jugador.reiniciar(X_INICIO);
    this.perseguidor.reiniciar();
    this.efectos.limpiar();
    this.conIntro = conIntro;
    this.ventaja = PERSEGUIDOR.VENTAJA_INICIAL;
    this.camX = X_INICIO - JUGADOR_X;
    this.cameras.main.scrollX = this.camX;
    this.mundo.asegurar(this.camX + VISTA.ancho + 700);
    this.mundo.actualizar(this.camX, 0);
    this.puntos = 0;
    this.metros = 0;
    this.mejorCombo = 0;
    this.fondo();
  }

  irATitulo() {
    this.estado = 'titulo';
    this.reiniciarMundo(this.tutorialPendiente);
    this.perseguidor.visible(true);
    this.hud.mostrar(false);
  }

  // Lo llama la interfaz, con el audio ya desbloqueado.
  empezar() {
    if (this.estado === 'jugando') return;
    if (this.estado !== 'titulo') this.reiniciarMundo(false);
    this.estado = 'jugando';
    this.ignorarHasta = performance.now() + 150;
    this.tInicio = this.audio.iniciarCarrera(RITMO.BPM_INICIAL);
    this.tPrev = this.tInicio;
    this.congeladoHasta = 0;
    this.bpmObjetivo = RITMO.BPM_INICIAL;
    this.jugador.empezar();
    this.perseguidor.visible(true);
    this.hud.reiniciar(this.record);
    this.hud.mostrar(true);
    this.audio.arranque();
  }

  pausar() {
    if (this.estado !== 'jugando') return;
    this.estado = 'pausa';
    this.audio.pausar();
    this.hud.ocultarPista();
    this.ui.mostrarPausa(true);
  }

  async seguir() {
    if (this.estado !== 'pausa') return;
    await this.audio.reanudar();
    this.jugador.pedidoSalto = this.jugador.pedidoDesliz = -9;
    this.ignorarHasta = performance.now() + 150;
    this.tPrev = this.audio.ahora();
    this.estado = 'jugando';
    this.ui.mostrarPausa(false);
  }

  // --------------------------------------------------------------------------
  //  Bucle
  // --------------------------------------------------------------------------
  update(time, deltaMs) {
    const dt = Math.min(0.05, deltaMs / 1000);
    this.medirFps(time);
    switch (this.estado) {
      case 'titulo': this.cuadroTitulo(dt); break;
      case 'jugando': this.cuadroCarrera(dt); break;
      case 'muriendo':
      case 'fin': this.cuadroMuerte(dt); break;
    }
  }

  cuadroTitulo(dt) {
    const t = performance.now() / 1000;
    this.jugador.dibujar(t, 0);
    this.jugador.dibujarBufanda(t, dt);
    this.perseguidor.actualizar(X_INICIO, this.ventaja, FR.quieto[Math.floor(t * 3.2) & 3], t);
    this.efectos.actualizar(dt, 0);
  }

  cuadroCarrera(dt) {
    const t = this.audio.ahora();
    this.bpmObjetivo = bpmParaTiempo(Math.max(0, t - this.tInicio));
    this.audio.programar(this.bpmObjetivo);

    // Hit-stop: al chocar, la imagen se congela 70 ms. Se mide con el reloj
    // del juego (no con el del sistema) y después la simulación recorre ese
    // tramo en pasitos, así que no se atraviesa nada.
    if (t < this.congeladoHasta) return;

    this.jugador.paso(this.tPrev, t, this.xEn);
    this.tPrev = t;
    if (this.estado !== 'jugando') return;                    // murió en este cuadro

    const beat = this.audio.beatEn(t);
    this.camX = this.jugador.x - JUGADOR_X;
    this.cameras.main.scrollX = this.camX;
    this.mundo.asegurar(this.camX + VISTA.ancho + 700);
    this.mundo.actualizar(this.camX, dt);

    // La ventaja: se recupera corriendo limpio; si arrancó por encima del
    // máximo (entrando desde el borde), baja rápido hasta su lugar.
    if (this.ventaja > PERSEGUIDOR.VENTAJA_MAX) {
      this.ventaja = Math.max(PERSEGUIDOR.VENTAJA_MAX, this.ventaja - 70 * dt);
    } else {
      const deriva = PERSEGUIDOR.RECUPERA_POR_SEG - PERSEGUIDOR.ACELERA_POR_SEG * (t - this.tInicio);
      this.ventaja = Math.min(PERSEGUIDOR.VENTAJA_MAX, this.ventaja + deriva * dt);
    }

    this.jugador.dibujar(t, beat);
    this.perseguidor.registrar(this.jugador.x, this.jugador.y, this.jugador.frame, this.jugador.angulo);
    this.perseguidor.actualizar(this.jugador.x, this.ventaja, null, t);
    if (this.ventaja <= 16) { this.atrapar(); return; }

    const peligro = limitar((170 - this.ventaja) / 140, 0, 1);
    this.audio.peligro = peligro;
    const c = this.jugador.combo;
    this.audio.intensidad = c >= 14 ? 4 : c >= 9 ? 3 : c >= 5 ? 2 : c >= 2 ? 1 : 0;

    this.jugador.dibujarBufanda(t, dt);
    this.efectos.actualizar(dt, peligro);
    this.fondo();

    this.metros = Math.max(0, Math.floor((this.jugador.x - X_INICIO) / PUNTOS.PX_POR_METRO));
    this.puntos = this.metros + this.jugador.puntosTrucos;
    this.hud.actualizar(this.puntos, this.metros, c, dt);
    if (this.conIntro) this.pistas();
  }

  cuadroMuerte(dt) {
    if (performance.now() < this.congeladoMuerte) return;
    const t = performance.now() / 1000;
    this.jugador.actualizarMuerte(dt);
    this.jugador.dibujar(t, 0);
    this.jugador.dibujarBufanda(t, dt);
    if (this.causa === 'atrapado') {
      this.ventaja = Math.max(-18, this.ventaja - 260 * dt);
      this.perseguidor.actualizar(this.jugador.muerte.x, this.ventaja, FR.alcanzar[Math.floor(t * 9) & 1], t);
    }
    this.efectos.actualizar(dt, this.causa === 'atrapado' ? 1 : 0.3);
    this.mundo.actualizar(this.camX, dt);
    if (this.estado === 'muriendo' && performance.now() - this.tMuerte > 1050) this.terminar();
  }

  // --------------------------------------------------------------------------
  //  Eventos del juego
  // --------------------------------------------------------------------------
  alGolpe(tipo) {
    this.ventaja -= tipo === 'hueco' ? PERSEGUIDOR.CASTIGO_HUECO : PERSEGUIDOR.CASTIGO_GOLPE;
    this.cameras.main.shake(160, 0.012);
    this.efectos.destello(COLOR.PELIGRO, 0.35);
    this.efectos.escombros(this.jugador.x + 22, this.jugador.y - 28, tipo === 'cartel' ? 5 : 8);
    this.congeladoHasta = this.audio.ahora() + 0.07;
    this.audio.golpe();
    vibrar(60);
  }

  alTruco(tipo, combo, pts) {
    this.mejorCombo = Math.max(this.mejorCombo, combo);
    const premio = PERSEGUIDOR.PREMIO_TRUCO + (combo % 5 === 0 ? PERSEGUIDOR.PREMIO_COMBO_5 : 0);
    this.ventaja = Math.min(PERSEGUIDOR.VENTAJA_MAX, this.ventaja + premio);
    const dorado = combo >= 5;
    this.efectos.texto(JUGADOR_X + 16, this.jugador.y - 118,
      combo >= 2 ? `${NOMBRE_TRUCO[tipo]} +${pts}` : NOMBRE_TRUCO[tipo], dorado ? COLOR.ORO : COLOR.TEXTO, 28);
    this.efectos.chispas(this.jugador.x, this.jugador.y - 42, dorado ? 9 : 6, dorado ? COLOR.ORO : COLOR.BUFANDA);
    this.audio.truco(combo);
  }

  alMorir(causa) {
    this.estado = 'muriendo';
    this.causa = causa;
    this.tMuerte = performance.now();
    this.hud.ocultarPista();
    this.audio.detenerMusica(false);
    if (causa === 'caida') this.audio.caida();
  }

  atrapar() {
    this.jugador.morir('atrapado', this.jugador.x);
    this.audio.atrapado();
    this.cameras.main.shake(320, 0.02);
    this.efectos.destello(COLOR.PELIGRO, 0.75);
    this.congeladoMuerte = performance.now() + 130;
    vibrar([80, 40, 140]);
  }

  terminar() {
    this.estado = 'fin';
    const nuevo = this.puntos > this.record && this.puntos > 0;
    if (nuevo) {
      this.record = this.puntos;
      guardar(CLAVE_RECORD, String(this.record));
      this.audio.record();
    }
    if (this.conIntro) {
      this.tutorialPendiente = false;
      guardar(CLAVE_TUTORIAL, '1');
    }
    this.hud.mostrar(false);
    this.ui.mostrarFin({
      causa: this.causa, puntos: this.puntos, metros: this.metros,
      record: this.record, nuevo, trucos: this.jugador.trucos, combo: this.mejorCombo,
    });
  }

  // --------------------------------------------------------------------------
  //  Tutorial: sólo la primera vez en este teléfono. Te dice qué tocar justo
  //  antes de cada cosa nueva.
  // --------------------------------------------------------------------------
  pistas() {
    const x = this.jugador.x;
    if (x > 64 * COL) { this.conIntro = false; this.hud.ocultarPista(); return; }
    const c0 = Math.floor((x + 30) / COL), c1 = Math.floor((x + 400) / COL);
    let tipo = null;
    for (let c = c0; c <= c1 && !tipo; c++) {
      if (this.mundo.estadoEn(c) === ESTADO.PENDIENTE && this.mundo.obstEn(c)) tipo = 'saltar';
      else if (this.mundo.estadoEn(c) === ESTADO.PENDIENTE && this.mundo.barraEn(c)) tipo = 'deslizar';
      else if (this.mundo.hayHueco(c)) tipo = 'hueco';
      else if (this.mundo.nivelEnCol(c) > this.mundo.nivelEnCol(c - 1) && this.mundo.nivelEnCol(c - 1) >= 0) tipo = 'subir';
    }
    if (!tipo) { this.hud.ocultarPista(); return; }
    const salto = this.esTactil ? 'TOCÁ LA MITAD IZQUIERDA' : 'ESPACIO O ↑';
    const desliz = this.esTactil ? 'TOCÁ LA MITAD DERECHA' : '↓ O S';
    const TXT = {
      saltar: ['¡SALTÁ!', salto], hueco: ['¡SALTÁ EL HUECO!', salto],
      subir: ['¡SALTÁ PARA SUBIR!', salto], deslizar: ['¡DESLIZATE!', desliz],
    };
    this.hud.pistaVisible(TXT[tipo][0], TXT[tipo][1]);
  }

  medirFps(time) {
    if (!DEBUG) return;
    const f = Math.round(this.game.loop.actualFps);
    if (f < this.fps.peor) this.fps.peor = f;
    if (time - this.fps.desde > 3000) { this.fps.peor = f; this.fps.desde = time; }
    this.hud.medirFps(f, this.fps.peor);
  }
}
