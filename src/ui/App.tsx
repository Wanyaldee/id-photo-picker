import { strings } from "./strings";

export function App() {
  return (
    <main class="app">
      <header class="app-header">
        <h1>{strings.appTitle}</h1>
        <p>{strings.appLead}</p>
      </header>
      <p class="notice">{strings.privacyNote}</p>
      <p class="notice">{strings.usageNote}</p>
    </main>
  );
}
