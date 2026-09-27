#!/usr/bin/env python3
# =============================================================================
#  armar_sprites.py — arma la hoja de sprites del corredor a partir del pack
# -----------------------------------------------------------------------------
#  Toma los cuadros sueltos del "Animated Pixel Adventurer" de rvros
#  (https://rvros.itch.io/animated-pixel-hero), elige los que usa el juego,
#  los mide y escribe:
#     assets/aventurero.png     sólo los cuadros usados, en grilla, tamaño original
#     js/datos/aventurero.js    qué cuadro va en cada pose + medidas medidas
#
#  El pack NO va en el repositorio (la licencia no permite redistribuirlo como
#  pack): sólo los cuadros que el juego usa, dentro de su propia hoja.
#
#  Uso:
#     python herramientas/armar_sprites.py Adventurer-1.5.zip Adventurer-Hand-Combat.zip
#
#  Sin PIL: sólo zlib y struct, que vienen con Python.
# =============================================================================

import json, os, re, struct, sys, zipfile, zlib

AQUI = os.path.dirname(os.path.abspath(__file__))
JUEGO = os.path.dirname(AQUI)

# Pose del juego -> cuadros del pack, en orden. Cambiar una animación es
# cambiar esta tabla y volver a correr el script.
POSES = {
    'quieto':    ['idle-00', 'idle-01', 'idle-02', 'idle-03'],
    'correr':    ['run2-00', 'run2-01', 'run2-02', 'run2-03', 'run2-04', 'run2-05'],
    'salto':     ['jump-01', 'jump-02', 'jump-03'],
    'caida':     ['fall-00', 'fall-01'],
    'valla':     ['jump-02', 'smrslt-00', 'smrslt-01', 'smrslt-02', 'smrslt-03'],
    'vuelo':     ['jump-02', 'crnr-jmp-00', 'crnr-jmp-01', 'fall-00'],
    'desliz':    ['slide-00', 'slide-00', 'slide-01', 'stand-02'],
    'voltereta': ['smrslt-00', 'smrslt-01', 'smrslt-02', 'smrslt-03'],
    'trepa':     ['crnr-clmb-00', 'crnr-clmb-02', 'crnr-clmb-04'],
    'tropiezo':  ['knock-dwn-01', 'knock-dwn-01', 'run2-00'],
    'atrapado':  ['knock-dwn-01', 'knock-dwn-02', 'knock-dwn-03', 'knock-dwn-04'],
    'cayendo':   ['crnr-grb-00', 'crnr-grb-02'],
    'aterriza':  ['crouch-00'],
    'alcanzar':  ['run-punch-01', 'run-punch-02'],
}
# Poses en las que el cuerpo está dado vuelta: el perseguidor no muestra ojos.
SIN_OJOS = {'valla', 'voltereta', 'atrapado', 'desliz'}


# -----------------------------------------------------------------------------
#  PNG: lectura (RGBA o con paleta, 8 bits) y escritura (RGBA)
# -----------------------------------------------------------------------------
def leer_png(b):
    assert b[:8] == b'\x89PNG\r\n\x1a\n'
    pos, idat, paleta, trns = 8, [], None, None
    while pos < len(b):
        largo = struct.unpack('>I', b[pos:pos + 4])[0]
        tipo, cuerpo = b[pos + 4:pos + 8], b[pos + 8:pos + 8 + largo]
        if tipo == b'IHDR':
            w, h, prof, color, _, _, entrel = struct.unpack('>IIBBBBB', cuerpo)
            assert prof == 8 and entrel == 0 and color in (3, 6), f'formato {prof} {color}'
        elif tipo == b'PLTE': paleta = cuerpo
        elif tipo == b'tRNS': trns = cuerpo
        elif tipo == b'IDAT': idat.append(cuerpo)
        elif tipo == b'IEND': break
        pos += 12 + largo
    bpp = 4 if color == 6 else 1
    crudo = zlib.decompress(b''.join(idat))
    paso = w * bpp
    filas, prev, o = [], bytearray(paso), 0
    for _ in range(h):
        f = crudo[o]; o += 1
        fila = bytearray(crudo[o:o + paso]); o += paso
        for x in range(paso):
            izq = fila[x - bpp] if x >= bpp else 0
            arr, diag = prev[x], (prev[x - bpp] if x >= bpp else 0)
            if f == 1: fila[x] = (fila[x] + izq) & 255
            elif f == 2: fila[x] = (fila[x] + arr) & 255
            elif f == 3: fila[x] = (fila[x] + ((izq + arr) >> 1)) & 255
            elif f == 4:
                p = izq + arr - diag
                pa, pb, pc = abs(p - izq), abs(p - arr), abs(p - diag)
                fila[x] = (fila[x] + (izq if pa <= pb and pa <= pc else arr if pb <= pc else diag)) & 255
        filas.append(fila); prev = fila
    px = bytearray(w * h * 4)
    for y, fila in enumerate(filas):
        for x in range(w):
            i = (y * w + x) * 4
            if color == 6:
                px[i:i + 4] = fila[x * 4:x * 4 + 4]
            else:
                k = fila[x]
                px[i:i + 3] = paleta[k * 3:k * 3 + 3]
                px[i + 3] = trns[k] if trns and k < len(trns) else 255
    return w, h, px


