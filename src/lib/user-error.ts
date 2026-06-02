const DEFAULT_ERROR_MESSAGE = 'Inténtalo de nuevo en unos segundos.'

export function getUserErrorMessage(error: unknown, fallback = DEFAULT_ERROR_MESSAGE) {
  if (error instanceof Error) {
    return formatUserErrorMessage(error.message, fallback)
  }

  if (typeof error === 'string') {
    return formatUserErrorMessage(error, fallback)
  }

  return fallback
}

export function formatUserErrorMessage(message: string, fallback = DEFAULT_ERROR_MESSAGE) {
  const cleaned = message
    .replace(/^Uncaught\s+(?:Error|ConvexError):\s*/i, '')
    .replace(/^(?:Error|ConvexError):\s*/i, '')
    .replace(/\s+at\s+handler\s+\([^)]*\)\s*$/i, '')
    .trim()

  return cleaned || fallback
}
