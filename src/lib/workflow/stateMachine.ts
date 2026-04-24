// Document lifecycle state machine.
// Fleshed out in Phase 3 when approval routing lands.

import type { documentStatus } from '@/lib/db/schema'

type Status = (typeof documentStatus.enumValues)[number]

const allowedTransitions: Record<Status, Status[]> = {
  draft: ['in_review'],
  in_review: ['approved', 'returned'],
  approved: ['archived'],
  returned: ['draft'],
  archived: [],
}

export function canTransition(from: Status, to: Status): boolean {
  return allowedTransitions[from]?.includes(to) ?? false
}
