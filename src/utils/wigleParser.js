/**
 * WiGLE CSV Version Abstraction — wigleParser.js
 *
 * Implements a capability-based (NOT version-based) pipeline:
 *   Raw line → detectMetaLine → detectColumnHeader → createParser → canonical entry
 *
 * Supported variants:
 *   Legacy, WigleWifi-1.1, 1.2, 1.3, 1.4, Extended (Frequency/LastSeen), BLE/BT, Marauder forks
 */

// ─── Alias table ──────────────────────────────────────────────────────────────
// Maps every known column header spelling to a canonical field name.
// Capability-detection: add a column alias here without touching any other logic.

export const ALIASES = {
  mac:        ['MAC', 'BSSID', 'netid'],
  ssid:       ['SSID', 'ssid'],
  security:   ['Capabilities', 'AuthMode', 'Encryption', 'AuthType', 'wep'],
  first_seen: ['FirstSeen', 'firsttime'],
  last_seen:  ['LastSeen', 'lasttime'],
  channel:    ['Channel', 'channel'],
  frequency:  ['Frequency', 'freq'],
  rssi:       ['RSSI'],
  latitude:   ['CurrentLatitude', 'Latitude', 'trilat'],
  longitude:  ['CurrentLongitude', 'Longitude', 'trilong'],
  altitude:   ['AltitudeMeters', 'Altitude'],
  accuracy:   ['AccuracyMeters', 'Accuracy'],
  type:       ['Type'],
}

// Reverse lookup: columnHeader → canonicalKey
const REVERSE_ALIAS = {}
for (const [canonical, variants] of Object.entries(ALIASES)) {
  for (const v of variants) {
    REVERSE_ALIAS[v] = canonical
  }
}

// ─── Known format strings for reference ───────────────────────────────────────
export const KNOWN_FORMATS = [
  'WigleWifi-1.1',
  'WigleWifi-1.2',
  'WigleWifi-1.3',
  'WigleWifi-1.4',
  'WigleWifi',   // version-less emitters
  'Legacy',
]

// ─── MAC validation ───────────────────────────────────────────────────────────
const MAC_RE = /^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/

// ─── Mini RFC4180-tolerant CSV splitter ───────────────────────────────────────
// Handles quoted fields (e.g. SSID with embedded comma).
// Does NOT require a full CSV library; inline to keep bundle small.
export function splitCsvLine(line) {
  const fields = []
  let cur = ''
  let inQuote = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuote) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuote = false
        }
      } else {
        cur += ch
      }
    } else {
      if (ch === '"') {
        inQuote = true
      } else if (ch === ',') {
        fields.push(cur)
        cur = ''
      } else {
        cur += ch
      }
    }
  }
  fields.push(cur)
  return fields
}

// ─── detectMetaLine ───────────────────────────────────────────────────────────
/**
 * Detects the WiGLE metadata line (first line of the file/stream).
 *
 * Examples:
 *   "WigleWifi-1.4,appRelease=2.62"
 *   "WigleWifi-1.4,appRelease=PwnterreyESP32Marauder"
 *   "WigleWifi-1.2,appRelease=Kismet"
 *   "WigleWifi,appRelease=..."    (version-less)
 *
 * @param {string} line
 * @returns {{ format: string, version: string, appRelease: string, raw: string } | null}
 */
export function detectMetaLine(line) {
  const trimmed = line.trim()
  const match = trimmed.match(/^(Wigle(?:Wifi)?-?(\d+\.\d+)?)/i)
  if (!match) return null

  const full = match[1]
  const version = match[2] || 'unknown'

  let appRelease = ''
  const releaseMatch = trimmed.match(/appRelease=([^,\s]+)/i)
  if (releaseMatch) appRelease = releaseMatch[1]

  let format = full
  // Normalize casing to "WigleWifi-X.Y"
  const normMatch = trimmed.match(/^Wigle(?:Wifi)?-(\d+\.\d+)/i)
  if (normMatch) {
    format = `WigleWifi-${normMatch[1]}`
  } else if (/^Wigle/i.test(trimmed)) {
    format = 'WigleWifi'
  }

  return { format, version, appRelease, raw: trimmed }
}

// ─── detectLegacyMetaLine ──────────────────────────────────────────────────────
/**
 * Detects the legacy format by inspecting a header line for legacy field names.
 * Returns a pseudo-meta object if this looks like a legacy file.
 *
 * @param {string} line
 * @returns {{ format: string, version: string, appRelease: string, raw: string } | null}
 */
