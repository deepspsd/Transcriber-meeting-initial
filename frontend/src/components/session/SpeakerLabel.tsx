import { useState } from 'react'
import { Edit2, Check, X } from 'lucide-react'

interface SpeakerLabelProps {
  speaker: string
  color: string
  onRename?: (oldName: string, newName: string) => void
  editable?: boolean
}

export default function SpeakerLabel({ speaker, color, onRename, editable = false }: SpeakerLabelProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [newName, setNewName] = useState(speaker)

  const handleSave = () => {
    if (newName.trim() && newName !== speaker && onRename) {
      onRename(speaker, newName.trim())
    }
    setIsEditing(false)
  }

  const handleCancel = () => {
    setNewName(speaker)
    setIsEditing(false)
  }

  if (!editable) {
    return (
      <span className={`badge badge-${color}`} style={{ fontSize: '0.75rem', fontWeight: 700 }}>
        {speaker}
      </span>
    )
  }

  if (isEditing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave()
            if (e.key === 'Escape') handleCancel()
          }}
          autoFocus
          style={{
            padding: '4px 8px',
            fontSize: '0.75rem',
            fontWeight: 700,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--accent)',
            borderRadius: '6px',
            color: 'var(--text-primary)',
            outline: 'none',
            width: '120px',
          }}
        />
        <button onClick={handleSave} className="icon-btn" style={{ width: '24px', height: '24px' }}>
          <Check size={14} style={{ color: 'var(--success)' }} />
        </button>
        <button onClick={handleCancel} className="icon-btn" style={{ width: '24px', height: '24px' }}>
          <X size={14} style={{ color: 'var(--danger)' }} />
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setIsEditing(true)}
      className={`badge badge-${color}`}
      style={{
        fontSize: '0.75rem',
        fontWeight: 700,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        border: 'none',
      }}
    >
      {speaker}
      <Edit2 size={11} style={{ opacity: 0.6 }} />
    </button>
  )
}
