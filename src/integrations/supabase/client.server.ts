// Server-side Supabase access for Project Spark / Pediu Aqui.
//
// Preferred mode: when the deployment has an external-project admin key,
// create a normal privileged Supabase client.
//
// Safe fallback: public storefront RPCs and private asset signing are routed
// through the allowlisted `pediu-backend-api` Edge Function that runs inside
// the external Supabase project. The fallback NEVER exposes generic table,
// Auth admin, or arbitrary RPC access.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const EXPECTED_SUPABASE_PROJECT_REF = 'ypgteuxzgqmkkkpvibhi';
const EXTERNAL_SUPABASE_URL = `https://${EXPECTED_SUPABASE_PROJECT_REF}.supabase.co`;
const EXTERNAL_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_r2VeXySDe1VMkFkeubZ7ww_usGb6kSG';
const BACKEND_EDGE_URL = `${EXTERNAL_SUPABASE_URL}/functions/v1/pediu-backend-api`;

const EDGE_RPC_ALLOWLIST = new Set([
  'check_public_store_slug',
  'storefront_store',
  'storefront_catalog',
  'storefront_product',
  'storefront_price',
  'storefront_fulfillment',
  'storefront_validate_fulfillment',
  'storefront_payment_methods',
  'storefront_submit_order',
  'storefront_order_tracking',
]);

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith('sb_publishable_') || value.startsWith('sb_secret_');
}

function isExpectedSupabaseUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    return new URL(value).hostname === `${EXPECTED_SUPABASE_PROJECT_REF}.supabase.co`;
  } catch {
    return false;
  }
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
    );

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }

    if (isNewSupabaseApiKey(supabaseKey) && headers.get('Authorization') === `Bearer ${supabaseKey}`) {
      headers.delete('Authorization');
    }

    headers.set('apikey', supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

export class PediuBackendApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
  ) {
    super(code);
    this.name = 'PediuBackendApiError';
  }
}

type EdgeEnvelope<T> = { ok: true; data: T } | { ok: false; error?: string };

/**
 * Calls the external Supabase Edge gateway using only the browser-safe
 * publishable key. Privilege elevation happens inside Supabase, where secret
 * keys are injected by the platform and never enter Lovable or GitHub.
 */
export async function invokePediuBackendAction<T>(
  payload: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(BACKEND_EDGE_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      apikey: EXTERNAL_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify(payload),
  });

  let parsed: EdgeEnvelope<T> | null = null;
  try {
    parsed = (await response.json()) as EdgeEnvelope<T>;
  } catch {
    throw new PediuBackendApiError('backend_invalid_response', response.status || 502);
  }

  if (!response.ok || !parsed || parsed.ok !== true) {
    const code = parsed && parsed.ok === false ? parsed.error ?? 'backend_unavailable' : 'backend_unavailable';
    throw new PediuBackendApiError(code, response.status || 502);
  }

  return parsed.data;
}

type SupabaseLikeError = { message: string };

type SignedEntry = { path: string; signedUrl: string | null };

async function edgeRpc(rpc: string, args?: Record<string, unknown>) {
  if (!EDGE_RPC_ALLOWLIST.has(rpc)) {
    return {
      data: null,
      error: { message: `RPC ${rpc} is not available through the public Edge fallback.` } satisfies SupabaseLikeError,
    };
  }

  try {
    const data = await invokePediuBackendAction<unknown>({
      action: 'rpc',
      rpc,
      args: args ?? {},
    });
    return { data, error: null };
  } catch (error) {
    const message = error instanceof PediuBackendApiError ? error.code : 'backend_unavailable';
    return { data: null, error: { message } satisfies SupabaseLikeError };
  }
}

async function edgeSignPaths(bucket: string, paths: string[], ttlSeconds: number) {
  try {
    const data = await invokePediuBackendAction<SignedEntry[]>({
      action: 'sign_paths',
      bucket,
      paths,
      ttlSeconds,
    });
    return { data, error: null };
  } catch (error) {
    const message = error instanceof PediuBackendApiError ? error.code : 'backend_unavailable';
    return { data: null, error: { message } satisfies SupabaseLikeError };
  }
}

function createEdgeFallbackClient() {
  const storage = {
    from(bucket: string) {
      return {
        createSignedUrls(paths: string[], ttlSeconds: number) {
          return edgeSignPaths(bucket, paths, ttlSeconds);
        },
        async createSignedUrl(path: string, ttlSeconds: number) {
          const { data, error } = await edgeSignPaths(bucket, [path], ttlSeconds);
          return {
            data: data?.[0] ? { signedUrl: data[0].signedUrl } : null,
            error,
          };
        },
      };
    },
  };

  return new Proxy(
    {
      rpc: edgeRpc,
      storage,
    } as Record<string, unknown>,
    {
      get(target, prop, receiver) {
        if (Reflect.has(target, prop)) return Reflect.get(target, prop, receiver);
        throw new Error(
          `Privileged Supabase operation "${String(prop)}" is unavailable without an external server secret.`,
        );
      },
    },
  );
}

function createSupabaseAdminClient() {
  const runtimeUrl = process.env.SUPABASE_URL;
  const runtimeServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (isExpectedSupabaseUrl(runtimeUrl) && runtimeServiceKey) {
    return createClient<Database>(runtimeUrl, runtimeServiceKey, {
      global: {
        fetch: createSupabaseFetch(runtimeServiceKey),
      },
      auth: {
        storage: undefined,
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  if (runtimeUrl && !isExpectedSupabaseUrl(runtimeUrl)) {
    console.error(
      `[Supabase] Deployment still exposes an unexpected server project URL; using restricted external Edge fallback instead. Expected ${EXPECTED_SUPABASE_PROJECT_REF}.`,
    );
  } else if (!runtimeServiceKey) {
    console.warn('[Supabase] External server secret is not configured; using restricted Edge fallback.');
  }

  return createEdgeFallbackClient() as unknown as ReturnType<typeof createClient<Database>>;
}

let _supabaseAdmin: ReturnType<typeof createSupabaseAdminClient> | undefined;

/**
 * Server-only facade. It is a real admin client only when a valid external
 * project URL + server key are present. Otherwise it can execute only the
 * explicitly allowlisted public Edge operations above.
 */
export const supabaseAdmin = new Proxy({} as ReturnType<typeof createSupabaseAdminClient>, {
  get(_, prop, receiver) {
    if (!_supabaseAdmin) _supabaseAdmin = createSupabaseAdminClient();
    return Reflect.get(_supabaseAdmin, prop, receiver);
  },
});
