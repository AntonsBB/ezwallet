import assert from "node:assert/strict";
import test from "node:test";
import { Address, beginCell } from "@ton/core";
import { dealIdToUint256, queryIdForDeal } from "../lib/ton-escrow.ts";
import {
  hashesEqual,
  lookupFinalizedContractMessage,
  normalizedTonHash,
  sameAddress,
  terminalPayoutsMatch,
  TonProviderUnavailableError,
  type SettlementDeal,
  type TonMessage,
  type TonTransaction,
} from "../lib/ton-verification.ts";

const dealId = "123e4567-e89b-12d3-a456-426614174000";

function address(byte: string) {
  return Address.parseRaw(`0:${byte.repeat(64)}`);
}

const buyer = address("1");
const seller = address("2");
const platform = address("3");
const escrow = address("4");
const outsider = address("5");
const fundingPayload = beginCell()
  .storeUint(0x12345678, 32)
  .endCell()
  .toBoc()
  .toString("base64");

function friendly(value: Address, bounceable = false) {
  return value.toString({ bounceable, testOnly: true });
}

function payoutBody(kind: number) {
  return beginCell()
    .storeUint(0xea5e0008, 32)
    .storeUint(queryIdForDeal(dealId), 64)
    .storeUint(dealIdToUint256(dealId), 256)
    .storeUint(kind, 8)
    .endCell()
    .toBoc()
    .toString("base64");
}

function payout(
  destination: Address,
  kind: number,
  value: string
): TonMessage {
  return {
    source: friendly(escrow),
    destination: friendly(destination),
    value,
    message_content: { body: payoutBody(kind) },
  };
}

const settlement: SettlementDeal = {
  id: dealId,
  escrowAddress: friendly(escrow),
  buyerWalletAddress: friendly(buyer),
  sellerWalletAddress: friendly(seller),
  platformWalletAddress: friendly(platform),
  sellerAmountNano: "4950000000",
  platformFeeNano: "100000000",
};

function terminal(outMessages: TonMessage[]): TonTransaction {
  return {
    description: { destroyed: true },
    out_msgs: outMessages,
  };
}

function hashBytes(seed: number) {
  return Uint8Array.from({ length: 32 }, (_, index) => (index + seed) % 256);
}

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function validLookupRecords() {
  const transactionHashBytes = hashBytes(10);
  const messageHashBytes = hashBytes(20);
  const codeHashBytes = hashBytes(30);
  const dataHashBytes = hashBytes(40);
  const transactionHashHex = Buffer.from(transactionHashBytes).toString("hex");
  const transactionHashBase64Url = Buffer.from(transactionHashBytes)
    .toString("base64url");
  const messageHashHex = Buffer.from(messageHashBytes).toString("hex");
  const messageHashBase64 = Buffer.from(messageHashBytes).toString("base64");
  const codeHash = Buffer.from(codeHashBytes).toString("hex");
  const dataHash = Buffer.from(dataHashBytes).toString("hex");
  const message: TonMessage = {
    bounced: false,
    source: friendly(buyer),
    destination: friendly(escrow),
    value: "5170000000",
    hash: messageHashBase64,
    out_msg_tx_hash: Buffer.from(hashBytes(50)).toString("base64"),
    in_msg_tx_hash: transactionHashBase64Url,
    message_content: { body: fundingPayload },
  };
  const transaction: TonTransaction = {
    account: friendly(escrow),
    account_state_after: {
      account_status: "active",
      code_hash: codeHash,
      data_hash: Buffer.from(dataHashBytes).toString("base64"),
    },
    emulated: false,
    hash: transactionHashHex,
    mc_block_seqno: 123,
    description: {
      aborted: false,
      installed: true,
      action: { success: true, valid: true },
      compute_ph: { success: true },
    },
    in_msg: {
      ...message,
      hash: messageHashHex,
    },
  };
  return { codeHash, dataHash, message, transaction };
}

function lookupInput(fetcher: typeof fetch) {
  const { codeHash, dataHash } = validLookupRecords();
  return {
    baseUrl: "https://ton.example/api/v3/",
    source: friendly(buyer),
    destination: friendly(escrow),
    amountNano: "5170000000",
    payloadBase64: fundingPayload,
    expectedCodeHash: codeHash,
    expectedDataHash: dataHash,
    startUnix: 1_700_000_000,
    phase: "deploy" as const,
    fetcher,
  };
}

test("normalizes TON hashes across hex, base64, and base64url", () => {
  const bytes = Uint8Array.from({ length: 32 }, (_, index) => index);
  const hex = Buffer.from(bytes).toString("hex");
  const base64 = Buffer.from(bytes).toString("base64");
  const base64url = base64
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");

  assert.equal(normalizedTonHash(`0x${hex.toUpperCase()}`), hex);
  assert.equal(normalizedTonHash(base64), hex);
  assert.equal(normalizedTonHash(base64url), hex);
  assert.equal(hashesEqual(hex, base64url), true);
  assert.equal(normalizedTonHash("not-a-hash"), null);
});

