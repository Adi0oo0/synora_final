import Dialog from '../components/Dialog.jsx';
import { Finding } from '../components/Primitives.jsx';

export default function NotificationsDialog({ open, onClose }) {
  return (
    <Dialog open={open} onClose={onClose} title="Notifications">
      <ul className="findings">
        <Finding warn>
          06:40 — heart rate anomaly. Held 12 bpm above baseline for 14 minutes with no step count in
          that window.
        </Finding>
        <Finding>
          Yesterday — sodium over target. 2,340 mg logged against a 1,500 mg goal, mostly from broth.
        </Finding>
        <Finding>Dr. Sato replied to your last message and has slots open this afternoon.</Finding>
      </ul>
    </Dialog>
  );
}
