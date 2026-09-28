// ============================================================================
//  Juego.js — la única escena
// ----------------------------------------------------------------------------
//  Título, carrera, lección del tutorial, muerte y fin de partida son ESTADOS
//  de una misma escena, no escenas distintas. Por eso reintentar es instantáneo: no se carga ni se
//  crea nada, sólo se reacomodan los objetos que ya existen.
// ============================================================================

import { ANCHO, ALTO, VISTA, JUGADOR_X, RITMO, PERSEGUIDOR, PUNTOS, COLOR, DEBUG,
         CLAVE_RECORD, CLAVE_TUTORIAL, PX_POR_COLUMNA as COL, bpmParaTiempo } from '../config.js';
import { crearAtlas } from '../motor/Atlas.js';
import { Generador } from '../juego/Generador.js';
import { Mundo } from '../juego/Mundo.js';
import { Jugador } from '../juego/Jugador.js';
import { FR } from '../motor/Sprites.js';
import { Perseguidor } from '../juego/Perseguidor.js';
import { Efectos } from '../juego/Efectos.js';
import { Hud } from '../juego/Hud.js';

const X_INICIO = 8 * COL;
const FIN_TUTORIAL = 96;     // columna donde terminan los tramos de introducción
const GESTO = { UMBRAL_PX: 22, TOQUE_MS: 100 };
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
    this.imagenPersonaje = datos.imagenPersonaje;
  }

  create() {
    this.prepararAtlas();
    this.crearFondo();
    this.generador = new Generador();
    this.mundo = new Mundo(this);
    this.efectos = new Efectos(this);
    this.jugador = new Jugador(this, this.mundo, this.audio);
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
    const { canvas, marcos, meta, xmlFuente } = crearAtlas(this.imagenPersonaje);
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
  //  Entrada
  // --------------------------------------------------------------------------
  //  Celular: deslizar el dedo hacia ARRIBA salta, hacia ABAJO se barre, y un
  //  toque en cualquier lado también salta. El dedo va para donde va el
  //  personaje: no hace falta explicarlo. El toque suelto que salta es la red
  //  para el que no sabe nada: tocando, ya juega.
  //  Computadora: ↑ / espacio saltan, ↓ se barre (y el mouse funciona igual
  //  que el dedo).
  //
  //  Se usan eventos nativos y no los de Phaser, para tomar la hora exacta.
  conectarEntrada() {
    const canvas = this.game.canvas;
    this.gestos = [];   // dedos apoyados: { id, x, y, t, hecho }

    canvas.addEventListener('pointerdown', e => {
      if (e.pointerType === 'touch') this.esTactil = true;
      if (!this.recibeEntrada || performance.now() < this.ignorarHasta) return;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* nada */ }
      this.gestos.push({ id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), hecho: false });
    });
    canvas.addEventListener('pointermove', e => {
      const g = this.gesto(e.pointerId);
      if (!g || g.hecho || !this.recibeEntrada) return;
      const dx = e.clientX - g.x, dy = e.clientY - g.y;
      if (Math.abs(dy) >= GESTO.UMBRAL_PX && Math.abs(dy) > Math.abs(dx) * 0.6) {
        g.hecho = true;
        this.accion(dy < 0 ? 'saltar' : 'deslizar');
      }
    });
    const soltar = e => {
      const g = this.gesto(e.pointerId);
      if (!g) return;
      this.gestos.splice(this.gestos.indexOf(g), 1);
      if (!g.hecho && e.type === 'pointerup' && this.recibeEntrada) this.accion('saltar');
    };
    canvas.addEventListener('pointerup', soltar);
    canvas.addEventListener('pointercancel', soltar);

    window.addEventListener('keydown', e => {
      if (e.repeat || !this.recibeEntrada || performance.now() < this.ignorarHasta) return;
      switch (e.code) {
        case 'Space': case 'ArrowUp': case 'KeyW': case 'KeyZ':
          this.esTactil = false; this.accion('saltar'); e.preventDefault(); break;
        case 'ArrowDown': case 'KeyS': case 'KeyX': case 'ShiftLeft':
          this.esTactil = false; this.accion('deslizar'); e.preventDefault(); break;
        case 'Escape': case 'KeyP':
          this.pausar(); break;
      }
    });
  }

  get recibeEntrada() { return this.estado === 'jugando' || this.estado === 'leccion'; }

  gesto(id) {
    for (const g of this.gestos) if (g.id === id) return g;
    return null;
  }

  // Toda entrada termina acá. Corriendo, se le pide la acción al corredor; en
  // una lección del tutorial, sólo el gesto correcto destraba el juego.
  accion(tipo) {
    if (this.estado === 'leccion') {
      if (tipo !== (this.leccion.tipo === 'deslizar' ? 'deslizar' : 'saltar')) { this.hud.sacudir(); return; }
      this.terminarLeccion();
    }
    const t = this.audio.ahora();
    if (tipo === 'saltar') this.jugador.pedirSalto(t);
    else this.jugador.pedirDesliz(t);
  }

  // Un dedo que se apoya y no se mueve cuenta como toque (salto) a los 100 ms,
  // sin esperar a que lo levante: así tocar no se siente lento. En la lección
  // de barrerse no: ese dedo quieto está por deslizar hacia abajo.
  revisarGestos() {
    if (this.estado === 'leccion' && this.leccion.tipo === 'deslizar') return;
    const ahora = performance.now();
    for (const g of this.gestos) {
      if (!g.hecho && ahora - g.t >= GESTO.TOQUE_MS) {
        g.hecho = true;
        this.accion('saltar');
      }
    }
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
    this.leccionSig = null;
    this.ultLeccion = -1;
    this.rachaMonedas = 0;
    this.tUltMoneda = -9;
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
    this.gestos.length = 0;
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
    this.gestos.length = 0;
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
      case 'leccion': this.cuadroLeccion(dt); break;
      case 'muriendo':
      case 'fin': this.cuadroMuerte(dt); break;
    }
  }

  cuadroTitulo(dt) {
    const t = performance.now() / 1000;
    this.jugador.dibujar(t, 0);
    this.perseguidor.actualizar(X_INICIO, this.ventaja, FR.quieto[Math.floor(t * 3.2) & 3], t);
    this.efectos.actualizar(dt, 0);
  }

  cuadroCarrera(dt) {
    let t = this.audio.ahora();
    this.bpmObjetivo = bpmParaTiempo(Math.max(0, t - this.tInicio));
    this.audio.programar(this.bpmObjetivo);

    // Hit-stop: al chocar, la imagen se congela 70 ms. Se mide con el reloj
    // del juego (no con el del sistema) y después la simulación recorre ese
    // tramo en pasitos, así que no se atraviesa nada.
    if (t < this.congeladoHasta) return;

    this.revisarGestos();
    // Tutorial: si en este cuadro se llega al punto de una lección, se simula
    // exactamente hasta ahí y el juego se congela en ese instante.
    let lec = this.conIntro ? this.proximaLeccion() : null;
    if (lec) {
      const tL = this.audio.tiempoDeBeat((lec.x - X_INICIO) / RITMO.PX_POR_PULSO);
      if (tL <= t) t = Math.max(this.tPrev, tL);
      else lec = null;
    }
    this.jugador.paso(this.tPrev, t, this.xEn);
    this.tPrev = t;
    if (this.estado !== 'jugando') return;                    // murió en este cuadro
    if (lec) this.llegarALeccion(lec, t);

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

    this.efectos.actualizar(dt, peligro);
    this.fondo();

    this.metros = Math.max(0, Math.floor((this.jugador.x - X_INICIO) / PUNTOS.PX_POR_METRO));
    this.puntos = this.metros + this.jugador.puntosTrucos + this.jugador.monedas * PUNTOS.MONEDA;
    this.hud.actualizar(this.puntos, this.metros, c, this.jugador.monedas, dt);
    if (this.conIntro && this.jugador.x > FIN_TUTORIAL * COL) this.tutorialVisto();
  }

  cuadroMuerte(dt) {
    if (performance.now() < this.congeladoMuerte) return;
    const t = performance.now() / 1000;
    this.jugador.actualizarMuerte(dt);
    this.jugador.dibujar(t, 0);
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

  alEscalon() {
    this.ventaja -= PERSEGUIDOR.CASTIGO_ESCALON;
    this.efectos.polvo(this.jugador.x + 12, this.jugador.y, 4, 1);
    this.audio.trepada();
  }

  alMoneda(x, y) {
    const t = this.audio.ahora();
    this.rachaMonedas = t - this.tUltMoneda < 0.5 ? this.rachaMonedas + 1 : 0;
    this.tUltMoneda = t;
    this.efectos.chispas(x, y, 3, COLOR.ORO);
    this.audio.moneda(this.rachaMonedas);
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
    if (this.conIntro) this.tutorialVisto();
    this.hud.mostrar(false);
    this.ui.mostrarFin({
      causa: this.causa, puntos: this.puntos, metros: this.metros, monedas: this.jugador.monedas,
      record: this.record, nuevo, trucos: this.jugador.trucos, combo: this.mejorCombo,
    });
  }

  // --------------------------------------------------------------------------
  //  Tutorial: sólo la primera partida en este teléfono. Como en Vector, al
  //  llegar a cada cosa nueva el juego se congela en el instante justo y
  //  espera el gesto. Hecho ahí, sale perfecto: nadie pierde aprendiendo.
  //  (Los escalones no tienen lección: si no los saltás, los trepás solo.)
  // --------------------------------------------------------------------------
  proximaLeccion() {
    if (this.leccionSig) return this.leccionSig;
    const m = this.mundo;
    const c0 = Math.max(this.ultLeccion + 1, Math.floor(this.jugador.x / COL));
    for (let c = c0; c <= c0 + 10 && c < FIN_TUTORIAL; c++) {
      // El punto donde se congela es el despegue ideal: el mismo arco donde
      // están las monedas (ver Generador.ubicarMonedas).
      let tipo = null, x = 0;
      if (m.obstEn(c)) { tipo = 'saltar'; x = c * COL + COL / 2 - RITMO.PX_POR_PULSO / 2; }
      else if (m.barraEn(c)) { tipo = 'deslizar'; x = c * COL - 60; }
      else if (m.hayHueco(c)) { tipo = 'hueco'; x = c * COL - COL / 2; }
      if (tipo) { this.leccionSig = { tipo, x, col: c }; return this.leccionSig; }
    }
    return null;
  }

  llegarALeccion(lec, t) {
    this.leccionSig = null;
    this.ultLeccion = lec.col + 3;
    // Si ya lo resolvió solo (está en el aire, barriéndose o recién pidió la
    // acción), esta lección no hace falta.
    const j = this.jugador;
    if (j.estado !== 'suelo' || t - j.pedidoSalto < 0.2 || t - j.pedidoDesliz < 0.2) return;
    this.leccion = lec;
    this.estado = 'leccion';
    this.audio.congelar(t);
    this.audio.pausaLeccion();
    this.ignorarHasta = performance.now() + 200;
  }

  cuadroLeccion(dt) {
    this.revisarGestos();
    if (this.estado !== 'leccion') return;
    const tipo = this.leccion.tipo, arriba = tipo !== 'deslizar';
    const salto = this.esTactil ? 'DESLIZÁ EL DEDO HACIA ARRIBA ↑' : 'APRETÁ ESPACIO O ↑';
    const desliz = this.esTactil ? 'DESLIZÁ EL DEDO HACIA ABAJO ↓' : 'APRETÁ ↓ O S';
    const titulo = tipo === 'saltar' ? '¡SALTÁ!' : tipo === 'hueco' ? '¡SALTÁ EL HUECO!' : '¡BARRETE!';
    this.hud.leccion(titulo, arriba ? salto : desliz, arriba,
      JUGADOR_X - 80, this.jugador.y - (arriba ? 70 : 150), dt);
  }

  terminarLeccion() {
    this.audio.descongelar();
    this.estado = 'jugando';
    this.tPrev = this.audio.ahora();
    this.hud.ocultarPista();
  }

  tutorialVisto() {
    this.conIntro = false;
    this.tutorialPendiente = false;
    guardar(CLAVE_TUTORIAL, '1');
  }

  medirFps(time) {
    if (!DEBUG) return;
    const f = Math.round(this.game.loop.actualFps);
    if (f < this.fps.peor) this.fps.peor = f;
    if (time - this.fps.desde > 3000) { this.fps.peor = f; this.fps.desde = time; }
    this.hud.medirFps(f, this.fps.peor);
  }
}
