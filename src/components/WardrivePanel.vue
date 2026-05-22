<template>
  <div class="h-full flex flex-col gap-4">
    <!-- Controls -->
    <div class="flex flex-wrap items-center gap-2">
      <button @click="startWardrive('wardrive -serial')" class="btn btn-primary">WiFi Wardrive</button>
      <button @click="sendCommand('stopscan')" class="btn btn-danger">Stop</button>
      <div class="flex-1"></div>
      <span class="text-sm text-zinc-500 font-mono">{{ entries.length }} networks mapped</span>
      <span v-if="sourceFormat" class="text-xs font-mono px-1.5 py-0.5 bg-zinc-800 text-zinc-500 rounded">
        {{ sourceFormat }} {{ sourceVersion !== 'unknown' ? sourceVersion : '' }}
      </span>
      
      <button @click="exportCsv" :disabled="entries.length === 0"
        class="btn btn-accent" :class="{ 'opacity-50 cursor-not-allowed': entries.length === 0 }">
        Export CSV
      </button>

      <button
        @click="uploadToPlatform"
        :disabled="uploadDisabled"
        class="btn btn-primary"
        :class="{ 'opacity-50 cursor-not-allowed': uploadDisabled }"
        :title="uploadDisabledReason"
      >
        {{ uploadLoading ? 'Uploading…' : 'Upload to platform' }}
      </button>

      <button @click="clearData" class="btn">Clear</button>
    </div>
    <p v-if="uploadMessage" class="text-sm mb-2 font-mono" :class="uploadMessageClass">
      {{ uploadMessage }}
    </p>

    <!-- Map View -->
    <div class="h-1/2 min-h-[300px]">
      <GpsMap 
        :coords="latestCoords" 
        :points="mapPoints"
        :showPath="true"
      />
    </div>

    <!-- Table -->
    <div class="flex-1 min-h-0 overflow-auto border border-zinc-800 rounded bg-zinc-950/50">
      <table class="w-full text-sm">
        <thead class="bg-zinc-900 sticky top-0 z-10">
          <tr>
            <th class="px-2 py-2 text-left border-b border-zinc-800 font-bold w-10 md:w-12 text-zinc-400">#</th>
            <th class="px-2 py-2 text-left border-b border-zinc-800 font-bold text-zinc-400">MAC</th>
            <th class="px-2 py-2 text-left border-b border-zinc-800 font-bold text-zinc-400">SSID/Name</th>
            <th class="hidden md:table-cell px-2 py-2 text-left border-b border-zinc-800 font-bold text-zinc-400">Auth</th>
            <th class="px-2 py-2 text-left border-b border-zinc-800 font-bold w-10 md:w-12 text-zinc-400">Ch</th>
            <th class="px-2 py-2 text-left border-b border-zinc-800 font-bold w-12 md:w-16 text-zinc-400">RSSI</th>
            <th class="hidden sm:table-cell px-2 py-2 text-left border-b border-zinc-800 font-bold text-zinc-400">Lat</th>
            <th class="hidden sm:table-cell px-2 py-2 text-left border-b border-zinc-800 font-bold text-zinc-400">Lon</th>
            <th class="hidden lg:table-cell px-2 py-2 text-left border-b border-zinc-800 font-bold w-16 text-zinc-400">Type</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="entries.length === 0">
            <td colspan="9" class="px-4 py-8 text-center text-zinc-600">
              No wardrive data yet. Press "WiFi Wardrive" to start.
            </td>
          </tr>
          <tr v-for="(e, i) in entries" :key="i"
            class="hover:bg-zinc-800/50 border-b border-zinc-900">
            <td class="px-2 py-1 font-mono text-zinc-500 text-[10px] md:text-xs">{{ i + 1 }}</td>
            <td class="px-2 py-1 font-mono text-zinc-400 text-[10px] md:text-xs">{{ e.mac }}</td>
            <td class="px-2 py-1 font-medium text-zinc-200 text-xs">{{ e.ssid || '-' }}</td>
            <td class="hidden md:table-cell px-2 py-1 text-zinc-400 text-[10px]">{{ e.auth }}</td>
            <td class="px-2 py-1 font-mono text-zinc-400 text-[10px] md:text-xs">{{ e.channel }}</td>
            <td class="px-2 py-1 font-mono text-emerald-500 text-[10px] md:text-xs">{{ e.rssi }}</td>
            <td class="hidden sm:table-cell px-2 py-1 font-mono text-zinc-400 text-[10px]">{{ e.lat }}</td>
            <td class="hidden sm:table-cell px-2 py-1 font-mono text-zinc-400 text-[10px]">{{ e.lon }}</td>
            <td class="hidden lg:table-cell px-2 py-1 text-[10px]" :class="e.type === 'WIFI' ? 'text-cyan-400' : 'text-violet-400'">
              {{ e.type }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { useSerialConnection } from '../utils/serialConnection'
import { useAuth } from '../composables/useAuth'
import { buildWardriveCsvBlob, wardriveCsvFileName, buildWardriveCsvFile } from '../utils/wardriveCsv'
import { uploadWardriveFiles } from '../utils/platformUpload'
import { detectMetaLine, detectColumnHeader, createParser } from '../utils/wigleParser'
import GpsMap from './GpsMap.vue'

const { sendCommand, terminalOutput } = useSerialConnection()
const { getToken, isAuthenticated } = useAuth()

const entries = ref([])
const csvHeader = ref('')
const csvColumnHeader = ref('')
const lastProcessedIndex = ref(0)
const syncLoading = ref(false)

// Parser state machine
const sourceFormat = ref('')
const sourceVersion = ref('')
const activeParser = ref(null)

const latestCoords = computed(() => {
  if (entries.value.length === 0) return { lat: null, lon: null }
  const last = entries.value[entries.value.length - 1]
  return { lat: parseFloat(last.lat), lon: parseFloat(last.lon) }
})

const mapPoints = computed(() => {
  return entries.value.map(e => ({
    lat: parseFloat(e.lat),
    lon: parseFloat(e.lon),
    label: `${e.ssid || e.mac} (CH${e.channel}, ${e.rssi}dBm)`,
    type: e.type
  }))
})

const uploadLoading = ref(false)
const uploadMessage = ref('')
const uploadOk = ref(false)

const uploadEnvOk = computed(
  () => Boolean(import.meta.env.VITE_UPLOAD_URL && import.meta.env.VITE_DEVICE_SOURCE)
)

const uploadDisabled = computed(() => {
  if (entries.value.length === 0 || uploadLoading.value) return true
  if (!uploadEnvOk.value) return true
  if (!isAuthenticated.value) return true
  return false
})

const uploadDisabledReason = computed(() => {
  if (entries.value.length === 0) return 'No wardrive rows to upload'
  if (!uploadEnvOk.value) return 'Set VITE_UPLOAD_URL and VITE_DEVICE_SOURCE in .env'
  if (!isAuthenticated.value) return 'Sign in via Platform in the header'
  return ''
})

const uploadMessageClass = computed(() => {
  if (uploadOk.value) return 'text-emerald-400'
  return 'text-red-400'
})

const startWardrive = async (command) => {
  await sendCommand(command)
}

const clearData = () => {
  entries.value = []
  csvHeader.value = ''
  csvColumnHeader.value = ''
  uploadMessage.value = ''
  sourceFormat.value = ''
  sourceVersion.value = ''
  activeParser.value = null
}

watch(() => terminalOutput.value, (newLines) => {
  if (newLines.length <= lastProcessedIndex.value) {
    if (newLines.length < lastProcessedIndex.value) lastProcessedIndex.value = 0
    return
  }

  const linesToProcess = newLines.slice(lastProcessedIndex.value)
  lastProcessedIndex.value = newLines.length

  linesToProcess.forEach(line => {
    const plain = line.replace(/<[^>]+>/g, '').trim()
    if (!plain) return

    // State 1 — detect metadata line (any WiGLE version)
    const meta = detectMetaLine(plain)
    if (meta) {
      csvHeader.value = plain
      sourceFormat.value = meta.format
      sourceVersion.value = meta.version
      return
    }

    // State 2 — detect column header line, build parser
    const colResult = detectColumnHeader(plain)
    if (colResult) {
      csvColumnHeader.value = plain
      activeParser.value = createParser(colResult)
      return
    }

    // State 3 — parse data rows
    if (!activeParser.value) return
    const canonical = activeParser.value(plain)
    if (!canonical) return

    entries.value = [...entries.value, {
      mac:       canonical.mac,
      ssid:      canonical.ssid,
      auth:      canonical.security,
      firstSeen: canonical.first_seen,
      channel:   canonical.channel,
      rssi:      canonical.rssi,
      lat:       canonical.latitude,
      lon:       canonical.longitude,
      alt:       canonical.altitude,
      accuracy:  canonical.accuracy,
      type:      canonical.type,
      _canonical: canonical,
    }]
  })
}, { deep: true })

const exportCsv = () => {
  if (entries.value.length === 0) return

  const blob = buildWardriveCsvBlob(entries.value, csvHeader.value, csvColumnHeader.value)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = wardriveCsvFileName()
  a.click()
  URL.revokeObjectURL(url)
}

const uploadToPlatform = async () => {
  if (uploadDisabled.value) return

  uploadMessage.value = ''
  uploadOk.value = false
  uploadLoading.value = true

  try {
    const file = buildWardriveCsvFile(entries.value, csvHeader.value, csvColumnHeader.value)
    const token = getToken()
    await uploadWardriveFiles([file], token)
    uploadOk.value = true
    uploadMessage.value = 'Upload completed successfully.'
  } catch (e) {
    uploadOk.value = false
    uploadMessage.value = e?.message || 'Upload failed'
  } finally {
    uploadLoading.value = false
  }
}
</script>

