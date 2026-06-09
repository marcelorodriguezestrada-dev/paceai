/**
 * PaceAI — Hook para cargar carreras
 * Intenta Firebase primero, usa datos estáticos como fallback
 */
import { useState, useEffect } from 'react'
import { fbGetRaces } from '../firebase.js'
import { RACES_STATIC } from '../utils/data.js'

export function useRaces() {
  const [races, setRaces]     = useState(RACES_STATIC)
  const [loading, setLoading] = useState(true)
  const [source, setSource]   = useState('static') // 'static' | 'firebase'

  useEffect(() => {
    fbGetRaces()
      .then((fbRaces) => {
        if (fbRaces.length > 0) {
          setRaces(fbRaces)
          setSource('firebase')
          console.log(`✅ ${fbRaces.length} carreras cargadas desde Firebase`)
        } else {
          setSource('static')
        }
      })
      .catch(() => setSource('static'))
      .finally(() => setLoading(false))
  }, [])

  return { races, loading, source }
}
