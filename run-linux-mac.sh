#!/usr/bin/env bash
set -eu
cd "$(dirname "$0")"
echo 'Open web/index.html in a modern browser. Starting optional local static server on 127.0.0.1:8080'
python3 -m http.server 8080 --directory web --bind 127.0.0.1
