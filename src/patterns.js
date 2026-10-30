/**
 * Origins and origin patterns for auto-clear.
 *
 * A stored pattern matches one tab origin. It never expands into a list of
 * other origins. Wildcards cover a site and its subdomains only.
 */

const MAX_PATTERN_LENGTH = 200;

/**
 * @typedef {{ ok: true, pattern: string, scheme: string, host: string, port: string }} ParsedPattern
 * @typedef {{ ok: false, reason: string }} PatternError
 */

/**
 * @param {unknown} raw
 * @returns {ParsedPattern | PatternError}
 */
export function parseAutoClearInput(raw) {
  if (typeof raw !== "string") {
    return { ok: false, reason: "Enter an origin or pattern." };
  }

  const text = raw.trim();
  if (!text) {
    return { ok: false, reason: "Enter an origin or pattern." };
  }
  if (text.length > MAX_PATTERN_LENGTH) {
    return { ok: false, reason: "That pattern is too long." };
  }
  if (/\s/.test(text)) {
    return { ok: false, reason: "Enter an origin or pattern, without spaces." };
  }
  if (text === "<all_urls>" || text === "*://*/*" || text === "*://*" || text === "*") {
    return { ok: false, reason: "That would match every site. Enter one origin." };
  }

  const split = splitScheme(text);
  if (!split.ok) {
    return split;
  }

  let body = split.body;
  const cut = body.search(/[/?#]/);
  if (cut !== -1) {
    body = body.slice(0, cut);
  }
  const at = body.lastIndexOf("@");
  if (at !== -1) {
    body = body.slice(at + 1);
  }
  if (!body) {
    return { ok: false, reason: "Enter a host name." };
  }

  const hostPort = splitHostPort(body);
  if (!hostPort.ok) {
    return hostPort;
  }

  const host = normalizeHost(hostPort.host);
  if (!isValidHostPattern(host)) {
    return { ok: false, reason: "Enter a valid origin, like https://example.com." };
  }

  const port = canonicalPort(split.scheme, hostPort.port);
  if (!port.ok) {
    return port;
  }

  return {
    ok: true,
    pattern: formatPattern(split.scheme, displayHost(host), port.port),
    scheme: split.scheme,
    host,
    port: port.port,
  };
}

/**
 * @param {string} origin
 * @param {string} pattern
 * @returns {boolean}
 */
export function originMatches(origin, pattern) {
  const left = parseAutoClearInput(origin);
  const right = parseAutoClearInput(pattern);
  if (!left.ok || !right.ok) {
    return false;
  }
  if (left.scheme !== "http" && left.scheme !== "https") {
    return false;
  }
  if (right.scheme !== "*" && right.scheme !== left.scheme) {
    return false;
  }
  if (right.port !== left.port) {
    return false;
  }
  return hostMatches(left.host, right.host);
}

/**
 * @param {string} text
 * @returns {{ ok: true, scheme: string, body: string } | PatternError}
 */
function splitScheme(text) {
  const match = /^([a-zA-Z*]+):\/\/(.*)$/.exec(text);
  if (match) {
    const scheme = match[1].toLowerCase();
    if (scheme !== "http" && scheme !== "https" && scheme !== "*") {
      return { ok: false, reason: "Only http and https origins can be cleared." };
    }
    if (!match[2]) {
      return { ok: false, reason: "Enter a host name." };
    }
    return { ok: true, scheme, body: match[2] };
  }
  if (text.includes("://")) {
    return { ok: false, reason: "Only http and https origins can be cleared." };
  }
  return { ok: true, scheme: "*", body: text };
}

/**
 * @param {string} body
 * @returns {{ ok: true, host: string, port: string } | PatternError}
 */
function splitHostPort(body) {
  if (body.startsWith("[")) {
    const end = body.indexOf("]");
    if (end === -1) {
      return { ok: false, reason: "Enter a valid origin." };
    }
    const host = body.slice(1, end);
    const rest = body.slice(end + 1);
    if (!rest) {
      return { ok: true, host, port: "" };
    }
    if (!rest.startsWith(":") || rest.slice(1).includes("]")) {
      return { ok: false, reason: "Enter a valid origin." };
    }
    return { ok: true, host, port: rest.slice(1) };
  }

  const colon = body.lastIndexOf(":");
  if (colon === -1) {
    return { ok: true, host: body, port: "" };
  }
  return { ok: true, host: body.slice(0, colon), port: body.slice(colon + 1) };
}

/**
 * @param {string} scheme
 * @param {string} port
 * @returns {{ ok: true, port: string } | PatternError}
 */
function canonicalPort(scheme, port) {
  if (!port) {
    return { ok: true, port: "" };
  }
  if (!/^\d+$/.test(port) || port.length > 1 && port.startsWith("0")) {
    return { ok: false, reason: "Enter a valid port." };
  }
  const number = Number(port);
  if (!Number.isInteger(number) || number < 1 || number > 65535) {
    return { ok: false, reason: "Enter a valid port." };
  }
  if ((scheme === "https" && number === 443) || (scheme === "http" && number === 80)) {
    return { ok: true, port: "" };
  }
  return { ok: true, port: String(number) };
}

/**
 * Lowercase and punycode a host without interpreting a port.
 * @param {string} host
 * @returns {string}
 */
function normalizeHost(host) {
  const trimmed = host.toLowerCase().replace(/\.$/, "");
  if (!trimmed) {
    return trimmed;
  }
  if (trimmed.startsWith("*.")) {
    const suffix = trimmed.slice(2);
    try {
      return `*.${new URL(`http://${suffix}`).hostname}`;
    } catch {
      return trimmed;
    }
  }
  try {
    const wrapped = trimmed.includes(":") && !trimmed.startsWith("[") ? `[${trimmed}]` : trimmed;
    const hostname = new URL(`http://${wrapped}`).hostname;
    if (hostname.startsWith("[") && hostname.endsWith("]")) {
      return hostname.slice(1, -1);
    }
    return hostname;
  } catch {
    return trimmed;
  }
}

/**
 * @param {string} host
 * @returns {boolean}
 */
function isValidHostPattern(host) {
  if (!host || host.includes("*") && !host.startsWith("*.")) {
    return false;
  }
  if (host.startsWith("*.")) {
    const suffix = host.slice(2);
    if (suffix.includes("*") || !isHostname(suffix)) {
      return false;
    }
    if (!suffix.includes(".")) {
      return false;
    }
    // *.com and *.co.uk match far more than one site.
    if (/^[a-z0-9-]{1,3}\.[a-z]{2}$/.test(suffix)) {
      return false;
    }
    return true;
  }
  if (host.includes(":")) {
    return isIpv6(host);
  }
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    return isIpv4(host);
  }
  return isHostname(host);
}

/**
 * @param {string} host
 * @returns {boolean}
 */
function isHostname(host) {
  if (!host || host.length > 253 || host.startsWith(".") || host.endsWith(".")) {
    return false;
  }
  const labels = host.split(".");
  return labels.every((label) => /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(label) || /^[a-z0-9]$/.test(label));
}

/**
 * @param {string} host
 * @returns {boolean}
 */
function isIpv4(host) {
  const parts = host.split(".");
  if (parts.length !== 4) {
    return false;
  }
  return parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255 && !(part.length > 1 && part.startsWith("0")));
}

/**
 * @param {string} host
 * @returns {boolean}
 */
function isIpv6(host) {
  if (!host.includes(":") || host.includes("*")) {
    return false;
  }
  return /^[0-9a-f:]+$/.test(host);
}

/**
 * @param {string} host
 * @param {string} patternHost
 * @returns {boolean}
 */
function hostMatches(host, patternHost) {
  if (!patternHost.startsWith("*.")) {
    return host === patternHost;
  }
  const suffix = patternHost.slice(2);
  return host === suffix || host.endsWith(`.${suffix}`);
}

/**
 * @param {string} scheme
 * @param {string} host
 * @param {string} port
 * @returns {string}
 */
function formatPattern(scheme, host, port) {
  return `${scheme}://${host}${port ? `:${port}` : ""}`;
}

/**
 * @param {string} host
 * @returns {string}
 */
function displayHost(host) {
  return host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
}
