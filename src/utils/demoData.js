// src/utils/demoData.js
const VENDORS = ['Cisco', 'TP-Link', 'Netgear', 'D-Link', 'Asus', 'Linksys', 'Ubiquiti']
const SSID_PREFIXES = ['Home-', 'WiFi-', 'Network-', 'Guest-', 'Office-', 'IoT-']

function generateMAC() {
    return Array.from({ length: 6 }, () =>
        Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
    ).join(':').toUpperCase()
}

function generateSSID() {
    const prefix = SSID_PREFIXES[Math.floor(Math.random() * SSID_PREFIXES.length)]
    const suffix = Math.floor(Math.random() * 9999).toString().padStart(4, '0')
    return `${prefix}${suffix}`
}

function generateRSSI() {
    return -(Math.floor(Math.random() * 60) + 30) // -30 to -90
}

function generateChannel() {
    return Math.floor(Math.random() * 13) + 1 // 1-13
}

export function generateDemoData() {
    const apCount = 10 + Math.floor(Math.random() * 10) // 10-20 APs
    const aps = []

    for (let i = 0; i < apCount; i++) {
        const ap = {
            index: i,
            bssid: generateMAC(),
            essid: generateSSID(),
            rssi: generateRSSI(),
            channel: generateChannel(),
            isHidden: Math.random() < 0.1,
            isSelected: Math.random() < 0.2,
            lastSeen: new Date(),
            stations: []
        }

        // Add random stations (0-5 per AP)
        const stationCount = Math.floor(Math.random() * 6)
        for (let j = 0; j < stationCount; j++) {
            ap.stations.push({
                id: j,
                mac: generateMAC(),
                vendor: VENDORS[Math.floor(Math.random() * VENDORS.length)],
                lastSeen: new Date(Date.now() - Math.random() * 3600000) // Up to 1 hour ago
            })
        }

        aps.push(ap)
    }

    return aps
}

export function generateDemoTerminalOutput() {
    return [
        '<span class="text-blue-400">✓ Connected to serial port</span>',
        '<span class="text-green-400">> scanap</span>',
        '<span class="text-green-400">Starting AP scan. Stop with stopscan</span>',
        '<span class="text-green-400">Clearing APs...0</span>',
        ...generateDemoData().map(ap =>
            `<span class="text-green-400">RSSI: ${ap.rssi} Ch: ${ap.channel} BSSID: ${ap.bssid} ESSID: ${ap.essid}</span>`
        ),
        '<span class="text-green-400">> list -a</span>',
        ...generateDemoData().map(ap =>
            `<span class="text-green-400">[${ap.index}][CH:${ap.channel}] ${ap.essid}</span>`
        )
    ]
}

// ─── WiGLE CSV multi-variant fixtures ─────────────────────────────────────────
// Used to validate the wigleParser pipeline without hardware.

/** WigleWifi-1.2 with AuthMode */
export const DEMO_WIGLE_1_2 = `WigleWifi-1.2,appRelease=Kismet
MAC,SSID,AuthMode,FirstSeen,Channel,RSSI,CurrentLatitude,CurrentLongitude,AltitudeMeters,AccuracyMeters,Type
AA:BB:CC:DD:EE:01,HomeNetwork,[WPA2-PSK-CCMP][ESS],2024-01-01T10:00:00,6,-65,25.6850,-100.3161,320,10,WIFI
AA:BB:CC:DD:EE:02,OfficeGuest,[WPA-PSK-TKIP][ESS],2024-01-01T10:00:05,11,-72,25.6851,-100.3162,320,10,WIFI`

/** WigleWifi-1.4 with Capabilities (most common modern variant) */
export const DEMO_WIGLE_1_4_CAPABILITIES = `WigleWifi-1.4,appRelease=PwnterreyESP32Marauder
MAC,SSID,Capabilities,FirstSeen,Channel,RSSI,CurrentLatitude,CurrentLongitude,AltitudeMeters,AccuracyMeters,Type
BB:CC:DD:EE:FF:01,CafeWifi,[WPA2-PSK-CCMP+TKIP][ESS],2024-01-01T11:00:00,1,-58,25.6860,-100.3170,318,5,WIFI
BB:CC:DD:EE:FF:02,IoT_Devices,[WPA3-SAE-CCMP][ESS],2024-01-01T11:00:10,6,-80,25.6861,-100.3171,318,5,WIFI`

/** Extended variant with Frequency and LastSeen columns */
export const DEMO_WIGLE_EXTENDED = `WigleWifi-1.4,appRelease=WarPie
MAC,SSID,Capabilities,FirstSeen,LastSeen,Channel,Frequency,RSSI,CurrentLatitude,CurrentLongitude,AltitudeMeters,AccuracyMeters,Type
CC:DD:EE:FF:00:01,5GHz-Network,[WPA2-PSK-CCMP][ESS],2024-01-01T12:00:00,2024-01-01T12:05:00,36,5180,-55,25.6870,-100.3180,315,3,WIFI
CC:DD:EE:FF:00:02,DualBand-AP,[WPA2-PSK-CCMP][ESS],2024-01-01T12:00:05,2024-01-01T12:05:10,149,5745,-61,25.6871,-100.3181,315,3,WIFI`

/** BLE / Bluetooth variant (Type = BLE, BSSID alias for MAC) */
export const DEMO_WIGLE_BLE = `WigleWifi-1.4,appRelease=PwnterreyESP32Marauder
BSSID,SSID,Capabilities,FirstSeen,Channel,RSSI,CurrentLatitude,CurrentLongitude,AltitudeMeters,AccuracyMeters,Type
DD:EE:FF:00:11:01,,BLE,2024-01-01T13:00:00,0,-75,25.6880,-100.3190,310,8,BLE
DD:EE:FF:00:11:02,FitnessBand,[LE],2024-01-01T13:00:05,0,-82,25.6881,-100.3191,310,8,BLE`

/** Legacy format with netid/trilat/trilong */
export const DEMO_WIGLE_LEGACY = `WigleWifi-1.1,appRelease=OldTool
netid,ssid,wep,trilat,trilong,firsttime,channel,freenet,carrier
EE:FF:00:11:22:01,OldNetwork,WEP,25.6890,-100.3200,2020-06-15T08:00:00,6,FALSE,Telmex`

/**
 * Returns demo wardrive lines as they would arrive from the serial terminal,
 * wrapped in HTML spans like the real serial output.
 * @param {'1.2'|'1.4'|'extended'|'ble'|'legacy'} variant
 * @returns {string[]}
 */
export function generateDemoWardriveLinesForVariant(variant = '1.4') {
    const csvMap = {
        '1.2':      DEMO_WIGLE_1_2,
        '1.4':      DEMO_WIGLE_1_4_CAPABILITIES,
        'extended': DEMO_WIGLE_EXTENDED,
        'ble':      DEMO_WIGLE_BLE,
        'legacy':   DEMO_WIGLE_LEGACY,
    }
    const csv = csvMap[variant] || csvMap['1.4']
    return csv
        .split('\n')
        .filter(l => l.trim())
        .map(l => `<span class="text-green-400">${l}</span>`)
}