/** A remote timeout, error, or malformed response does not prove no credit occurred. */
export async function submitCouponTransfer(
  url: string,
  apiKey: string,
  transfer: { userId: string; userEmail: string; amount: number; transactionId: string },
): Promise<'COMPLETED' | 'PENDING'> {
  try {
    const response = await fetch(url, {
      method: 'POST',
      signal: AbortSignal.timeout(15_000),
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify(transfer),
    })
    const data = await response.json() as { success?: boolean; transactionId?: string }
    // A bare 409 could be a different conflict; it is not a confirmed receipt.
    if (response.ok && data.success === true &&
        (!data.transactionId || data.transactionId === transfer.transactionId)) {
      return 'COMPLETED'
    }
  } catch {
    // Funds remain reserved for reconciliation with the provider.
  }
  return 'PENDING'
}
