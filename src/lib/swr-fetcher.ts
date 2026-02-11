/**
 * Global SWR fetcher for API routes
 * Used as the default fetcher in SWRConfig
 */
export const swrFetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    const error = new Error('An error occurred while fetching the data.')
    throw error
  }
  return res.json()
}
