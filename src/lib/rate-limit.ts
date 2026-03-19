const windowMs = 60_000;
const maxSessionCreates = 5;
const maxMessagesPerSession = 30;

const sessionCreateMap = new Map<string, { count: number; resetAt: number }>();
const messageMap = new Map<string, { count: number; resetAt: number }>();

function cleanup(map: Map<string, { count: number; resetAt: number }>) {
  const now = Date.now();
  for (const [key, val] of map) {
    if (val.resetAt < now) map.delete(key);
  }
}

function check(
  map: Map<string, { count: number; resetAt: number }>,
  key: string,
  limit: number
): boolean {
  if (map.size > 10_000) cleanup(map);

  const now = Date.now();
  const entry = map.get(key);

  if (!entry || entry.resetAt < now) {
    map.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

export function checkSessionCreateLimit(ip: string): boolean {
  return check(sessionCreateMap, ip, maxSessionCreates);
}

export function checkMessageLimit(sessionId: string): boolean {
  return check(messageMap, sessionId, maxMessagesPerSession);
}
