export type UploadMime = "image/png" | "image/jpeg" | "image/webp";

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG = [0xff, 0xd8, 0xff];
const ascii = (bytes: Uint8Array, from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to));
const startsWith = (bytes: Uint8Array, signature: number[]) => signature.every((b, i) => bytes[i] === b);

/**
 * Tipo real de una imagen subida segun sus bytes magicos. No confia en la extension ni en el
 * Content-Type del cliente. Devuelve null para cualquier otro formato (SVG, GIF, texto...).
 */
export function detectImageType(bytes: Uint8Array): UploadMime | null {
  if (bytes.length >= PNG.length && startsWith(bytes, PNG)) return "image/png";
  if (bytes.length >= JPEG.length && startsWith(bytes, JPEG)) return "image/jpeg";
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") return "image/webp";
  return null;
}
