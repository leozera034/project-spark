const EXTERNAL_SUPABASE_URL = 'https://ypgteuxzgqmkkkpvibhi.supabase.co';
const EXTERNAL_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_r2VeXySDe1VMkFkeubZ7ww_usGb6kSG';
const SUPPORT_EDGE_URL = `${EXTERNAL_SUPABASE_URL}/functions/v1/pediu-public-support`;

type SupportEnvelope<T> = { ok: true; data: T } | { ok: false; error?: string };

export class PediuPublicSupportError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
  ) {
    super(code);
    this.name = 'PediuPublicSupportError';
  }
}

export async function invokePediuPublicSupport<T>(
  payload: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(SUPPORT_EDGE_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: EXTERNAL_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify(payload),
  });

  let parsed: SupportEnvelope<T> | null = null;
  try {
    parsed = (await response.json()) as SupportEnvelope<T>;
  } catch {
    throw new PediuPublicSupportError('support_invalid_response', response.status || 502);
  }

  if (!response.ok || !parsed || parsed.ok !== true) {
    const code = parsed && parsed.ok === false ? parsed.error ?? 'support_unavailable' : 'support_unavailable';
    throw new PediuPublicSupportError(code, response.status || 502);
  }

  return parsed.data;
}
