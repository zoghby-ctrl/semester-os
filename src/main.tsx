import { Component, StrictMode, type ErrorInfo, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter";
import "@fontsource/space-grotesk/latin-400.css";
import "@fontsource/space-grotesk/latin-500.css";
import "@fontsource/space-grotesk/latin-600.css";
import "@fontsource/space-grotesk/latin-700.css";
import "./styles.css";
import App from "./App";
import { Provider } from "./lib/context";
import { LegalPage } from "./pages/Legal";
class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: string }
> {
  state = { error: "" };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Semester OS error", error, info);
  }
  render() {
    if (this.state.error)
      return (
        <div className="boot">
          <h1>Your space couldn’t open</h1>
          <p>
            Reload the app to try again. Your saved local records remain in this
            browser.
          </p>
          <pre>{this.state.error}</pre>
          <button className="button" onClick={() => location.reload()}>
            Reload
          </button>
        </div>
      );
    return this.props.children;
  }
}
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      {location.pathname.replace(/\/$/, "") === "/privacy" ? <LegalPage page="privacy" /> : location.pathname.replace(/\/$/, "") === "/terms" ? <LegalPage page="terms" /> : <Provider><App /></Provider>}
    </ErrorBoundary>
  </StrictMode>,
);
