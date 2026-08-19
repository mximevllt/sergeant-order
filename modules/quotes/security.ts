import { runtimeValue } from "@/config/runtime-environment";
import { hashSecret, readCookie } from "@/modules/auth/security.mjs";

export const QUOTE_DRAFT_COOKIE_NAME = "sp_quote_draft";
export const QUOTE_DRAFT_TTL_SECONDS = 7 * 24 * 60 * 60;

async function proofFor(quoteId: string): Promise<string> {
  return hashSecret(`quote-draft:${quoteId}`, runtimeValue("AUTH_SECRET"));
}

export async function quoteDraftCookie(quoteId: string, secure = true): Promise<string> {
  const proof = await proofFor(quoteId);
  return [
    `${QUOTE_DRAFT_COOKIE_NAME}=${encodeURIComponent(`${quoteId}.${proof}`)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : null,
    `Max-Age=${QUOTE_DRAFT_TTL_SECONDS}`,
  ].filter(Boolean).join("; ");
}

export async function readQuoteDraftId(cookieHeader: string | null | undefined): Promise<string | null> {
  const value = readCookie(cookieHeader, QUOTE_DRAFT_COOKIE_NAME);
  if (!value) return null;
  const separator = value.lastIndexOf(".");
  if (separator < 1) return null;
  const quoteId = value.slice(0, separator);
  const proof = value.slice(separator + 1);
  if (!/^[a-f0-9-]{20,50}$/iu.test(quoteId) || !/^[a-f0-9]{64}$/u.test(proof)) return null;
  const expected = await proofFor(quoteId);
  if (proof.length !== expected.length) return null;
  let different = 0;
  for (let index = 0; index < proof.length; index += 1) different |= proof.charCodeAt(index) ^ expected.charCodeAt(index);
  return different === 0 ? quoteId : null;
}
