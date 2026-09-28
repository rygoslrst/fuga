// ============================================================================
//  config.js — TODOS los números que definen cómo se siente FUGA
// ----------------------------------------------------------------------------
//  Si algo "se siente mal", se toca acá. Lo que está debajo de cada bloque
//  marcado DERIVADO se calcula solo: no lo edites a mano.
// ============================================================================

// --- Pantalla ---------------------------------------------------------------
// Resolución virtual FIJA. Phaser la escala a cualquier pantalla. Mantenerla
// chica es la decisión que más cuadros por segundo ahorra en un celular.
export const ANCHO = 960;
export const ALTO = 540;

// El ALTO es fijo; el ancho visible se adapta a la pantalla. En un celular
// alargado (19.5:9) el mundo se ensancha en vez de dejar franjas negras a los
// costados, y de paso se ve venir lo que viene con más anticipación.
export const VISTA = { ancho: ANCHO };
export function anchoParaPantalla(w, h) {
  const r = w / h;
  if (!(r > ANCHO / ALTO)) return ANCHO;          // 16:9 o más cuadrado: base
  return Math.min(1280, Math.round((ALTO * r) / 2) * 2);   // hasta 21:9
}

// Dónde corre el jugador en la pantalla. Más a la izquierda = más anticipación
// para ver lo que viene, pero menos lugar para ver al perseguidor.
export const JUGADOR_X = 330;

// --- Ritmo ------------------------------------------------------------------
// El mundo avanza PX_POR_PULSO píxeles por cada pulso de la música, y un salto
// dura exactamente un pulso. Así todo lo que aparece cae sobre la grilla y la
// música coincide con los pasos, aunque el jugador nunca piense en "ritmo".
export const RITMO = {
  BPM_INICIAL: 112,
  BPM_FINAL: 138,          // se llega acá después de SEGUNDOS_HASTA_BPM_FINAL
  SEGUNDOS_HASTA_BPM_FINAL: 100,
  PX_POR_PULSO: 280,
  COLUMNAS_POR_PULSO: 4,   // resolución de las grillas de segmentos
};
export const PX_POR_COLUMNA = RITMO.PX_POR_PULSO / RITMO.COLUMNAS_POR_PULSO; // 70

// --- Salto ------------------------------------------------------------------
// Altura del salto en píxeles. La duración NO se configura: es un pulso.
// La gravedad sale sola de altura y duración:  g = 8h / T²,  v0 = 4h / T
export const SALTO = {
  ALTURA: 150,
  COYOTE_MS: 100,          // podés saltar hasta 100 ms después de dejar el borde
  BUFFER_MS: 140,          // si apretás 140 ms antes de tocar el piso, salta igual
};

// --- Deslizarse ---------------------------------------------------------------
export const DESLIZ = {
  PULSOS: 1,               // cuánto dura una barrida
  BUFFER_MS: 160,
  // Apretar deslizar en el aire, antes de aterrizar desde una caída alta,
  // convierte el aterrizaje en una voltereta (truco + bonus).
  VOLTERETA_CAIDA_MIN: 40, // px de caída mínima para que cuente como voltereta
};

// --- Terreno ------------------------------------------------------------------
// Los techos van en niveles. Nivel 0 = el más bajo. Subir un nivel se salta
// fácil; los segmentos nunca piden subir dos de golpe.
export const TERRENO = {
  NIVEL_0_Y: 468,
  ALTO_NIVEL: 52,
  NIVEL_MAX: 3,
  LINEA_MUERTE: ALTO + 140, // si los pies pasan de acá, te caíste
  // Un escalón que no saltaste lo trepás solo (como en Vector), en este tiempo.
  // También si un salto queda corto por poco y te agarrás del borde.
  TREPA_ESCALON_S: 0.16,
};
export const yDeNivel = n => TERRENO.NIVEL_0_Y - n * TERRENO.ALTO_NIVEL;

