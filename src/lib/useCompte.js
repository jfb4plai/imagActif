import { useCallback, useEffect, useState } from 'react'
import { getAccount, usageDuJour } from './data.js'
import { jourBruxelles } from './dates.js'

export function useCompte(user) {
  const uid = user?.id
  const [etat, setEtat] = useState({ chargement: true, compte: null, usage: 0 })

  const recharger = useCallback(async () => {
    if (!uid) {
      setEtat({ chargement: false, compte: null, usage: 0 })
      return
    }
    try {
      const [compte, usage] = await Promise.all([getAccount(), usageDuJour(jourBruxelles())])
      setEtat({ chargement: false, compte, usage })
    } catch {
      setEtat((e) => ({ ...e, chargement: false }))
    }
  }, [uid])

  useEffect(() => { recharger() }, [recharger])
  return { ...etat, recharger }
}
