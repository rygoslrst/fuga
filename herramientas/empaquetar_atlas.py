#!/usr/bin/env python3
# =============================================================================
#  empaquetar_atlas.py  —  arma UN atlas de texturas con todos los cuadros
#  del personaje y del enemigo.
# -----------------------------------------------------------------------------
#  Por qué: cada textura distinta que Phaser dibuja obliga a la placa de video a
#  cambiar de textura. En un Celeron y en un celular de gama baja eso se paga en
#  cuadros por segundo. Con un solo atlas, todo el juego se dibuja sin cambiar
#  de textura ni una vez.
#
#  Costo de una sola vez: este script. Si mañana agregamos otro enemigo, se
#  vuelve a correr y listo. No hay trabajo manual por sprite.
#
#  Uso, parado en la carpeta del juego:
#      python herramientas/empaquetar_atlas.py
#
#  Lee:     Kings and Pigs.zip  (o assets/img/ si el zip ya no está)
#  Escribe: assets/img/atlas.png  +  assets/img/atlas.json  (formato Phaser Hash)
#
#  No usa PIL a propósito: sólo zlib y struct, que vienen con Python.
# =============================================================================

import json, os, re, struct, sys, zlib

AQUI = os.path.dirname(os.path.abspath(__file__))
JUEGO = os.path.dirname(AQUI)
ENTRADA = os.path.join(JUEGO, 'assets', 'img')
SALIDA_PNG = os.path.join(ENTRADA, 'atlas.png')
SALIDA_JSON = os.path.join(ENTRADA, 'atlas.json')

ATLAS_ANCHO = 512          # potencia de dos: es lo que mejor le cae a WebGL
SEPARACION = 1             # 1px entre cuadros, evita que se filtre el vecino

# Qué entra al atlas. Lo que no está acá no se empaqueta: los tilesets van
# aparte porque se usan como tileset, no como cuadros sueltos.
FUENTES = [
    # (archivo,                              prefijo,  ancho, alto)
    ('01-King Human_Idle (78x58).png',       'rey_quieto',   78, 58),
    ('01-King Human_Run (78x58).png',        'rey_correr',   78, 58),
    ('01-King Human_Jump (78x58).png',       'rey_saltar',   78, 58),
    ('01-King Human_Fall (78x58).png',       'rey_caer',     78, 58),
    ('01-King Human_Ground (78x58).png',     'rey_aterrizar',78, 58),
    ('01-King Human_Attack (78x58).png',     'rey_golpear',  78, 58),
    ('01-King Human_Hit (78x58).png',        'rey_dolor',    78, 58),
    ('01-King Human_Dead (78x58).png',       'rey_morir',    78, 58),

    ('03-Pig_Idle (34x28).png',              'cerdo_quieto', 34, 28),
    ('03-Pig_Run (34x28).png',               'cerdo_correr', 34, 28),
    ('03-Pig_Hit (34x28).png',               'cerdo_dolor',  34, 28),
    ('03-Pig_Dead (34x28).png',              'cerdo_morir',  34, 28),
]


# -----------------------------------------------------------------------------
#  Leer PNG (RGBA de 8 bits, sin entrelazar — que es lo que trae este pack)
# -----------------------------------------------------------------------------
def leer_png(ruta):
    b = open(ruta, 'rb').read()
    if b[:8] != b'\x89PNG\r\n\x1a\n':
        raise ValueError(f'{ruta}: no es un PNG')

    pos, datos_comprimidos = 8, []
    ancho = alto = None
    while pos < len(b):
        largo = struct.unpack('>I', b[pos:pos + 4])[0]
        tipo = b[pos + 4:pos + 8]
        cuerpo = b[pos + 8:pos + 8 + largo]
        if tipo == b'IHDR':
            ancho, alto, prof, color, _, _, entrelazado = struct.unpack('>IIBBBBB', cuerpo)
            if (prof, color, entrelazado) != (8, 6, 0):
                raise ValueError(f'{ruta}: sólo soporto RGBA 8 bits sin entrelazar')
        elif tipo == b'IDAT':
            datos_comprimidos.append(cuerpo)
        elif tipo == b'IEND':
            break
        pos += 12 + largo

    crudo = zlib.decompress(b''.join(datos_comprimidos))
    paso = ancho * 4
    pixeles = bytearray(alto * paso)

    # Deshacer los filtros por fila. Es la única parte fea del formato PNG.
    o = 0
    for y in range(alto):
        filtro = crudo[o]; o += 1
        fila = bytearray(crudo[o:o + paso]); o += paso
        base = y * paso
        arriba = pixeles[base - paso: base] if y else bytes(paso)
        if filtro == 1:                                   # Sub
            for x in range(4, paso):
                fila[x] = (fila[x] + fila[x - 4]) & 255
        elif filtro == 2:                                 # Up
            for x in range(paso):
                fila[x] = (fila[x] + arriba[x]) & 255
        elif filtro == 3:                                 # Average
            for x in range(paso):
                izq = fila[x - 4] if x >= 4 else 0
                fila[x] = (fila[x] + ((izq + arriba[x]) >> 1)) & 255
        elif filtro == 4:                                 # Paeth
            for x in range(paso):
                izq = fila[x - 4] if x >= 4 else 0
                arr = arriba[x]
                diag = arriba[x - 4] if x >= 4 else 0
                p = izq + arr - diag
                pa, pb, pc = abs(p - izq), abs(p - arr), abs(p - diag)
                pred = izq if (pa <= pb and pa <= pc) else (arr if pb <= pc else diag)
                fila[x] = (fila[x] + pred) & 255
        elif filtro != 0:
            raise ValueError(f'{ruta}: filtro {filtro} desconocido')
        pixeles[base:base + paso] = fila

    return ancho, alto, pixeles


