// Simple in-process WebSocket emitter

type Payload = Record<string, string>

const clients = new Set<(payload: Payload) => void>()

export function registerWsClient(fn: (payload: Payload) => void) {
  clients.add(fn)
  return () => clients.delete(fn)
}

function broadcast(payload: Payload) {
  for (const fn of clients) {
    try { fn(payload) } catch {}
  }
}

export function emitCardStatus(cardId: string, status: string) {
  broadcast({ type: 'card:status', cardId, status })
}

export function emitCampaignStatus(campaignId: string, status: string) {
  broadcast({ type: 'campaign:status', campaignId, status })
}
