import { useState, useEffect, useRef, useCallback } from 'react'
import api from '../api/client'

type JobStatus = 'pending' | 'processing' | 'done' | 'error'

interface PollResult {
  status: JobStatus
  progress?: string
  result?: any
  error?: string
}

export function useJobPoller(recordingId: string | null, onDone?: (result: any) => void) {
  const [data, setData] = useState<PollResult | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const poll = useCallback(async () => {
    if (!recordingId) return
    try {
      const res = await api.get(`/audio/jobs/${recordingId}`)
      console.log('[JobPoller] Status:', res.data.status, 'Progress:', res.data.progress)
      setData(res.data)
      if (res.data.status === 'done') {
        console.log('[JobPoller] Job complete! Calling onDone with result')
        clearInterval(intervalRef.current!)
        onDone?.(res.data.result)
      } else if (res.data.status === 'error') {
        console.error('[JobPoller] Job error:', res.data.error)
        clearInterval(intervalRef.current!)
      }
    } catch (err) {
      console.warn('[JobPoller] Poll request failed:', err)
      // silent retry
    }
  }, [recordingId, onDone])

  useEffect(() => {
    if (!recordingId) {
      console.log('[JobPoller] No recordingId, stopping polling')
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }
    console.log('[JobPoller] Starting polling for:', recordingId)
    poll()
    intervalRef.current = setInterval(poll, 2500)
    return () => {
      console.log('[JobPoller] Cleanup - stopping polling')
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [recordingId, poll])

  return data
}
