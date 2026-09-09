/**
 * Utility to safely fetch all rows beyond Supabase's default 1,000-row PostgREST limit.
 */
export async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => Promise<{ data: T[] | null; error: any }>,
  chunkSize: number = 1000
): Promise<T[]> {
  let allRecords: T[] = []
  let from = 0
  let hasMore = true

  while (hasMore) {
    const to = from + chunkSize - 1
    const { data, error } = await fetchPage(from, to)

    if (error) {
      console.error('Error in fetchAllRows pagination chunk:', error)
      throw error
    }

    if (data && data.length > 0) {
      allRecords = allRecords.concat(data)
      if (data.length < chunkSize) {
        hasMore = false
      } else {
        from += chunkSize
      }
    } else {
      hasMore = false
    }
  }

  return allRecords
}
