import { useEffect, useRef } from 'react';
import Icon from './Icon.jsx';

/** Native <dialog>: focus trap, Escape and inert background come for free. */
export default function Dialog({ open, onClose, title, children, footer }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const handleCancel = (e) => {
      e.preventDefault();
      onClose();
    };
    el.addEventListener('cancel', handleCancel);
    return () => el.removeEventListener('cancel', handleCancel);
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="dialog">
        <header className="dialog__head">
          <h2>{title}</h2>
          <button type="button" className="iconbtn" onClick={onClose} aria-label="Close">
            <Icon name="close" size={20} />
          </button>
        </header>
        <div className="dialog__body">{children}</div>
        {footer}
      </div>
    </dialog>
  );
}
