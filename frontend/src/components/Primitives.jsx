import Icon from './Icon.jsx';

const cx = (...parts) => parts.filter(Boolean).join(' ');

export function Card({ title, kanji, subtitle, actions, tone, className, children, as: Tag = 'section', ...rest }) {
  return (
    <Tag className={cx('card', tone && `card--${tone}`, className)} {...rest}>
      {(title || actions) && (
        <header className="card__head">
          <div className="card__title">
            {typeof title === 'string' ? <h2>{title}</h2> : title}
            {subtitle && <p className="small">{subtitle}</p>}
          </div>
          {actions}
          {!actions && kanji && <span className="kanji" aria-hidden="true">{kanji}</span>}
        </header>
      )}
      {children}
    </Tag>
  );
}

export function Button({ variant, size, icon, iconAfter, children, className, ...rest }) {
  return (
    <button
      type="button"
      className={cx('btn', variant && `btn--${variant}`, size && `btn--${size}`, className)}
      {...rest}
    >
      {icon && <Icon name={icon} size={18} />}
      {children}
      {iconAfter && <Icon name={iconAfter} size={18} />}
    </button>
  );
}

export function IconButton({ icon, label, count, className, ...rest }) {
  return (
    <button type="button" className={cx('iconbtn', className)} aria-label={label} {...rest}>
      <Icon name={icon} size={20} />
      {count ? <span className="iconbtn__count">{count}</span> : null}
    </button>
  );
}

export function Chip({ pressed, variant, children, onClick, ...rest }) {
  const className = cx('chip', variant && `chip--${variant}`);
  return (
    <li>
      {onClick ? (
        <button type="button" className={className} aria-pressed={pressed} onClick={onClick} {...rest}>
          {children}
        </button>
      ) : (
        <span className={className} {...rest}>{children}</span>
      )}
    </li>
  );
}

export function Stat({ value, label, note, tone }) {
  return (
    <div className={cx('stat', tone && `stat--${tone}`)}>
      <span className="stat__value">{value}</span>
      <span className="stat__label">{label}</span>
      {note && <span className="stat__note">{note}</span>}
    </div>
  );
}

export function Alert({ tone = 'sage', icon = 'info', title, children, actions }) {
  return (
    <div className={cx('alert', `alert--${tone}`)} role={tone === 'crimson' ? 'alert' : undefined}>
      <div className="alert__head">
        <Icon name={icon} size={22} />
        <div>
          {title && <h3>{title}</h3>}
          {typeof children === 'string' ? <p>{children}</p> : children}
        </div>
      </div>
      {actions}
    </div>
  );
}

export function SafetyStrip({ children = 'Non-diagnostic information — for triage guidance only.' }) {
  return (
    <p className="safety-strip">
      <Icon name="info" size={18} />
      {children}
    </p>
  );
}

export function Track({ pct, color }) {
  return (
    <div className="track">
      <i style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} />
    </div>
  );
}

export function Impact({ level, children }) {
  const icon = level === 'good' ? 'check' : level === 'caution' ? 'info' : 'alert';
  return (
    <div className={cx('impact', `impact--${level}`)}>
      <Icon name={icon} size={18} />
      <span>{children}</span>
    </div>
  );
}

export function Finding({ warn, children }) {
  return (
    <li className={cx('finding', warn && 'finding--warn')}>
      <Icon name={warn ? 'alert' : 'info'} size={18} />
      <p>{children}</p>
    </li>
  );
}
