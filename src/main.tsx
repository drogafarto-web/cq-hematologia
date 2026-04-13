import React from "react"
import ReactDOM from "react-dom/client"
import { AuthWrapper } from "./features/auth/AuthWrapper"
import { ErrorBoundary } from "./shared/components/ErrorBoundary"

const root = ReactDOM.createRoot(document.getElementById("root")!)
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthWrapper />
    </ErrorBoundary>
  </React.StrictMode>
)
