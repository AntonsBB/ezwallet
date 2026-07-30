import { getBinding } from "@/db";
import { authenticateRequest, authErrorResponse } from "@/lib/auth";
import { normalizeTonAddress } from "@/lib/payment-configuration";
import {
  enforceRateLimit,
  noStoreJson,
  RateLimitError,
  rateLimitResponse,
} from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await authenticateRequest(request);
    await enforceRateLimit("wallet-balance", user.id, 30, 300);
    const network =
      getBinding("TON_NETWORK") === "mainnet" ? "mainnet" : "testnet";
    if (
      !user.walletAddress ||
      !user.walletVerifiedAt ||
      user.walletNetwork !== network
    ) {
      return noStoreJson(
        { error: `Verify a ${network} TON wallet to view its balance.` },
        { status: 409 }
      );
    }

    const address = normalizeTonAddress(user.walletAddress, network);
    const endpoint = new URL(
      network === "mainnet"
        ? "https://toncenter.com/api/v2/getAddressBalance"
        : "https://testnet.toncenter.com/api/v2/getAddressBalance"
    );
    endpoint.searchParams.set("address", address);
    const headers = new Headers();
    const apiKey = getBinding("TONCENTER_API_KEY");
    if (apiKey) headers.set("x-api-key", apiKey);

    let response: Response;
    try {
      response = await fetch(endpoint, {
        headers,
        signal: AbortSignal.timeout(8_000),
      });
    } catch {
      return noStoreJson(
        { error: "Wallet balance is temporarily unavailable." },
        { status: 503 }
      );
    }
    if (!response.ok) {
      return noStoreJson(
        { error: "Wallet balance is temporarily unavailable." },
        { status: 503 }
      );
    }
    const data = (await response.json()) as {
      ok?: boolean;
      result?: string;
    };
    if (!data.ok || !data.result || !/^\d+$/.test(data.result)) {
      return noStoreJson(
        { error: "Wallet balance is temporarily unavailable." },
        { status: 503 }
      );
    }

    return noStoreJson({
      asset: "TON",
      network,
      balanceNano: data.result,
      visibility: "owner_only",
    });
  } catch (error) {
    if (error instanceof RateLimitError) return rateLimitResponse(error);
    return authErrorResponse(error);
  }
}
