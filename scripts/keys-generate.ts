// Prints a new Ed25519 key pair to the terminal only. Never writes a file.
import { createHash, generateKeyPairSync } from "node:crypto";

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const priv = privateKey.export({ format: "der", type: "pkcs8" }).toString("base64");
const pubDer = publicKey.export({ format: "der", type: "spki" });

console.log("REVENANT_SIGNING_KEY (secret, server-only):");
console.log(priv);
console.log("");
console.log(`Public key (SPKI, base64): ${pubDer.toString("base64")}`);
console.log(`Key id: ${createHash("sha256").update(pubDer).digest("hex").slice(0, 16)}`);