// --- El perseguidor ---------------------------------------------------------
// No hay vidas: hay un tipo atrás tuyo. La "ventaja" es la distancia en píxeles
// que te separa. Si llega a cero, te atrapó.
export const PERSEGUIDOR = {
  VENTAJA_INICIAL: 300,    // en el título se lo ve asomando por el borde izquierdo
  VENTAJA_MAX: 280,
  RECUPERA_POR_SEG: 3,     // al principio, si corrés limpio, se va quedando atrás
  ACELERA_POR_SEG: 0.07,   // pero cada segundo corre un poco más: pasado el minuto
                           // se te acerca solo, y sólo los trucos lo mantienen lejos
  CASTIGO_GOLPE: 90,       // cada choque lo acerca esto
  CASTIGO_HUECO: 135,      // caer en un hueco: te agarrás del borde, pero cuesta más
  CASTIGO_ESCALON: 30,     // trepar un escalón sin saltarlo: no es un choque, pero frena
  PREMIO_TRUCO: 2,         // cada truco lo aleja un poquito
  PREMIO_COMBO_5: 15,      // y cada 5 de combo, un tirón
  INVULNERABLE_MS: 700,    // después de un choque, no podés chocar de nuevo
  ESCALA: 1.18,            // es más grande que vos
};

// --- Puntaje ------------------------------------------------------------------
export const PUNTOS = {
  PX_POR_METRO: 40,
  TRUCO: { valla: 50, barrida: 50, vuelo: 30, voltereta: 80, subida: 20 },
  COMBO_MAX: 20,
  // Las monedas están sobre el arco de un salto bien hecho y debajo de los
  // carteles: premian saltar a tiempo sin que haga falta explicarlo.
  MONEDA: 10,
};

// --- Rendimiento --------------------------------------------------------------
export const RENDIMIENTO = {
  PARTICULAS_MAX: 48,
  TEXTOS_FLOTANTES_MAX: 6,
  EDIFICIOS_POOL: 14,
  VENTANAS_POOL: 180,
  OBSTACULOS_POOL: 24,
  MONEDAS_POOL: 48,
};

// --- Colores --------------------------------------------------------------------
// Atardecer: siluetas oscuras contra un cielo que se aclara hacia abajo, que
// es donde corren los personajes. Contraste máximo justo donde hace falta.
export const COLOR = {
  CIELO: [0x241640, 0x5a2a66, 0xb8456f, 0xf07a5a, 0xffc278], // de arriba a abajo
  LEJOS_2: 0xd8697a,       // skyline más lejano: el más claro
  LEJOS_1: 0x8a3868,
  EDIFICIO: 0x150f26,      // techos donde corrés y obstáculos
  VENTANA: 0xffcf7a,
  JUGADOR: 0x0b0a14,
  BUFANDA: 0x3ff2d0,       // la firma del jugador: se lo distingue al instante
  PERSEGUIDOR: 0x7a0a22,
  OJOS: 0xff3040,
  PELIGRO: 0xff2a3d,
  TEXTO: 0xfff4e0,
  ORO: 0xffd166,
};

// ============================================================================
//  DERIVADOS
// ============================================================================
export const segPorPulso = bpm => 60 / bpm;
export const velocidad = bpm => RITMO.PX_POR_PULSO * bpm / 60;   // px/s

// Parámetros de un salto a un BPM dado. Cada salto guarda los suyos al despegar,
// así si el tempo sube a mitad de salto, el arco no cambia en el aire.
export function fisicaSalto(bpm) {
  const T = segPorPulso(bpm);
  const g = (8 * SALTO.ALTURA) / (T * T);
  const v0 = (4 * SALTO.ALTURA) / T;
  return { T, g, v0 };
}

// Tempo objetivo según el tiempo de carrera. Sube lento y en escalones de a 2 BPM
// para que la música no "patine".
export function bpmParaTiempo(seg) {
  const k = Math.min(1, seg / RITMO.SEGUNDOS_HASTA_BPM_FINAL);
  const bpm = RITMO.BPM_INICIAL + (RITMO.BPM_FINAL - RITMO.BPM_INICIAL) * k;
  return Math.round(bpm / 2) * 2;
}

export const DEBUG = new URLSearchParams(location.search).has('debug');
export const CLAVE_RECORD = 'fuga_record_v1';
export const CLAVE_TUTORIAL = 'fuga_tutorial_visto_v2';
export const CLAVE_SONIDO = 'fuga_sonido_v1';
