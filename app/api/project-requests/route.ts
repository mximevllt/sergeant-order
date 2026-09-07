import { isSameOriginRequest } from '@/modules/auth/security.mjs';
import { getSessionFromCookie } from '@/modules/auth/service';
import { getCustomerWorkspace } from '@/modules/customer/service';
import { runtimeValue } from '@/config/runtime-environment';

export const dynamic = 'force-dynamic';

type ProjectRequest = {
  contact?: { firstName?: unknown; lastName?: unknown; email?: unknown; phone?: unknown };
  address?: { line1?: unknown; postalCode?: unknown; city?: unknown };
  project?: { title?: unknown; category?: unknown; description?: unknown; desiredDate?: unknown; budget?: unknown };
};

function splitName(value: string) {
  const parts = value.trim().split(/\s+/u).filter(Boolean);
  return { firstName: parts.shift() || '', lastName: parts.join(' ') };
}

function connectorConfig() {
  const endpoint = runtimeValue('CRM_PUBLIC_REQUESTS_URL');
  const token = runtimeValue('CRM_PUBLIC_REQUESTS_TOKEN');
  try {
    const url = new URL(endpoint);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if ((!local && url.protocol !== 'https:') || token.length < 32) return null;
    return { endpoint: url.toString(), token };
  } catch {
    return null;
  }
}

async function connectedCustomer(request: Request) {
  const user = await getSessionFromCookie(request.headers.get('cookie'));
  if (!user || user.sessionKind !== 'CUSTOMER') return null;
  const workspace = await getCustomerWorkspace(user.id);
  const garden = workspace.gardens[0];
  return { user, profile: workspace.profile, garden };
}

export async function GET(request: Request) {
  try {
    const customer = await connectedCustomer(request);
    if (!customer) return Response.json({ authenticated: false }, { headers: { 'Cache-Control': 'no-store' } });
    const name = splitName(customer.profile.fullName);
    return Response.json({
      authenticated: true,
      contact: { ...name, email: customer.profile.email, phone: customer.profile.phone || '' },
      address: customer.garden ? { line1: customer.garden.line1, postalCode: customer.garden.postalCode, city: customer.garden.city } : { line1: '', postalCode: '', city: '' },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ authenticated: false }, { headers: { 'Cache-Control': 'no-store' } });
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) return Response.json({ error: 'ORIGIN_DENIED' }, { status: 403 });
  const config = connectorConfig();
  if (!config) return Response.json({ error: 'CRM_CONNECTOR_UNAVAILABLE' }, { status: 503 });
  const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (contentType !== 'application/json') return Response.json({ error: 'JSON_REQUIRED' }, { status: 400 });
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > 32_000) return Response.json({ error: 'PAYLOAD_TOO_LARGE' }, { status: 413 });
  let body: ProjectRequest;
  try { body = JSON.parse(raw) as ProjectRequest; }
  catch { return Response.json({ error: 'JSON_INVALID' }, { status: 400 }); }

  let authenticatedEmail: string | null = null;
  try { authenticatedEmail = (await connectedCustomer(request))?.profile.email || null; }
  catch { authenticatedEmail = null; }
  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-sergeant-public-request-token': config.token },
    body: JSON.stringify({ ...body, authenticatedEmail }),
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!response) return Response.json({ error: 'CRM_UNAVAILABLE' }, { status: 503 });
  const result = await response.json().catch(() => ({})) as { error?: string; demande?: { id?: string } };
  if (!response.ok) return Response.json({ error: result.error || 'REQUEST_FAILED' }, { status: response.status >= 500 ? 503 : 400 });
  return Response.json({ demande: result.demande }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}
