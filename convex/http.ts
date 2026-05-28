import { httpRouter } from 'convex/server'

import { internal } from './_generated/api'
import { httpAction } from './_generated/server'
import type { Id } from './_generated/dataModel'
import { authDurations, hashRefreshToken, signAuthToken, verifyAuthToken } from './authCrypto'

const ACCESS_COOKIE = 'wcp_access'
const REFRESH_COOKIE = 'wcp_refresh'

declare const process: {
  env: Record<string, string | undefined>
}

const http = httpRouter()

http.route({
  path: '/auth/login',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const body = await request.json()
    const authSecret = getAuthSecret()
    let session

    try {
      session = await ctx.runMutation(internal.pools.loginForHttp, {
        loginName: String(body.loginName ?? ''),
        pin: String(body.pin ?? ''),
        slug: typeof body.slug === 'string' ? body.slug : undefined,
      })
    } catch {
      return jsonResponse({ error: 'El nombre de participante o el PIN no son correctos.' }, request, 401)
    }
    const refreshToken = await signAuthToken(
      {
        kind: 'refresh',
        poolId: session.poolId,
        participantId: session.participantId,
      },
      authDurations.refreshTokenSeconds,
      authSecret,
    )
    const sessionId = await ctx.runMutation(internal.pools.createRefreshSession, {
      poolId: session.poolId,
      participantId: session.participantId,
      refreshTokenHash: await hashRefreshToken(refreshToken, authSecret),
      expiresAt: Date.now() + authDurations.refreshTokenSeconds * 1000,
    })
    const accessToken = await signAuthToken(
      {
        kind: 'access',
        poolId: session.poolId,
        participantId: session.participantId,
        sessionId,
      },
      authDurations.accessTokenSeconds,
      authSecret,
    )
    const sessionRefreshToken = await signAuthToken(
      {
        kind: 'refresh',
        poolId: session.poolId,
        participantId: session.participantId,
        sessionId,
      },
      authDurations.refreshTokenSeconds,
      authSecret,
    )

    await ctx.runMutation(internal.pools.rotateRefreshSession, {
      sessionId,
      currentRefreshTokenHash: await hashRefreshToken(refreshToken, authSecret),
      refreshTokenHash: await hashRefreshToken(sessionRefreshToken, authSecret),
      expiresAt: Date.now() + authDurations.refreshTokenSeconds * 1000,
    })

    return jsonResponse(
      {
        participantName: session.participantName,
        isAdmin: session.isAdmin,
      },
      request,
      200,
      authCookies(accessToken, sessionRefreshToken),
    )
  }),
})

http.route({
  path: '/auth/refresh',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const authSecret = getAuthSecret()
    const refreshToken = getCookie(request, REFRESH_COOKIE)

    if (refreshToken === null) {
      return unauthorized(request, clearAccessCookie())
    }

    const payload = await verifyAuthToken(refreshToken, 'refresh', authSecret)

    if (payload === null || !payload.sessionId) {
      return unauthorized(request)
    }

    const nextRefreshToken = await signAuthToken(
      {
        kind: 'refresh',
        poolId: payload.poolId,
        participantId: payload.participantId,
        sessionId: payload.sessionId,
      },
      authDurations.refreshTokenSeconds,
      authSecret,
    )
    const session = await ctx.runMutation(internal.pools.rotateRefreshSession, {
      sessionId: payload.sessionId as Id<'participantSessions'>,
      currentRefreshTokenHash: await hashRefreshToken(refreshToken, authSecret),
      refreshTokenHash: await hashRefreshToken(nextRefreshToken, authSecret),
      expiresAt: Date.now() + authDurations.refreshTokenSeconds * 1000,
    })

    if (session === null) {
      return unauthorized(request)
    }

    const accessToken = await signAuthToken(
      {
        kind: 'access',
        poolId: session.poolId,
        participantId: session.participantId,
        sessionId: payload.sessionId,
      },
      authDurations.accessTokenSeconds,
      authSecret,
    )

    return jsonResponse({ ok: true }, request, 200, authCookies(accessToken, nextRefreshToken))
  }),
})

http.route({
  path: '/auth/logout',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const authSecret = getAuthSecret()
    const refreshToken = getCookie(request, REFRESH_COOKIE)
    const payload = refreshToken === null ? null : await verifyAuthToken(refreshToken, 'refresh', authSecret)

    if (payload?.sessionId) {
      await ctx.runMutation(internal.pools.revokeRefreshSession, {
        sessionId: payload.sessionId as Id<'participantSessions'>,
      })
    }

    return jsonResponse({ ok: true }, request, 200, clearAuthCookies())
  }),
})

