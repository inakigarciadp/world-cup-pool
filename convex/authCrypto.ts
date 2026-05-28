const PIN_HASH_ITERATIONS = 210_000
const PIN_SALT_BYTES = 16
const PIN_HASH_BYTES = 32
const ACCESS_TOKEN_TTL_SECONDS = 60 * 15
const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30

type TokenKind = 'access' | 'refresh'

type AuthTokenPayload = {
  kind: TokenKind
  poolId: string
  participantId: string
  sessionId?: string
  exp: number
}

export const authDurations = {
  accessTokenSeconds: ACCESS_TOKEN_TTL_SECONDS,
  refreshTokenSeconds: REFRESH_TOKEN_TTL_SECONDS,
}

export async function hashPin(pin: string) {
  const salt = crypto.getRandomValues(new Uint8Array(PIN_SALT_BYTES))
  const hash = await pbkdf2(pin, salt, PIN_HASH_ITERATIONS)

  return `pbkdf2-sha256$${PIN_HASH_ITERATIONS}$${base64UrlEncode(salt)}$${base64UrlEncode(hash)}`
}

export async function verifyPin(pin: string, encodedHash: string) {
  const [algorithm, iterations, encodedSalt, encodedExpectedHash] = encodedHash.split('$')

  if (algorithm !== 'pbkdf2-sha256' || !iterations || !encodedSalt || !encodedExpectedHash) {
    return false
  }

  const hash = await pbkdf2(pin, base64UrlDecode(encodedSalt), Number(iterations))
  const expectedHash = base64UrlDecode(encodedExpectedHash)

  return constantTimeEqual(hash, expectedHash)
}

export async function signAuthToken(payload: Omit<AuthTokenPayload, 'exp'>, ttlSeconds: number, secret: string) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds
  const header = { alg: 'HS256', typ: 'JWT' }
  const body: AuthTokenPayload = { ...payload, exp }
  const unsignedToken = `${base64UrlEncodeJson(header)}.${base64UrlEncodeJson(body)}`
  const signature = await hmacSha256(unsignedToken, secret)

  return `${unsignedToken}.${base64UrlEncode(signature)}`
}

export async function verifyAuthToken(token: string, expectedKind: TokenKind, secret: string) {
  const [encodedHeader, encodedBody, encodedSignature] = token.split('.')

  if (!encodedHeader || !encodedBody || !encodedSignature) {
    return null
  }

  const unsignedToken = `${encodedHeader}.${encodedBody}`
  const signature = await hmacSha256(unsignedToken, secret)

  if (!constantTimeEqual(signature, base64UrlDecode(encodedSignature))) {
    return null
  }

  const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(encodedBody))) as AuthTokenPayload

  if (payload.kind !== expectedKind || payload.exp <= Math.floor(Date.now() / 1000)) {
    return null
  }

  return payload
}

export async function hashRefreshToken(token: string, secret: string) {
  return base64UrlEncode(await hmacSha256(token, secret))
}

async function pbkdf2(pin: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: new Uint8Array(salt),
      iterations,
    },
    key,
    PIN_HASH_BYTES * 8,
  )

  return new Uint8Array(bits)
}

async function hmacSha256(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  return new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)))
}

function base64UrlEncodeJson(value: unknown) {
  return base64UrlEncode(new TextEncoder().encode(JSON.stringify(value)))
}

function base64UrlEncode(value: Uint8Array) {
  return btoa(String.fromCharCode(...value)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
}

function base64UrlDecode(value: string) {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (value.length % 4)) % 4)
  const decoded = atob(padded)
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0))
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) {
    return false
  }

  let difference = 0
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index]
  }

  return difference === 0
}
