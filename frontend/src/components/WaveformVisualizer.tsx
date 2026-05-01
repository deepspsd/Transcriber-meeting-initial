import { useEffect, useRef } from 'react'

interface Props {
  analyser: AnalyserNode | null
  isActive: boolean
}

export default function WaveformVisualizer({ analyser, isActive }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    if (!analyser || !isActive) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      // Draw flat line when idle
      ctx.strokeStyle = 'rgba(124,92,252,0.3)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(0, canvas.height / 2)
      ctx.lineTo(canvas.width, canvas.height / 2)
      ctx.stroke()
      return
    }

    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw)
      analyser.getByteTimeDomainData(dataArray)

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0)
      gradient.addColorStop(0, '#7c5cfc')
      gradient.addColorStop(0.5, '#4fd1c5')
      gradient.addColorStop(1, '#7c5cfc')

      ctx.lineWidth = 2
      ctx.strokeStyle = gradient
      ctx.beginPath()

      const sliceWidth = canvas.width / bufferLength
      let x = 0
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0
        const y = (v * canvas.height) / 2
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
        x += sliceWidth
      }
      ctx.lineTo(canvas.width, canvas.height / 2)
      ctx.stroke()
    }

    draw()
    return () => cancelAnimationFrame(rafRef.current)
  }, [analyser, isActive])

  return (
    <canvas
      ref={canvasRef}
      className="waveform"
      width={600}
      height={64}
    />
  )
}
