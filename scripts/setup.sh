#!/usr/bin/env bash
set -euo pipefail

# Initialize npm project if package.json doesn't exist
if [ ! -f package.json ]; then
  npm init -y >/dev/null
fi

npm install chart.js@4.4.1 chartjs-chart-sankey@0.9.1 papaparse http-server >/dev/null

# Copy required JS files to js/lib
mkdir -p js/lib
cp node_modules/chart.js/dist/chart.umd.js js/lib/
cp node_modules/chartjs-chart-sankey/dist/chartjs-chart-sankey.min.js js/lib/
cp node_modules/papaparse/papaparse.min.js js/lib/

echo "Setup complete."
