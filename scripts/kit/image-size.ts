// Reads the pixel size from PNG, JPEG and WebP headers. The build checks every
// render against its catalog size with it, and the tests check the manifest.

export interface Size {
  width: number;
  height: number;
}

export function imageSize(bytes: Uint8Array): Size {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // PNG: the IHDR chunk always comes first.
  if (view.getUint32(0) === 0x89504e47) {
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  // JPEG: walk the segments to the first start-of-frame marker.
  if (view.getUint16(0) === 0xffd8) {
    let pos = 2;
    while (pos < bytes.length) {
      if (bytes[pos] !== 0xff) throw new Error("corrupt JPEG");
      const marker = bytes[pos + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { width: view.getUint16(pos + 7), height: view.getUint16(pos + 5) };
      }
      pos += 2 + view.getUint16(pos + 2);
    }
    throw new Error("JPEG without a frame header");
  }
  // WebP: RIFF container with a VP8, VP8L or VP8X chunk.
  if (view.getUint32(0) === 0x52494646 && view.getUint32(8) === 0x57454250) {
    const chunk = String.fromCharCode(...bytes.subarray(12, 16));
    if (chunk === "VP8 ") {
      return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
    }
    if (chunk === "VP8L") {
      const b = view.getUint32(21, true);
      return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
    }
    if (chunk === "VP8X") {
      const w = bytes[24] | (bytes[25] << 8) | (bytes[26] << 16);
      const h = bytes[27] | (bytes[28] << 8) | (bytes[29] << 16);
      return { width: w + 1, height: h + 1 };
    }
  }
  throw new Error("unknown image format");
}
