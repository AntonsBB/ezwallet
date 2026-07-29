import assert from "node:assert/strict";
import test from "node:test";
import { inspectImageUpload } from "../lib/image-upload.ts";

function pngHeader(width: number, height: number) {
  const bytes = new Uint8Array(24);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  bytes.set([73, 72, 68, 82], 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width, false);
  view.setUint32(20, height, false);
  return bytes.buffer;
}

function jpegHeader(width: number, height: number) {
  return Uint8Array.of(
    0xff,
    0xd8,
    0xff,
    0xc0,
    0x00,
    0x07,
    0x08,
    (height >> 8) & 0xff,
    height & 0xff,
    (width >> 8) & 0xff,
    width & 0xff
  ).buffer;
}

test("accepts matching raster signatures with bounded dimensions", () => {
  assert.deepEqual(inspectImageUpload(pngHeader(1200, 800), "image/png"), {
    width: 1200,
    height: 800,
  });
  assert.deepEqual(inspectImageUpload(jpegHeader(640, 480), "image/jpeg"), {
    width: 640,
    height: 480,
  });
});

test("rejects MIME confusion, malformed headers, and decompression bombs", () => {
  assert.equal(inspectImageUpload(pngHeader(100, 100), "image/jpeg"), null);
  assert.equal(
    inspectImageUpload(new Uint8Array([1, 2, 3]).buffer, "image/png"),
    null
  );
  assert.equal(inspectImageUpload(pngHeader(8000, 8000), "image/png"), null);
});
