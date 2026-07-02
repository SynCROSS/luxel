export function makePayload(size: number, seed = 0x5a): Uint8Array {
  const payload = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    payload[i] = (seed + i) & 0xff;
  }
  return payload;
}
