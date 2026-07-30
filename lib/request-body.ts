export class RequestBodyTooLargeError extends Error {
  constructor(public readonly limitBytes: number) {
    super(`Request body exceeds ${limitBytes} bytes.`);
    this.name = "RequestBodyTooLargeError";
  }
}

function declaredContentLength(request: Request) {
  const value = request.headers.get("content-length");
  if (!value || !/^\d+$/.test(value)) return null;
  const length = Number(value);
  return Number.isSafeInteger(length) ? length : Number.POSITIVE_INFINITY;
}

export async function readBoundedTextBody(
  request: Request,
  limitBytes: number
) {
  if (!Number.isSafeInteger(limitBytes) || limitBytes < 0) {
    throw new TypeError("Request body limit must be a non-negative integer.");
  }
  const declaredLength = declaredContentLength(request);
  if (declaredLength !== null && declaredLength > limitBytes) {
    throw new RequestBodyTooLargeError(limitBytes);
  }
  if (!request.body) return "";

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let receivedBytes = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      receivedBytes += value.byteLength;
      if (receivedBytes > limitBytes) {
        await reader.cancel("request_body_limit_exceeded").catch(() => {});
        throw new RequestBodyTooLargeError(limitBytes);
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}
