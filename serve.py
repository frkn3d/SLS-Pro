"""SLS Pro yerel sunucusu.

- Uygulamayı http://127.0.0.1:8749 adresinden sunar.
- CORS başlığı vermeyen açık veri kovaları (Copernicus GLO-30) için
  yalnızca beyaz listedeki yollara izin veren bir okuma vekili sağlar.
  HTTP Range istekleri aktarılır; böylece Cloud Optimized GeoTIFF'lerin
  sadece gereken parçaları indirilir.

Kullanım:  python serve.py [port]
Yalnızca Python standart kütüphanesi kullanılır.
"""

import http.server
import re
import socketserver
import sys
import threading
import urllib.error
import urllib.request
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PORT = next((int(a) for a in sys.argv[1:] if a.isdigit()), 8749)

# Önek -> (upstream taban URL, izin verilen yol deseni)
PROXIES = {
    "/proxy/copernicus30/": (
        "https://copernicus-dem-30m.s3.amazonaws.com/",
        re.compile(r"^Copernicus_DSM_COG_10_[NS]\d{2}_00_[EW]\d{3}_00_DEM/Copernicus_DSM_COG_10_[NS]\d{2}_00_[EW]\d{3}_00_DEM\.tif$"),
    ),
}
PASS_HEADERS = ("Content-Type", "Content-Length", "Content-Range", "Accept-Ranges", "ETag", "Last-Modified")


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".json": "application/json",
    }

    def log_message(self, fmt, *args):
        if "/proxy/" in getattr(self, "path", ""):
            return  # vekil trafiği çok gürültülü
        super().log_message(fmt, *args)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def _proxy(self, head_only=False):
        if self.path == "/proxy/health":
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.send_header("Content-Length", "2")
            self.end_headers()
            if not head_only:
                self.wfile.write(b"ok")
            return True
        for prefix, (base, pattern) in PROXIES.items():
            if not self.path.startswith(prefix):
                continue
            rest = self.path[len(prefix):].split("?", 1)[0]
            if not pattern.match(rest):
                self.send_error(400, "Path not allowed")
                return True
            req = urllib.request.Request(base + rest, method="HEAD" if head_only else "GET")
            if self.headers.get("Range"):
                req.add_header("Range", self.headers["Range"])
            try:
                with urllib.request.urlopen(req, timeout=60) as up:
                    self._relay(up.status, up.headers, up, head_only)
            except urllib.error.HTTPError as e:
                self._relay(e.code, e.headers, e, head_only)
            except Exception as e:  # ağ hatası
                self.send_error(502, str(e))
            return True
        return False

    def _relay(self, status, headers, body, head_only):
        self.send_response(status)
        for h in PASS_HEADERS:
            if headers.get(h):
                self.send_header(h, headers[h])
        self.end_headers()
        if head_only:
            return
        while True:
            chunk = body.read(64 * 1024)
            if not chunk:
                break
            self.wfile.write(chunk)

    def do_GET(self):
        if self.path.startswith("/proxy/") and self._proxy():
            return
        super().do_GET()

    def do_HEAD(self):
        if self.path.startswith("/proxy/") and self._proxy(head_only=True):
            return
        super().do_HEAD()


class Server(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def main():
    url = f"http://127.0.0.1:{PORT}/"
    with Server(("127.0.0.1", PORT), Handler) as httpd:
        print(f"SLS Pro calisiyor: {url}  (durdurmak icin Ctrl+C)")
        if "--no-browser" not in sys.argv:
            threading.Timer(0.8, lambda: webbrowser.open(url)).start()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
