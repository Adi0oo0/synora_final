import { Link } from 'react-router-dom';
import Dialog from '../components/Dialog.jsx';
import Icon from '../components/Icon.jsx';

export default function NotificationsDialog({ open, onClose, items }) {
  return (
    <Dialog open={open} onClose={onClose} title="Needs your attention">
      {items.length === 0 ? (
        <p className="small">Nothing right now. Anything unusual in your readings, a check-up that has come due, or a symptom check that needs following up will show here.</p>
      ) : (
        <ul className="findings">
          {items.map((n) => (
            <li key={n.id} className={`finding${n.warn ? ' finding--warn' : ''}`}>
              <Icon name={n.warn ? 'alert' : 'info'} size={18} />
              <p>
                {n.text}{' '}
                <Link to={n.to} onClick={onClose}>Open</Link>
              </p>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
