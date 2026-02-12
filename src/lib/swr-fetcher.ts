/**
 * Global SWR fetcher for API routes
 * Used as the default fetcher in SWRConfig
 * Includes a 15 second timeout to prevent infinite loading states
 */
export const swrFetcher = async (url: string) => {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 15000) // 15s timeout

  try {
    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)

    if (!res.ok) {
      throw new Error('An error occurred while fetching the data.')
    }
    return res.json()
  } catch (err) {
    clearTimeout(timeoutId)
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`Request timeout after 15s: ${url}`)
    }
    throw err
  }
}
