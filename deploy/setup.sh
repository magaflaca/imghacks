#!/bin/bash
# Preparacion unica del servidor (como root): runtime de Node, carpetas, systemd y nginx.
set -euo pipefail

ROOT=/opt/imghacks
NODE_VERSION=v22.12.0
HERE="$(cd "$(dirname "$0")" && pwd)"

install -d -o gflow -g gflow "$ROOT" "$ROOT/app" "$ROOT/data"

if [ ! -x "$ROOT/runtime/bin/node" ]; then
  mkdir -p "$ROOT/runtime"
  curl -fsSL "https://nodejs.org/dist/$NODE_VERSION/node-$NODE_VERSION-linux-x64.tar.xz" | tar -xJ --strip-components=1 -C "$ROOT/runtime"
fi

[ -f "$ROOT/env" ] || install -m 640 -o root -g gflow "$HERE/../.env.example" "$ROOT/env"

install -m 644 "$HERE/imghacks.service" /etc/systemd/system/imghacks.service
install -m 644 "$HERE/nginx.conf" /etc/nginx/sites-available/imghacks
ln -sf /etc/nginx/sites-available/imghacks /etc/nginx/sites-enabled/imghacks

systemctl daemon-reload
systemctl enable imghacks >/dev/null
nginx -t && systemctl reload nginx
echo "listo: revisa $ROOT/env y lanza deploy.sh"
