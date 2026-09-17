// The one definition of a migration's checksum, shared by the runner and the
// bootstrap generator. Two copies of this function existed, each commented
// "must match the other exactly" — which is a comment standing in for a module.
import { createHash } from "node:crypto";

const hash = (s) => createHash("sha256").update(s).digest("hex").slice(0, 16);

// Line endings are normalized before hashing.
//
// This repo runs with core.autocrlf=true and no .gitattributes, so git rewrote
// every migration's LF line endings as CRLF on checkout. The SQL was byte-for-
// byte the same statement, the hash was not, and the runner reported drift on
// migrations nobody had touched — then refused to apply anything. A drift
// detector that fires on a checkout gets ignored, and then it is useless for the
// thing it exists to catch.
export const checksum = (sql) => hash(sql.replace(/\r\n/g, "\n"));

// The hashes a file could have been recorded under before normalization existed:
// its bytes with LF endings, and with CRLF. A recorded checksum matching either
// means the file differs only in line endings — not in content.
export function legacyChecksums(sql) {
  const lf = sql.replace(/\r\n/g, "\n");
  return new Set([hash(lf), hash(lf.replace(/\n/g, "\r\n"))]);
}
