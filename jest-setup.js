// Jest setup provided by Grafana scaffolding
import './.config/jest-setup';

// jsdom (bundled with jest-environment-jsdom 29) does not expose the
// WHATWG encoding API, which is required by some modern @grafana/ui
// dependencies (e.g. react-dom server rendering).
import { TextDecoder, TextEncoder } from 'util';

Object.assign(global, { TextDecoder, TextEncoder });
