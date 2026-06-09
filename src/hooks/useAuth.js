/**
 * PaceAI — Hook de autenticación
 * Persiste la sesión en sessionStorage (dura mientras el tab esté abierto)
 */
import { useState, useEffect } from 'react'
import { fbLogin, fbRegister, fbGet } from '../firebase.js'

const SESSION_KEY = 'paceai_user'

export function useAuth() {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  // Restaurar sesión al recargar
  useEffect(() => {
    const saved = sessionStorage.getItem(SESSION_KEY)
    if (saved) {
      try {
        const u = JSON.parse(saved)
        setUser(u)
        loadProfile(u)
      } catch {}
    }
    setLoading(false)
  }, [])

  const loadProfile = async (u) => {
    const p = await fbGet('users', u.uid, u.token).catch(() => null)
    if (p) setProfile(p)
  }

  const login = async (email, password) => {
    const u = await fbLogin(email, password)
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(u))
    setUser(u)
    await loadProfile(u)
    return u
  }

  const register = async (email, password) => {
    const u = await fbRegister(email, password)
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(u))
    setUser(u)
    return u
  }

  const logout = () => {
    sessionStorage.removeItem(SESSION_KEY)
    setUser(null)
    setProfile(null)
  }

  return { user, profile, setProfile, loading, login, register, logout }
}
