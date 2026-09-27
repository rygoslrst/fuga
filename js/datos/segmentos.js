// ============================================================================
//  segmentos.js — LA BIBLIOTECA
// ----------------------------------------------------------------------------
//  Nunca se escribe un nivel entero a mano. Se escriben estos pedazos una vez,
//  y el generador los encadena para siempre siguiendo una curva de dificultad.
//  Agregar uno nuevo = agregar un bloque acá. Nada más.
//
//  Cada columna es un cuarto de pulso (70 px). Un segmento de 4 pulsos = 16
//  columnas. Tres filas, de arriba hacia abajo:
//
//    arriba   =  cartel colgante: hay que DESLIZARSE por debajo
//    medio    c  caja    v  ventilación    m  máquina   → hay que SALTAR
//    suelo    0-3  altura del techo (relativa al comienzo del segmento)
//             _    hueco entre edificios: si caés, perdés
//
//  Reglas que controla el validador (si un segmento las rompe, no se usa):
//    · las 2 primeras y las 2 últimas columnas: techo firme, sin obstáculos
//    · huecos de 3 columnas como máximo (2 si del otro lado hay que subir)
//    · nunca subir más de un nivel de golpe
//    · entre dos cosas que piden salto, al menos 4 columnas (un pulso)
//    · un cartel, al menos 5 columnas después de algo que pide salto
//
//  Obstáculos separados por exactamente 4 columnas piden un salto por pulso:
//  es lo que hace que una secuencia se sienta como música.
// ============================================================================

