/** Chips de filtro (`filters roster-filters`). options: [{ id, label }]. */
export default function FilterChips({ options, value, onChange, className = '', style }) {
  return (
    <div className={`filters roster-filters${className ? ` ${className}` : ''}`} style={style}>
      {options.map((o) => (
        <button
          type="button"
          key={o.id || 'all'}
          className={value === o.id ? 'active' : ''}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
