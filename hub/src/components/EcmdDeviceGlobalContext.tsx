import React, { useEffect, useState } from "react";
import { DataProvider } from "@plasmicapp/host";
import {
  detectEcmdDeviceProfile,
  applyDeviceAttributesToDom,
  type EcmdDeviceProfile,
} from "../utils/ecmdDeviceEnv";
import { DEFAULT_THEME_IMAGE_CLASS_TOKENS } from "../lib/ecmdThemeEngine";

const DEFAULT_SSR_DEVICE_PROFILE: EcmdDeviceProfile = {
  ecosystem: "other",
  os: "unknown",
  browser: "other",
  isAppleDevice: false,
  isAndroidDevice: false,
  isChromeBrowser: false,
  applePaySupported: false,
  googlePaySupported: false,
  preferredPayment: "card",
  systemPrefersDark: false,
};

export function EcmdDeviceGlobalContext({ children, previewEcosystem = "auto" }: { children?: React.ReactNode; previewEcosystem?: "auto" | "apple" | "google" }) {
  // Always start with deterministic SSR-safe profile so SSR and initial client render match 100%,
  // then hydrate real browser/OS capabilities inside useEffect.
  const [profile, setProfile] = useState<EcmdDeviceProfile>(DEFAULT_SSR_DEVICE_PROFILE);

  useEffect(() => {
    const detected = detectEcmdDeviceProfile();
    const finalProfile = previewEcosystem === "apple"
      ? { ...detected, ecosystem: "apple" as const, isAppleDevice: true, applePaySupported: true, googlePaySupported: false, preferredPayment: "apple-pay" as const }
      : previewEcosystem === "google"
        ? { ...detected, ecosystem: "google" as const, isAppleDevice: false, applePaySupported: false, googlePaySupported: true, preferredPayment: "google-pay" as const }
        : detected;
    setProfile(finalProfile);
    if (typeof document !== "undefined") applyDeviceAttributesToDom(document, finalProfile);
  }, [previewEcosystem]);

  return (
    <DataProvider name="ecmdDevice" data={profile}>
      <DataProvider name="ecmdImgClass" data={DEFAULT_THEME_IMAGE_CLASS_TOKENS}>
        {children}
      </DataProvider>
    </DataProvider>
  );
}