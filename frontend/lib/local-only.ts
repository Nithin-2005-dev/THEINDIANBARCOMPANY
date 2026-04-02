const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"])

function stripPort(host: string) {
  if (host.startsWith("[")) {
    const closingBracketIndex = host.indexOf("]")
    return closingBracketIndex >= 0 ? host.slice(1, closingBracketIndex) : host
  }

  return host.split(":")[0] ?? host
}

export function isLocalHost(host: string | null | undefined) {
  if (!host) {
    return false
  }

  return LOCAL_HOSTS.has(stripPort(host.trim().toLowerCase()))
}
