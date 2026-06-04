import { routes, type VercelConfig } from '@vercel/config/v1'

const convexSiteUrl = getConvexSiteUrl()

export const config: VercelConfig = {
  rewrites:
    convexSiteUrl === null
      ? [routes.rewrite('/(.*)', '/index.html')]
      : [
          routes.rewrite('/auth/:path*', `${convexSiteUrl}/auth/:path*`),
          routes.rewrite('/api/:path*', `${convexSiteUrl}/api/:path*`),
          routes.rewrite('/(.*)', '/index.html'),
        ],
}

function getConvexSiteUrl() {
  const value = process.env.CONVEX_SITE_URL_FOR_PROXY

  if (!value) {
    return null
  }

  const url = new URL(value)

  if (url.protocol !== 'https:') {
    throw new Error('CONVEX_SITE_URL_FOR_PROXY must be an https URL.')
  }

  return url.origin
}
