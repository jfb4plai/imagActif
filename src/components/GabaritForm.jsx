import { useEffect, useState } from 'react'
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

// Éditeur générique de liste d'objets, piloté par c.colonnes et c.max.
function ListeObjets({ c, id, valeur, disabled, onChange, aideId }) {
  const lignes = valeur ?? []
  const vide = Object.fromEntries(c.colonnes.map((col) => [col.cle, '']))
  const maj = (i, cle, v) => onChange(lignes.map((l, j) => (j === i ? { ...l, [cle]: v } : l)))
  const plein = lignes.length >= c.max
  return (
    <div role="group" aria-labelledby={`${id}-label`} aria-describedby={aideId}>
      {lignes.map((l, i) => (
        <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
          {c.colonnes.map((col) => (
            <input key={col.cle} className="plai-input" style={{ flex: '1 1 140px' }}
              aria-label={`${col.label}, élément ${i + 1}`} placeholder={col.placeholder}
              value={l[col.cle] ?? ''} disabled={disabled} onChange={(e) => maj(i, col.cle, e.target.value)} />
          ))}
          <button type="button" className="plai-btn plai-btn-ghost" disabled={disabled}
            aria-label={`Retirer l'élément ${i + 1}`}
            onClick={() => onChange(lignes.filter((_, j) => j !== i))}>Retirer</button>
        </div>
      ))}
      <button type="button" className="plai-btn plai-btn-ghost" disabled={disabled || plein}
        onClick={() => onChange([...lignes, { ...vide }])}>
        {plein ? `Ajouter (maximum ${c.max} atteint)` : 'Ajouter'}
      </button>
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
    case 'liste-objets':
      return <ListeObjets c={c} id={id} valeur={valeur} disabled={disabled} aideId={aideId} onChange={onChange} />
    default:
      return null
  }
}

const estRempli = (v) => (Array.isArray(v) ? v.length > 0 : typeof v === 'string' ? v.trim() !== '' : v != null)

export default function GabaritForm({ gabarit, onChange, verrous = [] }) {
  const avances = CHAMPS.filter((c) => c.avance)
  const avanceUtilise = avances.some((c) => estRempli(getIn(gabarit, c.path)) || verrous.includes(c.path))
  const [ouvert, setOuvert] = useState(avanceUtilise)
  // Un import ou un modèle qui remplit un champ avancé ouvre le bloc ; l'utilisateur peut ensuite le refermer.
  useEffect(() => { if (avanceUtilise) setOuvert(true) }, [avanceUtilise])

  const bloc = (c) => {
    const id = `champ-${c.path.replace(/\./g, '-')}`
    const verrou = verrous.includes(c.path)
    return (
      <div className="plai-field" key={c.path}>
        <label className="plai-label" id={`${id}-label`} htmlFor={c.type === 'liste-objets' ? undefined : id}>
          {c.label}{c.obligatoire ? ' (obligatoire)' : ''}{verrou ? ' (verrouillé par le modèle)' : ''}
        </label>
        <Saisie c={c} id={id} aideId={`${id}-aide`} valeur={getIn(gabarit, c.path)} disabled={verrou}
          onChange={(v) => onChange(setIn(gabarit, c.path, v))} />
        <p className="plai-help" id={`${id}-aide`}>{c.aide}</p>
      </div>
    )
  }

  const sections = [...new Set(avances.map((c) => c.section))]
  return (
    <div>
      {CHAMPS.map((c) => {
        if (!c.avance) return bloc(c)
        if (c !== avances[0]) return null
        return (
          <details key="avance" className="plai-field img-avance" open={ouvert}
            onToggle={(e) => setOuvert(e.currentTarget.open)}>
            <summary className="plai-label">Détails avancés (facultatif)</summary>
            <p className="plai-help">
              Tout est facultatif ici. Ces détails rendent l'image plus proche de ce que vous imaginez, ou d'une image que vous avez importée.
            </p>
            {sections.map((sec) => (
              <fieldset key={sec} className="img-avance-groupe">
                <legend><h3>{sec}</h3></legend>
                {avances.filter((x) => x.section === sec).map(bloc)}
              </fieldset>
            ))}
          </details>
        )
      })}
    </div>
  )
}