def escribir_png(ruta, w, h, px):
    crudo = bytearray()
    for y in range(h):
        crudo.append(0); crudo += px[y * w * 4:(y + 1) * w * 4]
    trozo = lambda t, c: struct.pack('>I', len(c)) + t + c + struct.pack('>I', zlib.crc32(t + c) & 0xffffffff)
    with open(ruta, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n')
        f.write(trozo(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)))
        f.write(trozo(b'IDAT', zlib.compress(bytes(crudo), 9)))
        f.write(trozo(b'IEND', b''))


# -----------------------------------------------------------------------------
def caja(px, w, h):
    x0, y0, x1, y1 = w, h, -1, -1
    for y in range(h):
        for x in range(w):
            if px[(y * w + x) * 4 + 3] > 20:
                x0, x1, y0, y1 = min(x0, x), max(x1, x), min(y0, y), max(y1, y)
    return x0, y0, x1, y1


def main():
    zips = sys.argv[1:]
    if not zips: sys.exit(__doc__ or 'pasame los zips del pack')
    cuadros = {}
    for z in zips:
        for n in zipfile.ZipFile(z).namelist():
            m = re.match(r'.*adventurer-(.+-\d\d)\.png$', n)
            if m: cuadros[m.group(1)] = (z, n)

    usados = []
    for lista in POSES.values():
        for c in lista:
            if c not in cuadros: sys.exit(f'falta el cuadro {c} en los zips')
            if c not in usados: usados.append(c)

    imgs = {c: leer_png(zipfile.ZipFile(cuadros[c][0]).read(cuadros[c][1])) for c in usados}
    W, H = imgs[usados[0]][0], imgs[usados[0]][1]

    # Pies y centro del cuerpo: se miden en las poses de pie (quieto y correr).
    fondo, centros = 0, []
    for c in POSES['quieto'] + POSES['correr']:
        x0, y0, x1, y1 = caja(imgs[c][2], W, H)
        fondo = max(fondo, y1)
        centros.append((x0 + x1) / 2)
    ancla_x = round(sum(centros) / len(centros))
    ancla_y = fondo + 1

    def alto(pose):
        return max(ancla_y - caja(imgs[c][2], W, H)[1] for c in POSES[pose])

    meta = {}
    for c in usados:
        px = imgs[c][2]
        x0, y0, x1, y1 = caja(px, W, H)
        # La cabeza: el centro de los píxeles opacos de las 5 filas de arriba.
        xs = [x for y in range(y0, min(H, y0 + 5)) for x in range(W) if px[(y * W + x) * 4 + 3] > 20]
        cx = sum(xs) / len(xs) if xs else (x0 + x1) / 2
        meta[c] = {'cabezaX': round(cx + 1.5 - ancla_x, 1), 'cabezaY': round(y0 + 4 - ancla_y, 1),
                   'centroX': round((x0 + x1) / 2 - ancla_x, 1), 'centroY': round((y0 + y1) / 2 - ancla_y, 1)}

    # Grilla de salida: 10 cuadros por fila, sin escalar.
    COLS = 10
    filas = (len(usados) + COLS - 1) // COLS
    SW, SH = COLS * W, filas * H
    hoja = bytearray(SW * SH * 4)
    pos = {}
    for i, c in enumerate(usados):
        gx, gy = (i % COLS) * W, (i // COLS) * H
        pos[c] = [gx, gy]
        px = imgs[c][2]
        for y in range(H):
            a = ((gy + y) * SW + gx) * 4
            hoja[a:a + W * 4] = px[y * W * 4:(y + 1) * W * 4]
    os.makedirs(os.path.join(JUEGO, 'assets'), exist_ok=True)
    escribir_png(os.path.join(JUEGO, 'assets', 'aventurero.png'), SW, SH, hoja)

    datos = {
        'cuadro': {'w': W, 'h': H, 'anclaX': ancla_x, 'anclaY': ancla_y},
        'alturas': {'depie': alto('quieto'), 'desliz': max(ancla_y - caja(imgs[c][2], W, H)[1] for c in ['slide-00', 'slide-01'])},
        'poses': POSES, 'sinOjos': sorted(SIN_OJOS), 'posicion': pos, 'meta': meta,
    }
    js = ('// Generado por herramientas/armar_sprites.py — no editar a mano.\n'
          '// Cuadros del "Animated Pixel Adventurer" de rvros (rvros.itch.io).\n'
          'export const AVENTURERO = ' + json.dumps(datos, ensure_ascii=False, indent=1) + ';\n')
    open(os.path.join(JUEGO, 'js', 'datos', 'aventurero.js'), 'w', encoding='utf-8').write(js)

    print(f'{len(usados)} cuadros de {W}x{H} -> assets/aventurero.png ({SW}x{SH}, '
          f'{os.path.getsize(os.path.join(JUEGO, "assets", "aventurero.png")) / 1024:.1f} KB)')
    print(f'ancla (pies): x={ancla_x} y={ancla_y} | alto de pie: {datos["alturas"]["depie"]} px | '
          f'alto barriéndose: {datos["alturas"]["desliz"]} px')


if __name__ == '__main__':
    main()
