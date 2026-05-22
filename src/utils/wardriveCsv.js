import { splitCsvLine } from './wigleParser'

export const DEFAULT_WIGLE_HEADER = 'WigleWifi-1.4,appRelease=PwnterreyESP32Marauder'
export const DEFAULT_COLUMN_HEADER =
  'MAC,SSID,AuthMode,FirstSeen,Channel,RSSI,CurrentLatitude,CurrentLongitude,AltitudeMeters,AccuracyMeters,Type'

// Canonical-field → legacy entry key mapping (for the default-export path)
const CANONICAL_TO_ENTRY = {
  MAC:              e => e.mac,
  SSID:             e => e.ssid,
  AuthMode:         e => e.auth,
  Capabilities:     e => e.auth,
  FirstSeen:        e => e.firstSeen,
  LastSeen:         e => e._canonical?.last_seen ?? '',
  Channel:          e => e.channel,
  Frequency:        e => e._canonical?.frequency ?? '',
  RSSI:             e => e.rssi,
  CurrentLatitude:  e => e.lat,
  Latitude:         e => e.lat,
  CurrentLongitude: e => e.lon,
  Longitude:        e => e.lon,
  AltitudeMeters:   e => e.alt,
  Altitude:         e => e.alt,
  AccuracyMeters:   e => e.accuracy,
  Accuracy:         e => e.accuracy,
  Type:             e => e.type,
  // Marauder fork aliases
  BSSID:            e => e.mac,
  Encryption:       e => e.auth,
  AuthType:         e => e.auth,
}

/**
 * RFC4180 minimal escape: wrap in double quotes if value contains comma or quote.
 * @param {string} val
 * @returns {string}
 */
function escapeField(val) {
  const s = val == null ? '' : String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

/**
 * Build a CSV string from canonical entries.
 *
 * If csvColumnHeader is provided (captured from the live stream or a file):
 *   - Uses those exact columns, in that exact order.
 *   - For each column, resolves value via raw dict (fidelity) → CANONICAL_TO_ENTRY → empty.
 *
 * Otherwise falls back to the default 1.4 schema.
 *
 * @param {Array} entries         Entries as stored in WardrivePanel (with _canonical attached)
 * @param {string} [csvHeader]
 * @param {string} [csvColumnHeader]
 * @returns {string}
 */
export function buildWardriveCsvString(entries, csvHeader, csvColumnHeader) {
  const header = csvHeader || DEFAULT_WIGLE_HEADER
  const columns = csvColumnHeader || DEFAULT_COLUMN_HEADER

  const colNames = splitCsvLine(columns).map(c => c.trim())

  const rows = entries.map(e => {
    return colNames.map(col => {
      // Prefer value from raw dict (exact fidelity for the original format)
      const rawVal = e._canonical?.raw?.[col]
      if (rawVal !== undefined && rawVal !== null) {
        return escapeField(rawVal)
      }
      // Fallback: derive from canonical entry fields
      const resolver = CANONICAL_TO_ENTRY[col]
      return escapeField(resolver ? resolver(e) : '')
    }).join(',')
  })

  return [header, columns, ...rows].join('\n')
}

export function buildWardriveCsvBlob(entries, csvHeader, csvColumnHeader) {
  const csv = buildWardriveCsvString(entries, csvHeader, csvColumnHeader)
  return new Blob([csv], { type: 'text/csv' })
}

export function wardriveCsvFileName() {
  return `wardrive_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`
}

export function buildWardriveCsvFile(entries, csvHeader, csvColumnHeader) {
  const blob = buildWardriveCsvBlob(entries, csvHeader, csvColumnHeader)
  return new File([blob], wardriveCsvFileName(), { type: 'text/csv' })
}
