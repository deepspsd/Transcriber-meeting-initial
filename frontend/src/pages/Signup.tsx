import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, User, Zap, Loader, Sparkles } from 'lucide-react'
import api from '../api/client'
import { useAuthStore } from '../store/auth'

export default function Signup() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    setError('')
    setLoading(true)
    try {
      const res = await api.post('/auth/register', { name, email, password })
      setAuth(res.data.user, res.data.access_token)
      navigate('/setup')
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Registration failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-bg">
      <div className="auth-card animate-bounce-in">
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: '10px', 
            marginBottom: '0.75rem',
            position: 'relative'
          }}>
            <div style={{ position: 'relative' }}>
              <Zap 
                size={28} 
                style={{ color: 'hsl(var(--accent))', position: 'relative', zIndex: 1 }} 
                fill="currentColor" 
                className="animate-float"
              />
              <Sparkles 
                size={14} 
                style={{ 
                  position: 'absolute', 
                  top: -4, 
                  right: -4, 
                  color: 'hsl(var(--accent))',
                  animation: 'pulse-rec 2s ease-in-out infinite'
                }} 
              />
            </div>
            <span style={{ 
              fontSize: '1.8rem', 
              fontWeight: 800, 
              letterSpacing: '-0.03em',
              fontFamily: 'Caveat, cursive'
            }}>
              Voice<span style={{ color: 'hsl(var(--accent))' }}>Sum</span>
            </span>
          </div>
          <h1 style={{ 
            fontSize: '1.15rem', 
            fontWeight: 600, 
            color: 'hsl(var(--pencil))',
            fontFamily: 'Inter, sans-serif'
          }}>
            Create your account
          </h1>
          <p style={{
            fontSize: '.85rem',
            color: 'hsl(var(--pencil))',
            marginTop: '.25rem',
            fontFamily: 'Inter, sans-serif'
          }}>
            Start transcribing conversations with AI
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="animate-slide-up" style={{ animationDelay: '0.1s', animationFillMode: 'both' }}>
            <label className="label">Full Name</label>
            <div style={{ position: 'relative' }}>
              <User size={16} style={{ 
                position: 'absolute', 
                left: '14px', 
                top: '50%', 
                transform: 'translateY(-50%)', 
                color: 'hsl(var(--pencil))',
                zIndex: 1
              }} />
              <input 
                id="signup-name" 
                className="input" 
                type="text" 
                placeholder="John Doe" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                required 
                style={{ paddingLeft: '2.5rem' }} 
              />
            </div>
          </div>

          <div className="animate-slide-up" style={{ animationDelay: '0.15s', animationFillMode: 'both' }}>
            <label className="label">Email</label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ 
                position: 'absolute', 
                left: '14px', 
                top: '50%', 
                transform: 'translateY(-50%)', 
                color: 'hsl(var(--pencil))',
                zIndex: 1
              }} />
              <input 
                id="signup-email" 
                className="input" 
                type="email" 
                placeholder="you@example.com" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
                style={{ paddingLeft: '2.5rem' }} 
              />
            </div>
          </div>

          <div className="animate-slide-up" style={{ animationDelay: '0.2s', animationFillMode: 'both' }}>
            <label className="label">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ 
                position: 'absolute', 
                left: '14px', 
                top: '50%', 
                transform: 'translateY(-50%)', 
                color: 'hsl(var(--pencil))',
                zIndex: 1
              }} />
              <input 
                id="signup-password" 
                className="input" 
                type="password" 
                placeholder="Min. 6 characters" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                required 
                style={{ paddingLeft: '2.5rem' }} 
              />
            </div>
          </div>

          {error && (
            <div className="animate-shake" style={{ 
              background: 'hsl(var(--destructive) / 0.1)', 
              border: '2px solid hsl(var(--destructive) / 0.4)', 
              borderRadius: '10px 14px 12px 16px / 14px 12px 16px 10px', 
              padding: '0.75rem 1rem', 
              color: 'hsl(var(--destructive))', 
              fontSize: '0.85rem',
              fontFamily: 'Inter, sans-serif',
              fontWeight: 500
            }}>
              {error}
            </div>
          )}

          <button 
            id="signup-submit" 
            className="btn btn-primary animate-slide-up" 
            type="submit" 
            disabled={loading} 
            style={{ 
              width: '100%', 
              justifyContent: 'center', 
              marginTop: '0.25rem',
              animationDelay: '0.25s',
              animationFillMode: 'both'
            }}
          >
            {loading ? <Loader size={16} className="spin" /> : null}
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <div className="divider-text" style={{ margin: '1.75rem 0 1.5rem' }}>
          <span>or</span>
        </div>

        <p style={{ 
          textAlign: 'center', 
          fontSize: '0.9rem', 
          color: 'hsl(var(--pencil))',
          fontFamily: 'Inter, sans-serif'
        }}>
          Already have an account?{' '}
          <Link 
            to="/login" 
            style={{ 
              color: 'hsl(var(--accent))', 
              textDecoration: 'none', 
              fontWeight: 600
            }}
            className="scribble-underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
