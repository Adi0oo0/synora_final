import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Wire to Sentry/OTel here. Never log symptom or meal payloads.
    console.error('[zenhealth] render failure', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="page" style={{ maxWidth: '60ch' }}>
        <div className="page__head">
          <h1>This screen stopped working</h1>
          <p className="lead">
            Nothing you logged was lost. Reload to carry on, and if it keeps happening the detail below
            helps whoever fixes it.
          </p>
        </div>
        <pre className="card card--sunken" style={{ overflow: 'auto', fontSize: 'var(--text-sm)' }}>
          {String(this.state.error?.message || this.state.error)}
        </pre>
        <div className="row">
          <button type="button" className="btn btn--solid" onClick={() => window.location.reload()}>
            Reload ZenHealth
          </button>
          <a className="btn" href="/">Back to the dashboard</a>
        </div>
      </main>
    );
  }
}
