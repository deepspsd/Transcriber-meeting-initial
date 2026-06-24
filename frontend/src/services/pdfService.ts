
import { useAuthStore } from '../store/auth'

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

/**
 * Calls the backend PDF endpoint, receives the file as a blob,
 * and triggers a browser download.
 *
 * @param recordingId  MongoDB recording _id
 * @param filename     Display name for the downloaded file (optional)
 * @throws Error with message on failure
 */
export async function downloadPdfReport(
  recordingId: string,
  filename?: string,
): Promise<void> {
  // Read from in-memory store (never localStorage)
  const token = useAuthStore.getState().accessToken

  const response = await fetch(`${API_BASE}/pdf/${recordingId}`, {
    method: 'POST',
    credentials: 'include',  // send HttpOnly cookie
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
    },
  })

  if (!response.ok) {
    let detail = `Server error ${response.status}`
    try {
      const json = await response.json()
      detail = json.detail || detail
    } catch {
      // non-JSON error body
    }
    throw new Error(detail)
  }

  // Get the PDF blob from the response
  const blob = await response.blob()

  // Build a safe filename
  const rawName = filename?.replace(/\.(wav|mp3|webm|mp4|m4a|ogg|flac)$/i, '') ?? 'meeting'
  const safeName = rawName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 60) || 'meeting'
  const downloadName = `VoiceSum_Report_${safeName}.pdf`

  // Attempt to get filename from Content-Disposition header
  const disposition = response.headers.get('Content-Disposition')
  const serverFilename = disposition?.match(/filename="([^"]+)"/)?.[1]

  // Trigger browser download
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = serverFilename || downloadName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
