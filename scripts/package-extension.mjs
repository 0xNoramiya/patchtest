/**
 * Builds the loadable extension zip that ships on GitHub Releases.
 * Uses Node only, so it runs anywhere the project runs.
 *   node scripts/package-extension.mjs
 */
import { createWriteStream } from "node:fs";
import { mkdir, readFile, readdir, stat } from "node:fs/promises";
import { deflateRawSync, crc32 } from "node:zlib";
import path from "node:path";

const INCLUDE = [
  "manifest.json",
  "background.js",
  "content.js",
  "content.css",
  "popup.html",
  "popup.js",
  "README.md",
];

async function filesToPack(root) {
  const out = [];
  for (const name of INCLUDE) out.push(name);
  for (const icon of await readdir(path.join(root, "icons"))) {
    out.push(path.join("icons", icon));
  }
  return out;
}

/** Minimal zip writer. Deflated entries, no directory records beyond central. */
async function writeZip(root, names, outPath) {
  const chunks = [];
  const central = [];
  let offset = 0;

  for (const name of names) {
    const data = await readFile(path.join(root, name));
    const compressed = deflateRawSync(data, { level: 9 });
    const useStore = compressed.length >= data.length;
    const body = useStore ? data : compressed;
    const method = useStore ? 0 : 8;
    const crc = crc32(data) >>> 0;
    const nameBytes = Buffer.from(name.split(path.sep).join("/"), "utf8");

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0x2821, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, nameBytes, body);

    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);
    dir.writeUInt16LE(20, 4);
    dir.writeUInt16LE(20, 6);
    dir.writeUInt16LE(0, 8);
    dir.writeUInt16LE(method, 10);
    dir.writeUInt16LE(0, 12);
    dir.writeUInt16LE(0x2821, 14);
    dir.writeUInt32LE(crc, 16);
    dir.writeUInt32LE(body.length, 20);
    dir.writeUInt32LE(data.length, 24);
    dir.writeUInt16LE(nameBytes.length, 28);
    dir.writeUInt32LE(0, 42 - 4);
    dir.writeUInt32LE(offset, 42);
    central.push(Buffer.concat([dir, nameBytes]));

    offset += local.length + nameBytes.length + body.length;
  }

  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(names.length, 8);
  end.writeUInt16LE(names.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16);

  await mkdir(path.dirname(outPath), { recursive: true });
  const stream = createWriteStream(outPath);
  for (const chunk of [...chunks, centralBuf, end]) stream.write(chunk);
  await new Promise((resolve) => stream.end(resolve));
}

const root = path.resolve("extension");
const version = JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8")).version;
const out = path.resolve("dist", `patchtest-extension-v${version}.zip`);
const names = await filesToPack(root);
await writeZip(root, names, out);

const { size } = await stat(out);
console.log(`${out}  (${names.length} files, ${(size / 1024).toFixed(0)} KB)`);
for (const n of names) console.log(`  ${n}`);