http.route({
  path: '/api/overview',
  method: 'GET',
  handler: httpAction(async (ctx, request) => {
    const authSecret = getAuthSecret()
    const accessToken = getCookie(request, ACCESS_COOKIE)
    const payload = accessToken === null ? null : await verifyAuthToken(accessToken, 'access', authSecret)

    if (payload === null) {
      return unauthorized(request, clearAccessCookie())
    }

    const url = new URL(request.url)
    const overview = await ctx.runQuery(internal.pools.getAuthenticatedOverview, {
      poolId: payload.poolId as Id<'pools'>,
      participantId: payload.participantId as Id<'participants'>,
      slug: url.searchParams.get('slug') ?? undefined,
    })

    if (overview === null) {
      return unauthorized(request)
    }

    return jsonResponse(overview, request)
  }),
})

http.route({
  path: '/api/entry',
  method: 'POST',
  handler: httpAction(async (ctx, request) => {
    const authSecret = getAuthSecret()
    const accessToken = getCookie(request, ACCESS_COOKIE)
    const payload = accessToken === null ? null : await verifyAuthToken(accessToken, 'access', authSecret)

    if (payload === null) {
      return unauthorized(request, clearAccessCookie())
    }

    const body = await request.json()

    try {
      const result = await ctx.runMutation(internal.pools.saveEntryForHttp, {
        poolId: payload.poolId as Id<'pools'>,
        participantId: payload.participantId as Id<'participants'>,
        teamPickIds: Array.isArray(body.teamPickIds) ? body.teamPickIds : [],
        goalscorerPickId: typeof body.goalscorerPickId === 'string' ? body.goalscorerPickId : null,
      })

      return jsonResponse(result, request)
    } catch (caught) {
      return jsonResponse({ error: caught instanceof Error ? caught.message : 'No se ha podido guardar la entrada.' }, request, 400)
    }
  }),
})

http.route({
  path: '/auth/login',
  method: 'OPTIONS',
  handler: httpAction(async (_ctx, request) => optionsResponse(request)),
})
http.route({
  path: '/auth/refresh',
  method: 'OPTIONS',
  handler: httpAction(async (_ctx, request) => optionsResponse(request)),
})
http.route({
  path: '/auth/logout',
  method: 'OPTIONS',
  handler: httpAction(async (_ctx, request) => optionsResponse(request)),
})
http.route({
  path: '/api/overview',
  method: 'OPTIONS',
  handler: httpAction(async (_ctx, request) => optionsResponse(request)),
})
http.route({
  path: '/api/entry',
  method: 'OPTIONS',
  handler: httpAction(async (_ctx, request) => optionsResponse(request)),
})

function getAuthSecret() {
  const secret = process.env.AUTH_JWT_SECRET

  if (!secret || secret.length < 32) {
    throw new Error('AUTH_JWT_SECRET must be set to at least 32 characters.')
  }

  return secret
}

function jsonResponse(body: unknown, request: Request, status = 200, cookies: string[] = []) {
  const headers = corsHeaders(request)
  headers.set('Content-Type', 'application/json')

  for (const cookie of cookies) {
    headers.append('Set-Cookie', cookie)
  }

  return new Response(JSON.stringify(body), { status, headers })
}

function unauthorized(request: Request, cookies: string[] = []) {
  return jsonResponse({ error: 'No autorizado.' }, request, 401, cookies)
}

function optionsResponse(request: Request) {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request),
  })
}

function corsHeaders(request: Request) {
  const origin = request.headers.get('Origin') ?? process.env.SITE_ORIGIN ?? ''
  const headers = new Headers({
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    Vary: 'Origin',
  })

  if (origin) {
    headers.set('Access-Control-Allow-Origin', origin)
  }

  return headers
}

function authCookies(accessToken: string, refreshToken: string) {
  return [
    serializeCookie(ACCESS_COOKIE, accessToken, authDurations.accessTokenSeconds),
    serializeCookie(REFRESH_COOKIE, refreshToken, authDurations.refreshTokenSeconds),
  ]
}

function clearAuthCookies() {
  return [serializeCookie(ACCESS_COOKIE, '', 0), serializeCookie(REFRESH_COOKIE, '', 0)]
}

function clearAccessCookie() {
  return [serializeCookie(ACCESS_COOKIE, '', 0)]
}

function serializeCookie(name: string, value: string, maxAge: number) {
  return `${name}=${value}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=None`
}

function getCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get('Cookie')

  if (!cookieHeader) {
    return null
  }

  for (const cookie of cookieHeader.split(';')) {
    const [cookieName, ...valueParts] = cookie.trim().split('=')

    if (cookieName === name) {
      return valueParts.join('=')
    }
  }

  return null
}

export default http
