// Server authentication middleware for Project Spark / Pediu Aqui.
// Auth tokens are always validated against the external production foundation;
// Lovable Cloud environment variables are intentionally ignored here so a
// stale QA project cannot authenticate production requests by accident.
import { createMiddleware } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

const SUPABASE_URL = 'https://ypgteuxzgqmkkkpvibhi.supabase.co'

function publishableKey(): string {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY?.trim() || process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
  if (!key) throw new Error('SUPABASE_PUBLISHABLE_KEY is not configured')
  return key
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
    )

    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value))
    }

    if (headers.get('Authorization') === `Bearer ${supabaseKey}`) {
      headers.delete('Authorization')
    }

    headers.set('apikey', supabaseKey)
    return fetch(input, { ...init, headers })
  }
}

export const requireSupabaseAuth = createMiddleware({ type: 'function' }).server(
  async ({ next }) => {
    const request = getRequest()

    if (!request?.headers) {
      throw new Error('Unauthorized: No request headers available')
    }

    const authHeader = request.headers.get('authorization')

    if (!authHeader?.startsWith('Bearer ')) {
      throw new Error('Unauthorized: Bearer token required')
    }

    const token = authHeader.slice('Bearer '.length).trim()
    if (!token || token.split('.').length !== 3) {
      throw new Error('Unauthorized: Invalid token')
    }

    const key = publishableKey()
    const supabase = createClient<Database>(SUPABASE_URL, key, {
      global: {
        fetch: createSupabaseFetch(key),
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
      auth: {
        storage: undefined,
        persistSession: false,
        autoRefreshToken: false,
      },
    })

    // `getUser` validates the token with the external Auth service. We do not
    // trust claims from a stale Lovable-managed project or from the caller.
    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data.user?.id) {
      throw new Error('Unauthorized: Invalid token')
    }

    return next({
      context: {
        supabase,
        userId: data.user.id,
        accessToken: token,
        user: data.user,
      },
    })
  },
)
