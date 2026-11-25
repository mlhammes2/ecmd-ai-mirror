export type EcmdEcosystem = "apple" | "google" | "other";
export type EcmdOS = "ios" | "macos" | "android" | "windows" | "chromeos" | "linux" | "unknown";
export type EcmdBrowser = "safari" | "chrome" | "edge" | "firefox" | "other";

export interface EcmdDeviceProfile {
  ecosystem: EcmdEcosystem;
  os: EcmdOS;
  browser: EcmdBrowser;
  isAppleDevice: boolean;
  isAndroidDevice: boolean;
  isChromeBrowser: boolean;
  applePaySupported: boolean;
  googlePaySupported: boolean;
  preferredPayment: "apple-pay" | "google-pay" | "card";
  systemPrefersDark: boolean;
}

export function detectEcmdDeviceProfile(): EcmdDeviceProfile {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      ecosystem: "other",
      os: "unknown",
      browser: "other",
      isAppleDevice: false,
      isAndroidDevice: false,
      isChromeBrowser: false,
      applePaySupported: false,
      googlePaySupported: false,
      preferredPayment: "card",
      systemPrefersDark: false
    };
  }

  const ua = navigator.userAgent || "";
  const vendor = navigator.vendor || "";
  const platform = (navigator as any).userAgentData?.platform || navigator.platform || "";
  const maxTouch = navigator.maxTouchPoints || 0;

  // Detect iPadOS 13+ desktop-mode UA (MacIntel + touch points > 1) as iOS
  const isIPadOS = /Macintosh/i.test(ua) && maxTouch > 1;
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || isIPadOS;
  const isMac = !isIOS && (/Mac/i.test(platform) || /Macintosh|Mac OS X/i.test(ua));
  const isAndroid = /Android/i.test(ua);
  const isCrOS = /CrOS/i.test(ua);
  const isWin = /Win/i.test(platform) || /Windows/i.test(ua);
  const isLinux = !isAndroid && !isCrOS && /Linux/i.test(platform);

  const os: EcmdOS = isIOS ? "ios" : isMac ? "macos" : isAndroid ? "android" : isCrOS ? "chromeos" : isWin ? "windows" : isLinux ? "linux" : "unknown";

  const isEdge = /Edg\//i.test(ua);
  const isFirefox = /Firefox\//i.test(ua) || /FxiOS/i.test(ua);
  const isCriOS = /CriOS/i.test(ua);
  const isChrome = !isEdge && !isFirefox && (/Chrome\//i.test(ua) || isCriOS || /Google Inc/i.test(vendor));
  const isSafari = !isChrome && !isEdge && !isFirefox && /Safari\//i.test(ua) && /Apple/i.test(vendor);

  const browser: EcmdBrowser = isSafari ? "safari" : isChrome ? "chrome" : isEdge ? "edge" : isFirefox ? "firefox" : "other";

  const isAppleDevice = isIOS || isMac;
  const ecosystem: EcmdEcosystem = isAppleDevice ? "apple" : (isAndroid || isCrOS || isChrome) ? "google" : "other";

  // Wallet capability checks:
  // 1) Apple Pay: Apple device + ApplePaySession API (or Safari/WebKit on iOS/macOS)
  const hasApplePayApi = typeof (window as any).ApplePaySession !== "undefined";
  let canMakeApplePay = false;
  if (hasApplePayApi) {
    try {
      canMakeApplePay = Boolean((window as any).ApplePaySession.canMakePayments?.());
    } catch {
      canMakeApplePay = true;
    }
  }
  const applePaySupported = isAppleDevice && (canMakeApplePay || hasApplePayApi || isSafari || isIOS);

  // 2) Google Pay: Android devices OR Chrome/Chromium browsers on non-Apple devices supporting PaymentRequest
  const hasPaymentRequest = typeof (window as any).PaymentRequest !== "undefined";
  const googlePaySupported = !isAppleDevice && (isAndroid || isCrOS || (isChrome && hasPaymentRequest));

  const preferredPayment: "apple-pay" | "google-pay" | "card" = applePaySupported
    ? "apple-pay"
    : googlePaySupported
      ? "google-pay"
      : "card";

  let systemPrefersDark = false;
  try {
    systemPrefersDark = Boolean(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  } catch {}

  return {
    ecosystem,
    os,
    browser,
    isAppleDevice,
    isAndroidDevice: isAndroid,
    isChromeBrowser: isChrome,
    applePaySupported,
    googlePaySupported,
    preferredPayment,
    systemPrefersDark
  };
}

export function applyDeviceAttributesToDom(doc: Document, profile: EcmdDeviceProfile) {
  const root = doc.documentElement;
  if (!root) return;
  root.setAttribute("data-ecmd-ecosystem", profile.ecosystem);
  root.setAttribute("data-ecmd-os", profile.os);
  root.setAttribute("data-ecmd-browser", profile.browser);
  root.setAttribute("data-ecmd-apple-pay", profile.applePaySupported ? "true" : "false");
  root.setAttribute("data-ecmd-google-pay", profile.googlePaySupported ? "true" : "false");
  root.setAttribute("data-ecmd-preferred-pay", profile.preferredPayment);
  (window as any).__ECMD_DEVICE__ = profile;
}