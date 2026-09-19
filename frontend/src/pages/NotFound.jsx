import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="page" style={{ maxWidth: '62ch' }}>
      <header className="page__head">
        <h1>That page isn't here</h1>
        <p className="lead">
          The link may be out of date. Everything else is one step away from the dashboard.
        </p>
      </header>
      <div className="row">
        <Link className="btn btn--solid" to="/">Back to the dashboard</Link>
        <Link className="btn" to="/triage">Run a symptom check</Link>
      </div>
    </div>
  );
}