export function detectLegacyMetaLine(line) {
  const trimmed = line.trim()
  if (/\bnetid\b/i.test(trimmed) || /\btrilat\b/i.test(trimmed)) {
    return { format: 'Legacy', version: 'legacy', appRelease: '', raw: trimmed }
  }
  return null
}

// ─── detectColumnHeader ───────────────────────────────────────────────────────
/**
 * Checks whether `line` is a WiGLE column header row.
 *
 * Recognition heuristic: line must contain at least 2 known canonical aliases
 * from two different canonical groups.
 *
 * @param {string} line
 * @returns {{ headers: string[], aliasMap: Record<string, string> } | null}
 *          aliasMap: { columnHeader → canonicalKey }
 */
export function detectColumnHeader(line) {
  const trimmed = line.trim()
  const fields = splitCsvLine(trimmed)
  if (fields.length < 2) return null

  const aliasMap = {}
  let knownCount = 0

  for (const field of fields) {
    const canon = REVERSE_ALIAS[field.trim()]
    if (canon) {
      aliasMap[field.trim()] = canon
      knownCount++
    }
  }

  // Require at least 2 recognized columns to confidently call it a header
  if (knownCount < 2) return null

  return { headers: fields.map(f => f.trim()), aliasMap }
}

// ─── inferType ────────────────────────────────────────────────────────────────
/**
 * Infers device type from the parsed row.
 * Priority: explicit Type field > channel-0 BLE heuristic > WIFI default.
 *
 * @param {Record<string, string>} raw   header→value dict
 * @param {string[]}               headers
 * @returns {'WIFI'|'BLE'|'BT'}
 */
function inferType(raw, headers) {
  const typeVal = (raw['Type'] || '').trim().toUpperCase()
  if (typeVal === 'BLE' || typeVal === 'BT') return typeVal
  if (typeVal === 'WIFI') return 'WIFI'

  // Marauder BLE heuristic: no SSID + channel == 0
  const ch = raw['Channel'] || raw['channel'] || ''
  if (!raw['SSID'] && (ch === '0' || ch === '')) return 'BLE'

  return 'WIFI'
}

// ─── createParser ─────────────────────────────────────────────────────────────
/**
 * Factory: given a resolved column header list, returns a row-parsing function.
 *
 * @param {{ headers: string[], aliasMap: Record<string, string> }} descriptor
 * @returns {(rawLine: string) => import('./wigleParser').CanonicalEntry | null}
 */
export function createParser({ headers, aliasMap }) {
  /**
   * @param {string} rawLine
   * @returns {CanonicalEntry | null}
   */
  return function parseRow(rawLine) {
    const trimmed = rawLine.trim()
    if (!trimmed) return null

    const values = splitCsvLine(trimmed)

    // Build raw dict: header → value
    const raw = {}
    for (let i = 0; i < headers.length; i++) {
      raw[headers[i]] = (values[i] ?? '').trim()
    }

    // Resolve mac via aliasMap
    const macCol = headers.find(h => aliasMap[h] === 'mac')
    const mac = macCol ? (raw[macCol] || '') : ''
    if (!MAC_RE.test(mac)) return null

    // Helper: get first alias value for a canonical key
    const get = (canonKey) => {
      const col = headers.find(h => aliasMap[h] === canonKey)
      return col ? (raw[col] || '') : ''
    }

    const type = inferType(raw, headers)

    return {
      mac,
      ssid:        get('ssid'),
      security:    get('security'),
      first_seen:  get('first_seen'),
      last_seen:   get('last_seen'),
      channel:     get('channel') || '-',
      frequency:   get('frequency') || null,
      rssi:        get('rssi'),
      latitude:    get('latitude'),
      longitude:   get('longitude'),
      altitude:    get('altitude'),
      accuracy:    get('accuracy'),
      type,
      raw,
    }
  }
}

/**
 * @typedef {{
 *   mac: string,
 *   ssid: string,
 *   security: string,
 *   first_seen: string,
 *   last_seen: string,
 *   channel: string,
 *   frequency: string|null,
 *   rssi: string,
 *   latitude: string,
 *   longitude: string,
 *   altitude: string,
 *   accuracy: string,
 *   type: 'WIFI'|'BLE'|'BT',
 *   raw: Record<string,string>
 * }} CanonicalEntry
 */
