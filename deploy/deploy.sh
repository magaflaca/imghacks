#!/bin/bash
# Publica el commit actual en el servidor. Uso: SSH="ssh root@host" deploy/deploy.sh [--setup]
set -euo pipefail

SSH=${SSH:?define SSH, por ejemplo SSH="ssh root@servidor"}
ROOT=/opt/imghacks
cd "$(dirname "$0")/.."

$SSH "mkdir -p $ROOT/app"
git archive HEAD | $SSH "find $ROOT/app -mindepth 1 -maxdepth 1 ! -name node_modules -exec rm -rf {} + && tar -x -C $ROOT/app"
[ "${1:-}" = "--setup" ] && $SSH "bash $ROOT/app/deploy/setup.sh"
$SSH "cd $ROOT/app && PATH=$ROOT/runtime/bin:\$PATH npm install --omit=dev --no-audit --no-fund --silent && chown -R gflow:gflow $ROOT/app && systemctl restart imghacks && sleep 2 && systemctl is-active imghacks"