test("compares raw, bounceable, and non-bounceable forms of one address", () => {
  assert.equal(sameAddress(friendly(buyer), friendly(buyer, true)), true);
  assert.equal(sameAddress(friendly(buyer), friendly(seller)), false);
  assert.equal(sameAddress("invalid", friendly(buyer)), false);
});

test("accepts only the exact three-message release payout", () => {
  const release = [
    payout(seller, 1, settlement.sellerAmountNano),
    payout(platform, 2, settlement.platformFeeNano),
    payout(buyer, 3, "117000000"),
  ];
  assert.equal(
    terminalPayoutsMatch(terminal(release), settlement, "release"),
    true
  );

  const wrongSellerAmount = [
    payout(seller, 1, "4949999999"),
    payout(platform, 2, settlement.platformFeeNano),
    payout(buyer, 3, "117000000"),
  ];
  assert.equal(
    terminalPayoutsMatch(
      terminal(wrongSellerAmount),
      settlement,
      "release"
    ),
    false
  );

  const unexpectedFourthPayout = [
    ...release,
    payout(outsider, 3, "1"),
  ];
  assert.equal(
    terminalPayoutsMatch(
      terminal(unexpectedFourthPayout),
      settlement,
      "release"
    ),
    false
  );
});

test("accepts one full-balance refund and rejects extra payout messages", () => {
  const refund = [payout(buyer, 4, "5160000000")];
  assert.equal(
    terminalPayoutsMatch(terminal(refund), settlement, "refund"),
    true
  );
  assert.equal(
    terminalPayoutsMatch(
      terminal([...refund, payout(outsider, 4, "1")]),
      settlement,
      "refund"
    ),
    false
  );
  assert.equal(
    terminalPayoutsMatch(
      { description: { destroyed: false }, out_msgs: refund },
      settlement,
      "refund"
    ),
    false
  );
});

test("verifies a finalized deployment across provider hash encodings", async () => {
  const { message, transaction } = validLookupRecords();
  const requested: string[] = [];
  const fetcher = (async (input: string | URL | Request) => {
    const url = String(input);
    requested.push(url);
    return url.includes("/messages?")
      ? jsonResponse({ messages: [message] })
      : jsonResponse({ transactions: [transaction] });
  }) as typeof fetch;

  const result = await lookupFinalizedContractMessage(lookupInput(fetcher));
  assert.equal(result?.transaction.mc_block_seqno, 123);
  assert.equal(requested.length, 2);
  assert.match(requested[0]!, /source=0%3A/);
  assert.match(requested[0]!, /destination=0%3A/);
});

test("ignores bounced or body-mismatched message replays", async () => {
  const { message } = validLookupRecords();
  let calls = 0;
  const fetcher = (async () => {
    calls += 1;
    return jsonResponse({
      messages: [
        { ...message, bounced: true },
        {
          ...message,
          message_content: {
            body: beginCell()
              .storeUint(0x87654321, 32)
              .endCell()
              .toBoc()
              .toString("base64"),
          },
        },
      ],
    });
  }) as typeof fetch;

  assert.equal(
    await lookupFinalizedContractMessage(lookupInput(fetcher)),
    null
  );
  assert.equal(calls, 1);
});

test("rejects emulated transactions and mismatched pinned state", async () => {
  const { message, transaction } = validLookupRecords();
  const emulatedFetcher = (async (input: string | URL | Request) =>
    String(input).includes("/messages?")
      ? jsonResponse({ messages: [message] })
      : jsonResponse({
          transactions: [{ ...transaction, emulated: true }],
        })) as typeof fetch;
  assert.equal(
    await lookupFinalizedContractMessage(lookupInput(emulatedFetcher)),
    null
  );

  const wrongStateFetcher = (async (input: string | URL | Request) =>
    String(input).includes("/messages?")
      ? jsonResponse({ messages: [message] })
      : jsonResponse({
          transactions: [
            {
              ...transaction,
              account_state_after: {
                ...transaction.account_state_after,
                data_hash: Buffer.from(hashBytes(99)).toString("hex"),
              },
            },
          ],
        })) as typeof fetch;
  assert.equal(
    await lookupFinalizedContractMessage(lookupInput(wrongStateFetcher)),
    null
  );
});

test("distinguishes provider outage from a verified absence", async () => {
  const fetcher = (async () =>
    jsonResponse({ error: "unavailable" }, 503)) as typeof fetch;
  await assert.rejects(
    lookupFinalizedContractMessage(lookupInput(fetcher)),
    TonProviderUnavailableError
  );
});