export const SEGMENTOS = [
  // --------------------------------------------------------------------------
  //  INTRODUCCIÓN — sólo en la primera partida, en este orden
  // --------------------------------------------------------------------------
  { nombre: 'inicio', tipo: 'intro', pulsos: 8, dificultad: 0, exige: 'descanso', grilla: [
    '................................',
    '................................',
    '00000000000000000000000000000000' ] },

  { nombre: 'intro_caja', tipo: 'intro', pulsos: 4, dificultad: 1, exige: 'saltar', grilla: [
    '................',
    '........c.......',
    '0000000000000000' ] },

  { nombre: 'intro_cartel', tipo: 'intro', pulsos: 4, dificultad: 1, exige: 'deslizar', grilla: [
    '........==......',
    '................',
    '0000000000000000' ] },

  { nombre: 'intro_hueco', tipo: 'intro', pulsos: 4, dificultad: 1, exige: 'saltar', grilla: [
    '................',
    '................',
    '0000000__0000000' ] },

  { nombre: 'intro_subida', tipo: 'intro', pulsos: 4, dificultad: 1, exige: 'saltar', grilla: [
    '................',
    '................',
    '0000000011111111' ] },

  // --------------------------------------------------------------------------
  //  DESCANSO
  // --------------------------------------------------------------------------
  { nombre: 'plano', pulsos: 4, dificultad: 1, exige: 'descanso', grilla: [
    '................',
    '................',
    '0000000000000000' ] },

  { nombre: 'plano_corto', pulsos: 2, dificultad: 1, exige: 'descanso', grilla: [
    '........',
    '........',
    '00000000' ] },

  // Bajar no pide nada, pero apretar deslizar en el aire da una voltereta.
  { nombre: 'escalon_abajo', pulsos: 4, dificultad: 1, exige: 'descanso', grilla: [
    '................',
    '................',
    '1111111100000000' ] },

  { nombre: 'escalera_abajo', pulsos: 4, dificultad: 2, exige: 'descanso', grilla: [
    '................',
    '................',
    '2222111100000000' ] },

  // --------------------------------------------------------------------------
  //  SALTAR
  // --------------------------------------------------------------------------
  { nombre: 'caja', pulsos: 4, dificultad: 1, exige: 'saltar', grilla: [
    '................',
    '......c.........',
    '0000000000000000' ] },

  { nombre: 'ventilacion', pulsos: 4, dificultad: 1, exige: 'saltar', grilla: [
    '................',
    '.......v........',
    '0000000000000000' ] },

  { nombre: 'maquina', pulsos: 4, dificultad: 1, exige: 'saltar', grilla: [
    '................',
    '.......m........',
    '0000000000000000' ] },

  { nombre: 'subida', pulsos: 4, dificultad: 1, exige: 'saltar', grilla: [
    '................',
    '................',
    '0000000011111111' ] },

  { nombre: 'hueco_1', pulsos: 4, dificultad: 1, exige: 'saltar', grilla: [
    '................',
    '................',
    '0000000_00000000' ] },

  { nombre: 'cajas_2', pulsos: 4, dificultad: 2, exige: 'saltar', grilla: [
    '................',
    '.....c...v......',
    '0000000000000000' ] },

  { nombre: 'hueco_2', pulsos: 4, dificultad: 2, exige: 'saltar', grilla: [
    '................',
    '................',
    '000000__00000000' ] },

  { nombre: 'escalera_sube', pulsos: 4, dificultad: 2, exige: 'saltar', grilla: [
    '................',
    '................',
    '0000111122222222' ] },

  { nombre: 'caja_arriba', pulsos: 4, dificultad: 2, exige: 'saltar', grilla: [
    '................',
    '............c...',
    '0000000011111111' ] },

  { nombre: 'hueco_baja', pulsos: 4, dificultad: 2, exige: 'saltar', grilla: [
    '................',
    '................',
    '1111111___000000' ] },

  { nombre: 'cajas_3', pulsos: 4, dificultad: 3, exige: 'saltar', grilla: [
    '................',
    '...c...m...c....',
    '0000000000000000' ] },

  { nombre: 'hueco_3', pulsos: 4, dificultad: 3, exige: 'saltar', grilla: [
    '................',
    '................',
    '00000___00000000' ] },

  { nombre: 'huecos_ritmo', pulsos: 4, dificultad: 3, exige: 'saltar', grilla: [
    '................',
    '................',
    '000_000_000_0000' ] },

  { nombre: 'hueco_sube', pulsos: 4, dificultad: 3, exige: 'saltar', grilla: [
    '................',
    '................',
    '000000__11111111' ] },

  { nombre: 'caja_hueco', pulsos: 4, dificultad: 3, exige: 'saltar', grilla: [
    '................',
    '...c............',
    '0000000__0000000' ] },

  { nombre: 'hueco_caja', pulsos: 4, dificultad: 3, exige: 'saltar', grilla: [
    '................',
    '.........c......',
    '000__00000000000' ] },

  { nombre: 'cajas_seis', pulsos: 8, dificultad: 4, exige: 'saltar', grilla: [
    '................................',
    '....c...v...m...c...v...c.......',
    '00000000000000000000000000000000' ] },

  { nombre: 'azoteas', pulsos: 8, dificultad: 4, exige: 'saltar', grilla: [
    '................................',
    '................................',
    '0000_1111_2222__1111___000000000' ] },

  // --------------------------------------------------------------------------
  //  DESLIZAR
  // --------------------------------------------------------------------------
  { nombre: 'cartel', pulsos: 4, dificultad: 1, exige: 'deslizar', grilla: [
    '.......=........',
    '................',
    '0000000000000000' ] },

  { nombre: 'cartel_doble', pulsos: 4, dificultad: 1, exige: 'deslizar', grilla: [
    '.......==.......',
    '................',
    '0000000000000000' ] },

  { nombre: 'cartel_triple', pulsos: 4, dificultad: 2, exige: 'deslizar', grilla: [
    '......===.......',
    '................',
    '0000000000000000' ] },

  { nombre: 'carteles_ritmo', pulsos: 4, dificultad: 3, exige: 'deslizar', grilla: [
    '...=...=...=....',
    '................',
    '0000000000000000' ] },

  // 8 columnas = 2 pulsos: una barrida dura uno, hay que apretar dos veces.
  { nombre: 'cartel_largo', pulsos: 4, dificultad: 3, exige: 'deslizar', grilla: [
    '....========....',
    '................',
    '0000000000000000' ] },

  // --------------------------------------------------------------------------
  //  LAS DOS COSAS
  // --------------------------------------------------------------------------
  { nombre: 'caja_cartel', pulsos: 4, dificultad: 2, exige: 'ambos', grilla: [
    '.........==.....',
    '...c............',
    '0000000000000000' ] },

  { nombre: 'cartel_caja', pulsos: 4, dificultad: 2, exige: 'ambos', grilla: [
    '...==...........',
    '..........c.....',
    '0000000000000000' ] },

  // Caés al techo de abajo y hay un cartel: apretá deslizar en el aire y
  // entrás rodando por debajo. Es la voltereta que más luce.
  { nombre: 'caida_cartel', pulsos: 4, dificultad: 3, exige: 'ambos', grilla: [
    '...........==...',
    '................',
    '1111110000000000' ] },

  { nombre: 'hueco_cartel', pulsos: 4, dificultad: 3, exige: 'ambos', grilla: [
    '..........==....',
    '................',
    '1111__0000000000' ] },

  { nombre: 'sube_cartel', pulsos: 4, dificultad: 3, exige: 'ambos', grilla: [
    '...........=....',
    '................',
    '0000001111111111' ] },

  { nombre: 'cartel_caja_cartel', pulsos: 4, dificultad: 4, exige: 'ambos', grilla: [
    '...==.......==..',
    '.......c........',
    '0000000000000000' ] },

  { nombre: 'alternado', pulsos: 8, dificultad: 4, exige: 'ambos', grilla: [
    '..........==..........==........',
    '....c...........m...........c...',
    '00000000000000000000000000000000' ] },

  { nombre: 'parkour', pulsos: 8, dificultad: 5, exige: 'ambos', grilla: [
    '...........................==...',
    '..............c.................',
    '00000000__11111111111__000000000' ] },

  { nombre: 'huida', pulsos: 8, dificultad: 5, exige: 'ambos', grilla: [
    '....................==..........',
    '...c...........v................',
    '0000000__000000000000000__000000' ] },
];
