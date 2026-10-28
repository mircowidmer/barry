// MapLibre draws the Trail Map in a web worker it loads from a file of its own, which Metro does not bundle.
// npm runs this after every install, so public/ serves the worker of the installed version, to the dev server
// and to the static export alike.
import { copyFileSync, mkdirSync } from 'node:fs';

mkdirSync('public/maplibre', { recursive: true });
copyFileSync('node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs', 'public/maplibre/maplibre-gl-worker.mjs');
