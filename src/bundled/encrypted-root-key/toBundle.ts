// no need to import ethers, it's automatically injected on the lit node side
// import { ethers } from 'ethers';

// import { SiweMessage } from "https://esm.sh/siwe@1.0.0";
// import {encode, decode} from "https://deno.land/std/encoding/base64url.ts";
// import { crypto } from "https://deno.land/std@0.224.0/crypto/mod.ts";
import { hkdf } from "https://esm.sh/@noble/hashes@1.4.0/hkdf.js";
import { pbkdf2Async } from "https://esm.sh/@noble/hashes@1.4.0/pbkdf2.js";
import { sha512 } from "https://esm.sh/@noble/hashes@1.4.0/sha512.js";

import { sha256 } from "https://esm.sh/@noble/hashes@1.4.0/sha256.js";


const go = async () => {
  const random = await crypto.getRandomValues(new Uint8Array(32));

  const entropies: string[] = await Lit.Actions.broadcastAndCollect({
    name: 'seeds',
    value: ethers.utils.hexlify(random),
  });

  // TODO: convert to mnemonic
  const entropyHex = entropies.sort().reduce((acc, s, idx) => acc + s.slice(2), '0x');
  const entropy = hkdf(sha256, ethers.utils.arrayify(entropyHex), new Uint8Array(32), 'seed', 32);

  // BIP39 Seed
  const password = ''
  const encoder = new TextEncoder();
  const salt = encoder.encode("mnemonic" + password);
  const seed = await pbkdf2Async(sha512, entropy, salt, { c: 2048, dkLen: 64 });

  // BIP32 Root Key
  const rootHDNode = ethers.utils.HDNode.fromSeed(seed);
  const { extendedKey: bip32RootKey } = rootHDNode;
  
  // Safety check ensure all nodes agree on same BIP32 Root Key
  const rootKeyIds: string[] = await Lit.Actions.broadcastAndCollect({
    name: 'response',
    value: sha256(bip32RootKey),
  });

  if (!rootKeyIds.every((id) => id === rootKeyIds[0])) throw new Error(`Node synchronization failed: Expected all responses to be "${rootKeyIds[0]}", but got variations: [${rootKeyIds.join(', ')}]`);

  // BIP32 Derivation Path
  const networkPath = "m/44'/60'/0'/0";

  // BIP32 Extended Private Key
  const networkHDNode = rootHDNode.derivePath(networkPath);
  const { extendedKey: bip32ExtendedPrivateKey } = networkHDNode

  const accounts = [0].map((num) => {
    const path = `${networkPath}/${num}`;
    const hd = rootHDNode.derivePath(firstPath);
    const wallet = new ethers.Wallet(hd);
    const { address, publicKey: publicKeyLong } = wallet;
    return [path, {
      address,
      publicKey: hd.publicKey,
      publicKeyLong,
    }]
  });

  // TODO: Encrypted
  // const { ciphertext: u, dataToEncryptHash: c } = await Lit.Actions.encrypt({
  //   accessControlConditions, // Presumably defined elsewhere to set access control for encryption
  //   to_encrypt: bip32RootKey // Data to encrypt (encoded private key)
  // });
  // encrypte entrropy, bip32 rootkey(private key)
  
  // entrropyEncr = {
  //   ciphertext,
  //   dataToEncryptHash,
  // },
  // rootKey = {
  //   ciphertext,
  //   dataToEncryptHash,
  // }
  
  const response = JSON.stringify({
    // entropy: ethers.utils.hexlify(entropy),
    // bip39Seed: ethers.utils.hexlify(seed),
    // bip32RootKey,
    // bip32ExtendedPrivateKey,
    accounts,
  })

  Lit.Actions.setResponse({ response });
};

go();