def escribir_png(ruta, ancho, alto, pixeles):
    paso = ancho * 4
    crudo = bytearray()
    for y in range(alto):                     # filtro 0 en todas las filas:
        crudo.append(0)                       # el atlas se comprime igual bien
        crudo += pixeles[y * paso:(y + 1) * paso]

    def trozo(tipo, cuerpo):
        return (struct.pack('>I', len(cuerpo)) + tipo + cuerpo +
                struct.pack('>I', zlib.crc32(tipo + cuerpo) & 0xffffffff))

    with open(ruta, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n')
        f.write(trozo(b'IHDR', struct.pack('>IIBBBBB', ancho, alto, 8, 6, 0, 0, 0)))
        f.write(trozo(b'IDAT', zlib.compress(bytes(crudo), 9)))
        f.write(trozo(b'IEND', b''))


def pegar(destino, d_ancho, origen, o_ancho, ox, oy, dx, dy, w, h):
    for y in range(h):
        a = ((oy + y) * o_ancho + ox) * 4
        b = ((dy + y) * d_ancho + dx) * 4
        destino[b:b + w * 4] = origen[a:a + w * 4]


# -----------------------------------------------------------------------------
def main():
    if not os.path.isdir(ENTRADA):
        sys.exit(f'No encuentro {ENTRADA}. ¿Extrajiste el zip?')

    # 1) cortar cada tira en cuadros
    cuadros = []   # (nombre, ancho, alto, pixeles)
    for archivo, prefijo, fw, fh in FUENTES:
        ruta = os.path.join(ENTRADA, archivo)
        if not os.path.exists(ruta):
            print(f'  falta (lo salteo): {archivo}')
            continue
        w, h, px = leer_png(ruta)
        n = w // fw
        for i in range(n):
            recorte = bytearray(fw * fh * 4)
            pegar(recorte, fw, px, w, i * fw, 0, 0, 0, fw, fh)
            cuadros.append((f'{prefijo}_{i}', fw, fh, recorte))
        print(f'  {prefijo:<14} {n:>2} cuadro(s) de {fw}x{fh}')

    if not cuadros:
        sys.exit('No se pudo leer ningún sprite.')

    # 2) acomodarlos en estantes: los más altos primero, que desperdicia menos
    cuadros.sort(key=lambda c: (-c[2], c[0]))
    ubicaciones, x, y, alto_fila = [], 0, 0, 0
    for nombre, w, h, px in cuadros:
        if x + w > ATLAS_ANCHO:
            x, y, alto_fila = 0, y + alto_fila + SEPARACION, 0
        ubicaciones.append((nombre, x, y, w, h, px))
        x += w + SEPARACION
        alto_fila = max(alto_fila, h)
    atlas_alto = y + alto_fila

    potencia = 1
    while potencia < atlas_alto:
        potencia *= 2
    atlas_alto = potencia

    # 3) dibujar el atlas
    lienzo = bytearray(ATLAS_ANCHO * atlas_alto * 4)   # todo transparente
    marcos = {}
    for nombre, x, y, w, h, px in ubicaciones:
        pegar(lienzo, ATLAS_ANCHO, px, w, 0, 0, x, y, w, h)
        marcos[nombre] = {
            'frame': {'x': x, 'y': y, 'w': w, 'h': h},
            'rotated': False, 'trimmed': False,
            'spriteSourceSize': {'x': 0, 'y': 0, 'w': w, 'h': h},
            'sourceSize': {'w': w, 'h': h},
        }

    escribir_png(SALIDA_PNG, ATLAS_ANCHO, atlas_alto, lienzo)
    json.dump(
        {'frames': marcos,
         'meta': {'image': 'atlas.png', 'format': 'RGBA8888',
                  'size': {'w': ATLAS_ANCHO, 'h': atlas_alto}, 'scale': '1',
                  'app': 'herramientas/empaquetar_atlas.py',
                  'licencia': 'sprites CC0 de Pixel Frog — ver CREDITOS.md'}},
        open(SALIDA_JSON, 'w', encoding='utf-8'), indent=1)

    print(f'\n  atlas: {ATLAS_ANCHO}x{atlas_alto}  ·  {len(marcos)} cuadros  ·  '
          f'{os.path.getsize(SALIDA_PNG) / 1024:.1f} KB')


if __name__ == '__main__':
    main()
