#!/usr/bin/env node
// Generate a florajs.dev playground share link for a Flora diagram.
//
// Usage:
//   node share-link.mjs <file> [theme]
//   echo "flowchart TD ..." | node share-link.mjs - [theme]
//
// The link encoding must stay in sync with encodeState() in
// site/src/pages/playground.astro: deflate-raw of JSON {code, theme},
// base64url without padding, behind a #flora: hash prefix.

import { deflateRawSync } from "node:zlib";
import { readFileSync } from "node:fs";

const [file, theme = "default"] = process.argv.slice(2);

if (!file) {
  console.error("Usage: node share-link.mjs <file|-> [theme]");
  process.exit(1);
}

const code = readFileSync(file === "-" ? 0 : file, "utf8").trim();
const compressed = deflateRawSync(Buffer.from(JSON.stringify({ code, theme })));
console.log(`https://florajs.dev/playground/#flora:${compressed.toString("base64url")}`);
