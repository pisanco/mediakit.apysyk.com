// fontkit ships no types. Only the entry point is declared here; wordmark.ts
// types the few font members it uses.
declare module "fontkit" {
  export function create(buffer: Buffer): unknown;
}
