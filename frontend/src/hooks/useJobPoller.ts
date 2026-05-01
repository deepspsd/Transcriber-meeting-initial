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
      setData(res.data)
      if (res.data.status === 'done') {
        clearInterval(intervalRef.current!)
        onDone?.(res.data.result)
      } else if (res.data.status === 'error') {
        clearInterval(intervalRef.current!)
      }
    } catch {
      // silent retry
    }
  }, [recordingId, onDone])

  useEffect(() => {
    if (!recordingId) return
    poll()
    intervalRef.current = setInterval(poll, 2500)
    return () => clearInterval(intervalRef.current!)
  }, [recordingId, poll])

  return data
}
