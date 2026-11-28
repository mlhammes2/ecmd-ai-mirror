import { installEcmdRuntimeErrorBridge } from "./ecmdLiveComponentTelemetry";

// Attach DEV global runtime error & unhandled rejection bridge before plasmic-init or routes evaluate
// so synchronous host-boot failures are always streamed to http://localhost:8080/errors.
if (import.meta.env.DEV) {
  installEcmdRuntimeErrorBridge();
}



