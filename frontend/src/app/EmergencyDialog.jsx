import { useState } from 'react';
import Dialog from '../components/Dialog.jsx';
import { Alert } from '../components/Primitives.jsx';
import { RED_FLAG_SCREEN } from '../data/regions.js';

/**
 * The hard stop. Ticking anything here means the app should get out of the way
 * and tell the person to call for help — no scoring, no model, no nuance.
 */
export default function EmergencyDialog({ open, onClose }) {
  const [checked, setChecked] = useState([]);
  const any = checked.length > 0;

  const toggle = (i) =>
    setChecked((c) => (c.includes(i) ? c.filter((x) => x !== i) : [...c, i]));

  return (
    <Dialog open={open} onClose={onClose} title="Symptom urgency check">
      <p className="small">
        Six questions. This screen does not diagnose — it decides whether you should stop using the app
        and get help now.
      </p>

      <div className="stack-3">
        {RED_FLAG_SCREEN.map((flag, i) => (
          <label className="check" key={flag}>
            <input type="checkbox" checked={checked.includes(i)} onChange={() => toggle(i)} />
            <span>{flag}</span>
          </label>
        ))}
      </div>

      {any ? (
        <Alert tone="crimson" icon="alert" title="Call your local emergency number now">
          <p>
            What you ticked needs emergency assessment, not an app. If you are alone, call first and
            unlock the door. Numbers differ by country — 119 in Japan, 112 across the EU, 911 in the
            US, 108 in India.
          </p>
        </Alert>
      ) : (
        <Alert tone="sage" icon="check" title="No emergency signs ticked">
          Carry on with the guided check on the triage page. Come straight back here if any of these
          appear.
        </Alert>
      )}
    </Dialog>
  );
}
