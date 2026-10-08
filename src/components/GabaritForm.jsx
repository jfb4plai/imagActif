import { useState } from 'react'
import { CHAMPS } from '../lib/champs.js'
import { getIn, setIn } from '../lib/path.js'
import { RATIOS, RATIO_IDS } from '../lib/ratios.js'

function ListeLignes({ id, valeur, disabled, placeholder, onChange, aideId }) {
  const [texte, setTexte] = useState((valeur ?? []).join('\n'))
  return (
    <textarea id={id} className="plai-input" value={texte} disabled={disabled} placeholder={placeholder}
      aria-describedby={aideId} onChange={(e) => setTexte(e.target.value)}
      onBlur={() => onChange(texte.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 10))} />
  )
}

function ChampsPerso({ valeur, disabled, onChange }) {
  const lignes = valeur ?? []
  const maj = (i, cle, v) => onChange(lignes.map((l, j) => (j === i ? { ...l, [cle]: v } : l)))
  return (
    <div>
      {lignes.map((l, i) => (
        <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
          <input className="plai-input" style={{ flex: '1 1 140px' }} aria-label={`Nom du champ ${i + 1}`} placeholder="Saison"
            value={l.nom} disabled={disabled} onChange={(e) => maj(i, 'nom', e.target.value)} />
          <input className="plai-input" style={{ flex: '2 1 200px' }} aria-label={`Valeur du champ ${i + 1}`} placeholder="automne"
            value={l.valeur} disabled={disabled} onChange={(e) => maj(i, 'valeur', e.target.value)} />
          <button type="button" className="plai-btn plai-btn-ghost" disabled={disabled}
            onClick={() => onChange(lignes.filter((_, j) => j !== i))}>Retirer</button>
        </div>
      ))}
      {lignes.length < 10 && (
        <button type="button" className="plai-btn plai-btn-ghost" disabled={disabled}
          onClick={() => onChange([...lignes, { nom: '', valeur: '' }])}>Ajouter un champ</button>
      )}
    </div>
  )
}

function Saisie({ c, id, valeur, disabled, onChange, aideId }) {
  switch (c.type) {
    case 'textarea':
      return <textarea id={id} className="plai-input" value={valeur ?? ''} disabled={disabled} placeholder={c.placeholder}
        aria-describedby={aideId} onChange={(e) => onChange(e.target.value)} />
    case 'texte':
      return (
        <>
          <input id={id} className="plai-input" value={valeur ?? ''} disabled={disabled} placeholder={c.placeholder}
            aria-describedby={aideId} list={c.suggestions ? `${id}-liste` : undefined} onChange={(e) => onChange(e.target.value)} />
          {c.suggestions && <datalist id={`${id}-liste`}>{c.suggestions.map((s) => <option key={s} value={s} />)}</datalist>}
        </>
      )
    case 'liste':
      return <ListeLignes key={JSON.stringify(valeur)} id={id} valeur={valeur} disabled={disabled} placeholder={c.placeholder} aideId={aideId} onChange={onChange} />
    case 'ratio':
      return (
        <select id={id} className="plai-input" value={valeur} disabled={disabled} aria-describedby={aideId} onChange={(e) => onChange(e.target.value)}>
          {RATIO_IDS.map((r) => <option key={r} value={r}>{RATIOS[r].label}</option>)}
        </select>
      )
    case 'seed':
      return <input id={id} type="number" min="0" max="4294967295" className="plai-input" value={valeur ?? ''} disabled={disabled}
        placeholder={c.placeholder} aria-describedby={aideId}
        onChange={(e) => onChange(e.target.value === '' ? null : Number.parseInt(e.target.value, 10))} />
    case 'custom':
      return <ChampsPerso valeur={valeur} disabled={disabled} onChange={onChange} />
    default:
      return null
  }
}

export default function GabaritForm({ gabarit, onChange, verrous = [] }) {
  return (
    <div>
      {CHAMPS.map((c) => {
        const id = `champ-${c.path.replace(/\./g, '-')}`
        const verrou = verrous.includes(c.path)
        return (
          <div className="plai-field" key={c.path}>
            <label className="plai-label" htmlFor={c.type === 'custom' ? undefined : id}>
              {c.label}{c.obligatoire ? ' (obligatoire)' : ''}{verrou ? ' (verrouillé par le modèle)' : ''}
            </label>
            <Saisie c={c} id={id} aideId={`${id}-aide`} valeur={getIn(gabarit, c.path)} disabled={verrou}
              onChange={(v) => onChange(setIn(gabarit, c.path, v))} />
            <p className="plai-help" id={`${id}-aide`}>{c.aide}</p>
          </div>
        )
      })}
    </div>
  )
}
