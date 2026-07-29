import {
  Address,
  Cell,
  contractAddress,
  loadStateInit,
} from "@ton/core";
import nacl from "tweetnacl";
import { getBinding } from "@/db";
import { constantTimeEqual } from "./security";

const encoder = new TextEncoder();
const TON_PROOF_PREFIX = encoder.encode("ton-proof-item-v2/");
const TON_CONNECT_PREFIX = encoder.encode("ton-connect");

export type TonProofPayload = {
  address: string;
  network: "-239" | "-3";
  publicKey?: string;
  walletStateInit: string;
  proof: {
    timestamp: number;
    domain: {
      lengthBytes: number;
      value: string;
    };
    signature: string;
    payload: string;
  };
};

function concat(...parts: Uint8Array[]) {
  const result = new Uint8Array(
    parts.reduce((length, part) => length + part.length, 0)
  );
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function base64Bytes(value: string) {
  const binary = atob(value.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function hexBytes(value: string) {
  const normalized = value.replace(/^0x/, "").padStart(64, "0");
  if (!/^[a-f0-9]{64}$/i.test(normalized)) {
    throw new Error("Wallet public key is invalid.");
  }
  return Uint8Array.from(
    normalized.match(/.{2}/g) ?? [],
    (byte) => Number.parseInt(byte, 16)
  );
}

function addressBytes(address: Address) {
  const bytes = new Uint8Array(36);
  const view = new DataView(bytes.buffer);
  view.setInt32(0, address.workChain, false);
  bytes.set(address.hash, 4);
  return bytes;
}

function domainBytes(domain: string) {
  const encoded = encoder.encode(domain);
  const length = new Uint8Array(4);
  new DataView(length.buffer).setUint32(0, encoded.length, true);
  return concat(length, encoded);
}

function timestampBytes(timestamp: number) {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setBigInt64(0, BigInt(timestamp), true);
  return bytes;
}

async function sha256(value: Uint8Array) {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", Uint8Array.from(value))
  );
}

async function fetchWalletPublicKey(
  address: Address,
  network: "mainnet" | "testnet"
) {
  const endpoint =
    network === "mainnet"
      ? "https://toncenter.com/api/v2/runGetMethod"
      : "https://testnet.toncenter.com/api/v2/runGetMethod";
  const headers = new Headers({ "content-type": "application/json" });
  const apiKey = getBinding("TONCENTER_API_KEY");
  if (apiKey) headers.set("x-api-key", apiKey);

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      address: address.toRawString(),
      method: "get_public_key",
      stack: [],
    }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) {
    throw new Error("The wallet must be activated on TON before it can be linked.");
  }
  const data = (await response.json()) as {
    ok?: boolean;
    result?: { stack?: Array<[string, string]> };
  };
  const value = data.result?.stack?.[0]?.[1];
  if (!data.ok || typeof value !== "string") {
    throw new Error("TON did not return a wallet public key.");
  }
  return hexBytes(value);
}

export async function verifyTonProof(
  payload: TonProofPayload,
  expectedDomain: string,
  expectedChallenge: string,
  expectedNetwork: "mainnet" | "testnet",
  nowSeconds = Math.floor(Date.now() / 1000)
) {
  const address = Address.parse(payload.address);
  const expectedChain = expectedNetwork === "mainnet" ? "-239" : "-3";
  if (payload.network !== expectedChain) {
    throw new Error(`Connect a ${expectedNetwork} TON wallet.`);
  }
  if (payload.proof.payload !== expectedChallenge) {
    throw new Error("Wallet proof challenge does not match.");
  }
  if (
    payload.proof.timestamp > nowSeconds + 30 ||
    nowSeconds - payload.proof.timestamp > 300
  ) {
    throw new Error("Wallet proof has expired.");
  }

  const normalizedDomain = payload.proof.domain.value.toLowerCase();
  const expected = expectedDomain.toLowerCase();
  const encodedDomain = encoder.encode(normalizedDomain);
  if (
    normalizedDomain !== expected ||
    payload.proof.domain.lengthBytes !== encodedDomain.length
  ) {
    throw new Error("Wallet proof domain does not match EzWallet.");
  }

  let stateInit;
  try {
    stateInit = loadStateInit(Cell.fromBase64(payload.walletStateInit).beginParse());
  } catch {
    throw new Error("Wallet state initialization is invalid.");
  }
  const derivedAddress = contractAddress(address.workChain, stateInit);
  if (!constantTimeEqual(derivedAddress.hash, address.hash)) {
    throw new Error("Wallet state does not match the connected address.");
  }

  const publicKey = await fetchWalletPublicKey(address, expectedNetwork);
  if (payload.publicKey) {
    const advertisedKey = hexBytes(payload.publicKey);
    if (!constantTimeEqual(publicKey, advertisedKey)) {
      throw new Error("Wallet public key does not match the TON account.");
    }
  }

  const message = concat(
    TON_PROOF_PREFIX,
    addressBytes(address),
    domainBytes(normalizedDomain),
    timestampBytes(payload.proof.timestamp),
    encoder.encode(payload.proof.payload)
  );
  const innerHash = await sha256(message);
  const digest = await sha256(
    concat(new Uint8Array([0xff, 0xff]), TON_CONNECT_PREFIX, innerHash)
  );
  const signature = base64Bytes(payload.proof.signature);
  if (
    signature.byteLength !== nacl.sign.signatureLength ||
    !nacl.sign.detached.verify(digest, signature, publicKey)
  ) {
    throw new Error("Wallet proof signature is invalid.");
  }

  return address.toString({
    bounceable: false,
    testOnly: expectedNetwork === "testnet",
  });
}
