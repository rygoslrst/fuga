#!/usr/bin/env python3
# =============================================================================
#  servidor.py — servidor de desarrollo
# -----------------------------------------------------------------------------
#  Es `python -m http.server` con dos arreglos:
#   1. Le prohíbe al navegador guardar archivos en caché. Sin esto, después de
#      editar un .js el navegador a veces sigue usando el viejo y parece que el
#      cambio "no anda".
#   2. Fuerza el tipo correcto para .js: en algunos Windows, Python lo sirve
#      como texto plano y el navegador se niega a cargar los módulos.
#
#  Uso, parado en esta carpeta:
#      python servidor.py
#  y abrí http://localhost:8123   (con ?debug para ver los FPS)
# =============================================================================

import http.server
import sys

PUERTO = int(sys.argv[1]) if len(sys.argv) > 1 else 8123


class SinCache(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        '.js': 'text/javascript',
        '.woff2': 'font/woff2',
        '.json': 'application/json',
    }

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, formato, *args):
        pass   # sin una línea por archivo: la consola queda limpia


if __name__ == '__main__':
    print(f'FUGA en http://localhost:{PUERTO}   (Ctrl+C para cortar)')
    http.server.ThreadingHTTPServer(('', PUERTO), SinCache).serve_forever()
