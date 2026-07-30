import assert from "node:assert/strict";
import test from "node:test";
import {
  readBoundedTextBody,
  RequestBodyTooLargeError,
} from "../lib/request-body";

function streamRequest(chunks: Uint8Array[], onCancel?: () => void) {
  let index = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks[index];
      index += 1;
      if (chunk) {
        controller.enqueue(chunk);
      } else {
        controller.close();
      }
    },
    cancel() {
      onCancel?.();
    },
  });
  return new Request("https://easywallet.example/api", {
    method: "POST",
    body,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
}

test("reads a streaming request while enforcing bytes rather than characters", async () => {
  const encoder = new TextEncoder();
  const request = streamRequest([
    encoder.encode('{"name":"'),
    encoder.encode("Rīga"),
    encoder.encode('"}'),
  ]);
  assert.equal(
    await readBoundedTextBody(request, 32),
    '{"name":"Rīga"}'
  );
});

test("cancels the body stream as soon as the byte limit is exceeded", async () => {
  const encoder = new TextEncoder();
  let cancelled = false;
  const request = streamRequest(
    [encoder.encode("1234"), encoder.encode("5678")],
    () => {
      cancelled = true;
    }
  );
  await assert.rejects(
    () => readBoundedTextBody(request, 6),
    RequestBodyTooLargeError
  );
  assert.equal(cancelled, true);
});

test("rejects an oversized declared length without consuming the stream", async () => {
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.enqueue(new TextEncoder().encode("{}"));
      controller.close();
    },
  });
  const request = new Request("https://easywallet.example/api", {
    method: "POST",
    headers: { "content-length": "9000" },
    body,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
  await assert.rejects(
    () => readBoundedTextBody(request, 4096),
    RequestBodyTooLargeError
  );
  assert.equal(request.bodyUsed, false);
});
