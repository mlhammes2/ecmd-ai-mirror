import React, { useState, useEffect, useRef } from "react";

import { usePlasmicCanvasContext } from "@plasmicapp/host";
export const ECMD_AUTH_LOGO_DATA_URI = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIGZpbGw9Im5vbmUiIHZpZXdCb3g9IjAgMCAxNjUgMTExIj48cGF0aCBmaWxsPSIjMDAwIiBkPSJNMjMuMjQgMjIuNDJjMS4xOS0uODA3IDEuMDk2LS45OTYgMS4xOTEtLjkwNyAzLjg1MiAzLjU5OCAzLjkwNCA2LjI5NSAyLjExMyA3Ljg4Mi0xLjgzNiAxLjYyNy01LjQ0IDIuNzA2LTguOTAyIDMuNzU0LTMyLjcwMiAxNS45MSA2LjAyIDE2LjcxNSAxMi42NDggMjkuMzk4IDEuMzUgMi45NjguNzc4IDguNjUxLTQuNDYgMTIuOTIxLS45OC43OTktMi4zNzEuMTc1LTIuNTY3LTEuMDc3YTEuOTUgMS45NSAwIDAgMSAuNDMtMS41MzNxLjQ2Ny0uNTU1IDEuMDIzLTEuMjhjMy42MTUtNC43MDQgMy4xMTYtOC45OC0yLjUzNi0xMi4zNDNDLjgwOCA0Ni41MTYtMTUuMDU5IDQ3Ljg1NyAyMy4yNCAyMi40MiIvPjxwYXRoIGZpbGw9IiNmZmYiIGQ9Ik0xMTQuMDg0IDU2LjA3N2MtLjcyNi0xLjA0MyA0Ljk5NS0uNjc1IDguNTkxIDIuNjQ4IDIwLjM2NiAxMC43MzggMTUuOTAzIDI4LjMxMi04LjMyMiA0MC45ODYtMzUuMzYgMTguNDk4LTY3LjA5NSA2LjUyOC03Ny41MjQtNy4xMTMtMy41NzktNS4yNDItMy41MTctMTEuODU1IDEuNjI0LTE5LjIzNSAxLjU2OS0yLjI1MyA0LjAzNC0zLjQwMyA1Ljc4NS00LjMyOCAxLjk0NC0uNjEzIDMuMjctMS41MTMgNi42NDItMi43MjJsLS42MDYgMS4wNDFjLTMuMjI3IDMuMDgtNC41NSAyLjIwOS00LjQ0MyA2LjQ5LS43MzcgMS4xOTIgMS4zNSA2LjczOCAyLjMyOCAxMC4wM2wuMDI2LjE5NGMxMS4wNjUgMTUuNjU0IDc0LjgzNSAyLjQyMyA3MC4yNzYtMTcuMTgxLS4yNDctNC4zMzUtMi44NzMtNy41NDYtNC4zNzctMTAuODEiLz48cGF0aCBmaWxsPSIjMTI4ZmIxIiBkPSJNMTAyLjE4NiA1NS4wMTdjLjgyMyA0LjcxNC0xLjQ1NiA3LjAzOC0xNi41OTUgMTMuNTFMNjMuMDIyIDc4LjU4NWMxMC40MSAyLjY5MiAxNi44MTQuOTIzIDI0LjUyMy0uODg5bDIuODQyLS43NTFjOS4wOTEtMi4yMzggMjIuNzY3LTYuNzMzIDI1Ljc4OC0xNS44My40NDYtLjggMi40NzQgMy43NTQgMi44NDggNS4xODQuMjA2IDUuNzA1LTQuMzkyIDEyLjY2Ni0xMy44MTYgMTcuNDM2LTEyLjYxMiA2LjM4My0yOS43MTQgOS45NjUtNDYuMzQ2IDUuNDQ4LTQuNjI2LTEuMjU3LTEwLjU1Ny0zLjY2My0xMC41NTctMy42NjMtMi4wODktMS4xNDUtNC44NzktNy4xMjctNC4wMzUtOC4zIDIuMDkzLTIuOTEgMS45MTMtOC43OTggMS45MTMtOC43OTggMTEuNzQ2LTMuODUgMzUuNDcxLTE2LjE3NCAzNi4yNTQtMTguNzA0IDUuNTE4LTMuNDc0IDE4LjE4Mi0zLjY4MyAxOS43NSA1LjMiLz48cGF0aCBmaWxsPSIjMDAwIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0xMDIuODQxIDYxLjA0OGMtLjk0NSAyLjAyNi0yLjE1NyAzLjI0NS00LjE4IDQuNjgtMy4yMiAyLjI4Mi03LjY0NiA0LjIwNy0xMi40MzIgNS42NDRsLS4wODUuMDI2LS4wODYuMDIxYy0uMTQuMDM1LS4zMzUuMDgtLjU1OC4xMjRsLTE2LjUzIDcuMzczcS42MDMuMDI3IDEuMjE3LjAzNGM0LjE5LjA0NiA5LjAzOS0uNTczIDE2LjI0Mi0yLjE2MmwuMDI4LS4wMDZxLjk3LS4yMDYgMS45My0uNDMybC42MzgtLjE1My4wMTYtLjAwNC4wMS0uMDAyLjIwNy0uMDUxYzUuODA1LTEuNDI5IDE3LjE4Mi00LjAyNiAyMS4yNjQtOS40MzIgMi42ODYtMy41NiA1LjQtOC43ODIgMS43NDEtMTIuOTEzLTIuMTg3LTIuNDczIDE1LjA0NiA1LjU1NSAxOC45NTggOC44MzIgMTAuNjA2IDguODgzIDUuNzA0IDMwLjkyOS03LjMxOCAzMy41NjRsLS4zMDkuMDU4Yy0yLjMxMS40MS00LjUyMSAxLjU4OC00LjkxMiAyLjYxOS0uNjg3IDEuODA2LTEwLjc2OCA2LjE1OC0yMS4wNyA5LjEzN2wtLjk5Ny4yODNjLTEwLjAyNiAyLjgwOC0zMS44MDMgMy42NDYtMzkuMTkgMS41MS0zLjcxLTEuMDczLTcuMjQ3LTEuODY0LTcuODYtMS43NTctMi4zNjEuNDE1LTEyLjc3LTguNTItMTQuNzEyLTEyLjYyOGExOSAxOSAwIDAgMS0uNjA3LTEuNDM2IDggOCAwIDAgMS0uNTA1LS44OTNjLTMuMjk4LTYuOTgxLTEuMzc0LTEzLjgxOSA0LjE2Ni0yMC4yOTkgMS43NjUtMi4wNjMgNi40NC00LjEwMiA3Ljg0Ni00LjQ5M2wtLjAwMS4wMDdxLS4wMjguMTEtLjA1Ni4yMzdjLS40Mi44MTQtMy4xNTMgMS4yOTktNi4wODkgNS4wMDYtNS4xNDkgNy4zMTEtNS4yMTkgMTMuODU4LTEuNjQ3IDE5LjA0MiAxMC40MSAxMy40OSA0Ni42OCAyMC4zODcgNzUuMTQgNS42MiAyNC4yMzgtMTIuNTc3IDI3LjAyOC0yOS4yMTYgNi42NzgtMzkuODItNi4wNDMtMy4xNDktNi41NDktMy4yMzItNC4xODEtLjY5N2E4LjYgOC42IDAgMCAxIDEuMjQ3IDEuNjhsLjAzMy0uMDAzLjE4NS40M3EuMDc5LjE2Ny4xNDYuMzM3YzEuMDY3IDIuNDY4IDIuMjEyIDUuMjQ1IDIuNTQyIDYuNzMyLjE2Ny40MTguMjUyIDEuNTI3LjMwMSAyLjIxNC40MDEgNS41NzMtMy43NjggMTAuMzM3LTEwLjI2MiAxNC4xMTYtMTQuNjM2IDguNTE3LTM3Ljc0MiAxMi4xMTktNTQuMDYgNi45MzItNS43MDYtMS41Mi0xMS4yMi01LjY2Ny0xMi41MTgtOS4wNjQtLjI2MS0xLjE0NS0uOTU0LTIuNTM1LS40MTQtMy4zNDcgMi4wNDEtMy41NCAyLjUzNS03LjQ4NiAyLjktOS4xNzhhLjUuNSAwIDAgMCAuMDU1LS4yMzdjLjA2Ni0uMjczLjEzLS40NjMuMjAyLS41NTIgNC42Mi0xLjQ0IDcuOTA0LTIuOTA1IDExLjkxMy00LjU1NiAxMS4xNTgtNS41MjMgMTUuNzI2LTcuNDMzIDI2LjYwOS0xNi4wOTkgOC4xODQtMy42MjcgMjMuMjU0IDMuMjQ1IDE4LjM2NSAxMy45NTZNOTEuNDA5IDQ5LjYwM3MtMi4yMzIuMDc2LTMuOTk1IDEuMDA0Yy01Ljg5NSAzLjEwNS0xOC43NDEgOS4xMjUtMjQuNzMgMTEuNTY0bC0uMDAyLjAwMnYtLjAwMmMtNC4xMzYgMS44NjYtMTIuMDI0IDUuMzItMTUuNDgzIDcuMDQ2LS41MyAyLjgxMy0uOTUgNy4xNC0yLjY1MiA5LjQ0NS4yODcuODMyLjc1OSAxLjY5MiAxLjQ0IDIuNTggMi41NyAzLjM1NCA3LjA5NiA1LjYyMyAxNC4wODcgNi45ODYgMjMuNTk1IDQuNTk4IDU0LjU3MS01Ljg1IDU4LjE1Mi0xOC4xMTNxLjExOS0uNDA4LjIzLS43N2MuMTE3LTEuMzE5LS4xMDItMi43Ni0xLjA1LTUuNTM1LTEuNzM4IDYuMzUyLTEzLjY4NyAxMi41NDUtMjcuMjgyIDE1Ljg5bC4wMDEuMDA1LS4yNDMuMDU2YTk0IDk0IDAgMCAxLTIuNjcyLjYwOGMtMTQuNjQ5IDMuMjMyLTIwLjYwOCAyLjcyMy0zMC43MjYuMTA3TDg0LjQ3NiA2Ny45OWMuMTYxLS4wMDguNDEtLjA1Ni43MS0uMTMxIDkuMTUtMi43NDggMTYuMDY4LTcuMTMgMTUuMzI1LTExLjM4OS0uNTUyLTMuMTU4LTYuMzA0LTYuMzItOS4xMDItNi44NjciIGNsaXAtcnVsZT0iZXZlbm9kZCIvPjxwYXRoIGZpbGw9IiM1M2ViZWIiIGQ9Ik00Mi4xNTUgNi4zMWMxMi44OTktMi4wOTMgMTguNjczIDQuOTcyIDQzLjY1OSA2LjU5IDYuNTU4LS4wNTcgMjQuMzg3LTIuNTE4IDE3Ljk2MSAxMS41NzctMS4yNDMgMi43MjYtMTEuMjYyIDQuNTM0LTEzLjg5MyA0Ljk4LTQuMjY3LjcyNS0xNS43MzQuNzgxLTI0Ljg0Ny44Ni04LjAxMy41MjQgMS45NDcgMi4zNDMgMi4wOTcgMTkuOTQtMS4yMDIgOC42MjUtMjEuNTgyIDcuMzA0LTI0LjYyNC0yLjYxMi0xLjYwNS01LjIzMi0xMC41MzYtMTIuNTc0LTE4LjExOC0xNC43NjJsLjAwMS0uMDA0cS4wMjgtLjA5LjA0OC0uMThjLjM5NS0xLjg0My0uNTA4LTMuMjUyLS45Ni00Ljk0OC0uMDczLS4yNy0uMjA1LS42MzYtLjE4My0uOTE3LjcyLTkuMTg1IDguMzM2LTE4LjgxNSAxOC44NTktMjAuNTIzIi8+PHBhdGggZmlsbD0iIzAwMCIgZmlsbC1ydWxlPSJldmVub2RkIiBkPSJNMzIuMDgyIDguMzc5YzQuODkyLTYuMjc3IDIwLjU0LTcuMjg0IDI5LjY0NS0xLjkwNmwuNTc3LjM0YzUuODA3IDMuNDA3IDYuODE3IDMuNDcyIDIzLjYxMSAzLjIzNyAxOC43MDMtLjI2MiAxOS4yMzYtLjEwNCAyMS4yODQgNi4zMTkgMy42OTcgMTEuNTkxLTguNjgzIDE1Ljg3NC0xNy42MTcgMTUuOTUtNy42NjItLjg1LTE5LjE4My0yLjI4Ni0yNi4yNzItMS4zMjYtMy40ODkuNzE1IDQuNDU2IDMuNjQgNC41OSAxOS4yNDctMS4xOTQgOC41NTgtMjMuMDQyIDcuMzMtMjYuMzI3LTIuMzc0bC0uMDc0LS4yMzFjLTEuNjA1LTUuMjMxLTkuODU2LTEyLjEwNS0xNy40MzctMTQuMjkybC4wMDEtLjAwNS4wMjgtLjA5Ny4wMTEtLjA0My4wMDktLjA0YTIgMiAwIDAgMCAuMDI4LS4xNmwuMDA2LS4wNDcuMDA1LS4wNDQuMDA0LS4wNTlhMi42IDIuNiAwIDAgMC0uMDEzLS40OTUgNCA0IDAgMCAwLS4wOTgtLjUyNSA1IDUgMCAwIDAtLjA5OC0uMzM3bC0uMDMyLS4wOTUtLjA1LS4xNDMtLjAyOC0uMDc2LS4wNTgtLjE0OS0uMDI3LS4wNy0uMDcyLS4xNzQtLjAxNi0uMDM4LS4wOC0uMTgyLS4xNjMtLjM1OWMtLjE1NC0uMzMxLS4zMTMtLjY2Mi0uNDU5LS45ODRsLS4xNC0uMzE4YTggOCAwIDAgMS0uMjQ2LS42NTRsLS4wNjItLjIxYTMgMyAwIDAgMS0uMDkyLS40OGwtLjAwMy0uMDMzLS4wMDgtLjE0OHYtLjAzbC4wMDEtLjA3Mi4wMDQtLjA3MWEyMC4zIDIwLjMgMCAwIDEgMS4xNzgtNS4zNmwuMDA2LS4wMTloLjAwMWEyMi4yIDIyLjIgMCAwIDEgMy41ODMtNi4zMDRjMi43MTEtMy40MSAzLjI2Ny01LjExNCA0LjU5NS02Ljc1OHptMjguNTczIDIuMDg5Yy02Ljg2Ni0zLjk2NC0xNS4yOS00Ljc0Ny0yMS41MTktMi00LjU2MSAyLjAxLTEwLjAyIDguMzk4LTEyLjA4MyAxMi42NzUgMS40NjMtLjA4OCAzLjI1My0uMDMgNS40MTEuMTY1cS4xNS4wMTMuMzAyLjAyNHYuMDAzYy4wNjQuMDIzIDcuMjA1IDIuNjA4IDIzLjM0MyAxLjM0NmEuNy43IDAgMCAxLS4yMi4xMTJjLTUuODQ0IDEuNTktMTYuMzcgMi43NjMtMjMuNDE3IDIuMTk1bC0uMzMzLS4wMjlhNTcgNTcgMCAwIDAtMi4xMzctLjE1IDI2IDI2IDAgMCAwLTIuNjU0LS4wMWwtLjA2NS4wMDRhMTUgMTUgMCAwIDAtLjQwMi4wM2wtLjAxOS4wMDFhMTEgMTEgMCAwIDAtLjU0OC4wNjJxLS4zMzUuMDQ3LS42Mi4xMWExNyAxNyAwIDAgMC0uMzYgMi4yOWMtLjIxNS43NDMgMCAyLjI4OCAxLjU1NyAzLjkwNCAzLjU3IDEuMzQ4IDcuMDc2IDMuNDg3IDkuOTc5IDUuODc5IDMuMzcgMi43NzcgNi4zNiA2LjI1NiA3LjQxNSA5LjY5MS40ODQgMS41OCAxLjcxNyAzLjAwNCAzLjY0NSA0LjEzNiAxLjkyOSAxLjEzMiA2LjE0NiAxLjg0NSA4LjYgMi4wNiAyLjQ3My4yMTYgNC43MTItLjEwMiA2LjI3NS0uNzg5IDEuNDIxLS42MjQgMi4wMDYtMS4zOTQgMi4xNzUtMi4xNjktLjEyLTcuODcyLTEuODItMTIuMzgzLTMuMzQ5LTE0LjQyNi0uMjk5LS40LS45MS0xLjE3LTEuMTYxLTEuNTJhNiA2IDAgMCAxLS41ODItLjk2NGMtLjE2OC0uMzU3LS40NzQtMS4xMjYtLjMyLTIuMDg2bC4xMDUtLjYzNGMuMDExLS4wMS43OC0uNzQgMy42MjUtLjc2NSAxMy40MTctLjAyOCAyMi4xMjIuMDk4IDI2LjkyNy0uOTY1IDQuMjE4LTEuMTc0IDkuNjktMS41MDQgMTIuNjQ4LTUuMDdhNS40NCA1LjQ0IDAgMCAwIDEuMTQ1LTIuMjgzbC0uMDU0LjAyM2E2IDYgMCAwIDAgLjI0OS0xLjcyNiA2LjA0IDYuMDQgMCAwIDAtMy4yMTEtNS4zNDRjLTIuMS0xLjI0NC02Ljg0Ny0xLjI4LTE3LjQyNC0uNzk1LTE1LjIxOC42OTgtMTYuNDMxLjcwNy0yMS43OS0yLjMzNnoiIGNsaXAtcnVsZT0iZXZlbm9kZCIvPjwvc3ZnPg==";

export interface EcmdAuthModalControllerProps {
  className?: string;
  modalCardClassName?: string;
  triggerSlotClassName?: string;
  themeGroup?: "none" | "ecmd-group-1" | "ecmd-group-2" | "ecmd-group-3" | "ecmd-group-4";
  open?: boolean;
  defaultOpen?: boolean;
  authMode?: "login" | "signup" | "forgot";
  previewState?: "idle" | "loading" | "error" | "success";
  previewMessage?: string;
  previewSuccessText?: string;
  previewLoggedIn?: boolean;
  floatOverlay?: boolean;
  fixedBreakout?: boolean;
  gapBelowTrigger?: number;
  alignModal?: "left" | "center" | "right";
  dimBackdrop?: boolean;
  dimOpacity?: number;
  blurBackdrop?: boolean;
  overlayBlurPx?: number;
  hideTrigger?: boolean;
  showTrigger?: boolean;
  showSecondTrigger?: boolean;
  secondTriggerText?: string;
  autoSwapLogout?: boolean;
  loggedOutText?: string;
  loggedInText?: string;
  showHeader?: boolean;
  showFooter?: boolean;
  showCloseIcon?: boolean;
  showPasswordEyeToggle?: boolean;
  showRememberMe?: boolean;
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
  shakeOnError?: boolean;
  autoCloseMs?: number;
  supabaseUrl?: string;
  modalWidth?: string;
  modalBackground?: string;
  modalBorderColor?: string;
  modalRadius?: string;
  trigger?: React.ReactNode;
  title?: React.ReactNode;
  closeIcon?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  onOpenChange?: (open: boolean) => void;
  onLogout?: () => void;
  onAuthSuccess?: (user: any) => void;
  onAuthError?: (err: string) => void;
  onModeChange?: (mode: string) => void;
  onOk?: () => void;
  onCancel?: () => void;
}

const DefaultNativeTrigger = ({
  loggedOutText = "Member Login",
  showSecondTrigger = true,
  secondTriggerText = "Sign Up"
}: {
  loggedOutText?: string;
  showSecondTrigger?: boolean;
  secondTriggerText?: string;
}) => (
  <div id="ecmd-auth-trigger-row" style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "flex-start", gap: "0px", padding: "8px 0px", background: "transparent" }}>
    <button id="ecmd-auth-trigger-btn" type="button" style={{ padding: "0px 10px", height: "48px", background: "transparent", color: "#FFFFFF", fontFamily: "Inter, sans-serif", fontSize: "16px", fontWeight: 600, border: "none", borderRadius: "8px", cursor: "pointer", whiteSpace: "nowrap" }}>
      {loggedOutText}
    </button>
    {showSecondTrigger && (
      <button id="ecmd-auth-signup-trigger-btn" type="button" style={{ padding: "0px 10px", height: "50.47px", background: "transparent", color: "#FFFFFF", fontFamily: "Inter, sans-serif", fontSize: "16px", fontWeight: 600, border: "1.25px solid transparent", borderRadius: "8px", cursor: "pointer", whiteSpace: "nowrap" }}>
        {secondTriggerText}
      </button>
    )}
  </div>
);

const DefaultNativeCloseIcon = () => (
  <div id="ecmd-auth-close-x" style={{ fontSize: "20px", fontWeight: 400, fontFamily: "Inter, sans-serif", color: "rgb(84, 89, 96)", lineHeight: "20px", userSelect: "none" }}>
    ✕
  </div>
);

const DefaultNativeTitle = () => (
  <div id="ecmd-auth-title-stack" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", gap: "0px", padding: "8px 8px 0px", width: "100%", boxSizing: "border-box" }}>
    <img id="ecmd-auth-logo-img" src={ECMD_AUTH_LOGO_DATA_URI} alt="Emerald Coast Mobile Detailing" style={{ width: "100px", height: "80px", objectFit: "contain", display: "block" }} />
    <div id="ecmd-auth-title-text" style={{ fontSize: "24px", fontWeight: 700, fontFamily: "Inter, sans-serif", color: "inherit", textAlign: "center", lineHeight: "36px", width: "100%" }}>
      Login
    </div>
  </div>
);

const DefaultNativeBody = ({ previewSuccessText = "Login Successful - Welcome back!" }: { previewSuccessText?: string }) => (
  <div id="ecmd-auth-inputs-stack" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-start", gap: "3px", padding: "8px 8px 0px", width: "100%", boxSizing: "border-box" }}>
    <input id="ecmd-auth-email-input" type="email" placeholder="Email Address" style={{ width: "100%", height: "46.48px", padding: "10px 12px", borderRadius: "8px", border: "1.25px solid #CBD5E1", backgroundColor: "#FFFFFF", fontSize: "16px", fontFamily: "Inter, sans-serif", color: "#0F172A", boxSizing: "border-box", outline: "none" }} />
    <input id="ecmd-auth-password-input" type="password" placeholder="Password" style={{ width: "100%", height: "46.48px", padding: "10px 12px", borderRadius: "8px", border: "1.25px solid #CBD5E1", backgroundColor: "#FFFFFF", fontSize: "16px", fontFamily: "Inter, sans-serif", color: "#0F172A", boxSizing: "border-box", outline: "none" }} />
    <input id="ecmd-auth-confirm-input" type="password" placeholder="Confirm Password" style={{ display: "none", width: "100%", height: "46.48px", padding: "10px 12px", borderRadius: "8px", border: "1.25px solid #CBD5E1", backgroundColor: "#FFFFFF", fontSize: "16px", fontFamily: "Inter, sans-serif", color: "#0F172A", boxSizing: "border-box", outline: "none" }} />
    <div id="ecmd-auth-links-row" style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "4px 8px", boxSizing: "border-box" }}>
      <div id="ecmd-auth-forgot-link" style={{ fontSize: "13px", fontWeight: 400, fontFamily: "Inter, sans-serif", color: "inherit", textDecoration: "underline", cursor: "pointer" }}>Forgot Password?</div>
      <div id="ecmd-auth-signup-group" style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "5px" }}>
        <div id="ecmd-auth-signup-prompt" style={{ fontSize: "13px", fontWeight: 700, fontFamily: "Inter, sans-serif", color: "inherit" }}>Need an account?</div>
        <div id="ecmd-auth-signup-link" style={{ fontSize: "13px", fontWeight: 400, fontFamily: "Inter, sans-serif", color: "inherit", textDecoration: "underline", cursor: "pointer" }}>Sign Up</div>
      </div>
    </div>
    <div id="ecmd-auth-extras-bar" style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", paddingTop: "4px", boxSizing: "border-box" }}>
      <div id="ecmd-auth-remember-row" style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "5px", paddingTop: "8px", cursor: "pointer", userSelect: "none" }}>
        <div id="ecmd-auth-remember-box" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "16px", height: "16px", borderRadius: "4px", border: "1.25px solid rgba(0, 0, 0, 0.88)", backgroundColor: "#FFFFFF", boxSizing: "border-box" }}>
          <div id="ecmd-auth-remember-check" style={{ fontSize: "15px", fontWeight: 700, fontFamily: "Inter, sans-serif", color: "#1677FF", lineHeight: "12px" }}>✓</div>
        </div>
        <div id="ecmd-auth-remember-text" style={{ fontSize: "13px", fontWeight: 400, fontFamily: "Inter, sans-serif", color: "#1677FF" }}>Remember me</div>
      </div>
      <div id="ecmd-auth-eye-toggle-btn" style={{ display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: "5px", padding: "8px 0px 0px 8px", cursor: "pointer", userSelect: "none" }}>
        <div id="ecmd-auth-eye-icon" style={{ fontSize: "16px", fontWeight: 400, fontFamily: "Inter, sans-serif", color: "#1677FF", paddingBottom: "3px", lineHeight: "16px" }}>👁</div>
        <div id="ecmd-auth-eye-text" style={{ fontSize: "13px", fontWeight: 600, fontFamily: "Inter, sans-serif", color: "#1677FF" }}>Show Password</div>
      </div>
    </div>
    <div id="ecmd-auth-status-banner" style={{ display: "none", width: "100%", padding: "10px", marginTop: "6px", borderRadius: "8px", fontSize: "14px", fontWeight: 600, fontFamily: "Inter, sans-serif", textAlign: "center", boxSizing: "border-box" }}>{previewSuccessText}</div>
  </div>
);

const DefaultNativeFooter = () => (
  <div id="ecmd-auth-footer-row" style={{ display: "flex", flexDirection: "row", alignItems: "stretch", justifyContent: "flex-end", gap: "8px", padding: "0px 8px", width: "100%", boxSizing: "border-box" }}>
    <button id="ecmd-auth-cancel-btn" type="button" style={{ padding: "2px 16px", height: "30.47px", borderRadius: "3px", border: "1.25px solid #D3D3D3", backgroundColor: "#E2E8F0", color: "#0F172A", fontSize: "16px", fontWeight: 400, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>Cancel</button>
    <button id="ecmd-auth-submit-btn" type="button" style={{ padding: "2px 20px", height: "30.47px", borderRadius: "3px", border: "1.25px solid #393939", backgroundColor: "#128FB1", color: "#FFFFFF", fontSize: "16px", fontWeight: 600, fontFamily: "Inter, sans-serif", cursor: "pointer" }}>Login</button>
  </div>
);

export function EcmdAuthModalController({
  className,
  modalCardClassName,
  triggerSlotClassName,
  themeGroup = "ecmd-group-3",
  open,
  defaultOpen = false,
  authMode = "login",
  previewState = "idle",
  previewMessage = "",
  previewSuccessText = "Login Successful - Welcome back!",
  previewLoggedIn,
  floatOverlay = true,
  fixedBreakout = false,
  gapBelowTrigger = 10,
  alignModal = "right",
  dimBackdrop = false,
  dimOpacity = 0,
  blurBackdrop = false,
  overlayBlurPx = 3,
  hideTrigger = false,
  showTrigger = true,
  showSecondTrigger = true,
  secondTriggerText = "Sign Up",
  autoSwapLogout = true,
  loggedOutText = "Member Login",
  loggedInText = "Log Out",
  showHeader = true,
  showFooter = true,
  showCloseIcon = true,
  showPasswordEyeToggle = true,
  showRememberMe = true,
  closeOnBackdropClick = true,
  closeOnEscape = true,
  shakeOnError = true,
  autoCloseMs = 1200,
  supabaseUrl = "https://lvynkeuceiqxafgpgdvs.supabase.co/functions/v1/ecmd-carbon-bridge",
  modalWidth = "420px",
  modalBackground = "#FFFFFF",
  modalBorderColor = "#E2E8F0",
  modalRadius = "12px",
  trigger,
  title,
  closeIcon,
  children,
  footer,
  onOpenChange,
  onLogout,
  onAuthSuccess,
  onAuthError,
  onModeChange,
  onOk,
  onCancel
}: EcmdAuthModalControllerProps) {
  const __canvasCtx = usePlasmicCanvasContext();
  const inPlasmicCanvas = Boolean(__canvasCtx);
  const isDesignCanvas = Boolean(__canvasCtx && !__canvasCtx.interactive);
  const [internalOpen, setInternalOpen] = useState<boolean>(isDesignCanvas ? Boolean(open ?? defaultOpen) : Boolean(defaultOpen));
  const [mode, setMode] = useState<"login" | "signup" | "forgot">(authMode);
  // Deterministic SSR-safe initial values; hydrate browser storage in useEffect to prevent hydration mismatches.
  const [rememberMe, setRememberMe] = useState<boolean>(true);
  const [showPass, setShowPass] = useState<boolean>(false);
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "success">(previewState);
  const [msg, setMsg] = useState<string>(previewMessage);
  const [isShaking, setIsShaking] = useState<boolean>(false);
  const [loggedUser, setLoggedUser] = useState<any>(() =>
    previewLoggedIn
      ? { id: "preview_user", email: "preview@ecmdutah.com", full_name: "Preview Member" }
      : null
  );

  useEffect(() => {
    try {
      setRememberMe(localStorage.getItem("ecmd_remember_me") !== "false");
    } catch {
      // ignore storage restrictions
    }
  }, []);

  useEffect(() => {
    if (previewLoggedIn !== undefined) {
      setLoggedUser(previewLoggedIn ? { id: "preview_user", email: "preview@ecmdutah.com", full_name: "Preview Member" } : null);
      return;
    }
    if (inPlasmicCanvas) {
      setLoggedUser(null);
      return;
    }
    try {
      const s = localStorage.getItem("ecmd_auth_user") || sessionStorage.getItem("ecmd_auth_user");
      setLoggedUser(s ? JSON.parse(s) : null);
    } catch {
      setLoggedUser(null);
    }
  }, [previewLoggedIn, inPlasmicCanvas]);

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const isOpen = isDesignCanvas ? Boolean(open ?? internalOpen) : internalOpen;
  const setModalOpen = (val: boolean) => {
    setInternalOpen(val);
    if (val && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("ecmd-popover-opened", { detail: { source: "auth-modal" } }));
    }
    if (onOpenChange) onOpenChange(val);
  };

  const changeMode = (nextMode: "login" | "signup" | "forgot") => {
    setMode(nextMode);
    setStatus("idle");
    setMsg("");
    if (onModeChange) onModeChange(nextMode);
  };

  useEffect(() => { if (open !== undefined) setInternalOpen(open); }, [open]);
  useEffect(() => { setMode(authMode); }, [authMode]);
  useEffect(() => { setStatus(previewState); if (previewMessage) setMsg(previewMessage); }, [previewState, previewMessage]);

  // Mutual popover coordination: close when other popovers (e.g. theme-group, side-menu) open
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleOtherPopover = (e: Event) => {
      const ce = e as CustomEvent;
      if (ce.detail?.source && ce.detail.source !== "auth-modal") {
        setInternalOpen(false);
        onOpenChange?.(false);
      }
    };
    window.addEventListener("ecmd-popover-opened", handleOtherPopover);
    return () => window.removeEventListener("ecmd-popover-opened", handleOtherPopover);
  }, [onOpenChange]);

  useEffect(() => {
    if (!closeOnEscape || !isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { if (onCancel) onCancel(); setModalOpen(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeOnEscape, isOpen, onCancel]);

  useEffect(() => {
    if (!closeOnBackdropClick || !isOpen || fixedBreakout) return;
    const onDocDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        if (onCancel) onCancel();
        setModalOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, [closeOnBackdropClick, isOpen, fixedBreakout, onCancel]);

  useEffect(() => {
    const trig = triggerRef.current;
    if (!trig) return;
    const buttons = Array.from(trig.querySelectorAll("button, a, [role=button]")) as HTMLElement[];
    const primaryBtn = (trig.querySelector("#ecmd-auth-trigger-btn") as HTMLElement | null) || buttons[0] || null;
    let secondBtn = (trig.querySelector("#ecmd-auth-signup-trigger-btn") as HTMLElement | null) || null;
    if (!secondBtn && buttons.length >= 2) {
      secondBtn = buttons[1] || null;
    }
    const isUserLoggedIn = Boolean(loggedUser);
    if (primaryBtn && autoSwapLogout) {
      primaryBtn.textContent = isUserLoggedIn ? loggedInText : loggedOutText;
    }
    if (secondBtn) {
      const shouldDisplay = showSecondTrigger !== false && !(autoSwapLogout && isUserLoggedIn);
      secondBtn.style.display = shouldDisplay ? "" : "none";
      if (secondTriggerText && secondBtn.id === "ecmd-auth-signup-trigger-btn") {
        secondBtn.textContent = secondTriggerText;
      }
    }
  }, [loggedUser, autoSwapLogout, loggedOutText, loggedInText, showSecondTrigger, secondTriggerText]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const savedEmail = (() => { try { return localStorage.getItem("ecmd_saved_email") || ""; } catch { return ""; } })();
    const emailEl = root.querySelector("#ecmd-auth-email-input, input[type=email]") as HTMLInputElement | null;
    const passEl = root.querySelector("#ecmd-auth-password-input") as HTMLInputElement | null;
    const confirmEl = root.querySelector("#ecmd-auth-confirm-input") as HTMLInputElement | null;
    const titleEl = root.querySelector("#ecmd-auth-title-text") as HTMLElement | null;
    const submitEl = root.querySelector("#ecmd-auth-submit-btn") as HTMLElement | null;
    const cancelEl = root.querySelector("#ecmd-auth-cancel-btn") as HTMLElement | null;
    const forgotEl = root.querySelector("#ecmd-auth-forgot-link") as HTMLElement | null;
    const signupPromptEl = root.querySelector("#ecmd-auth-signup-prompt") as HTMLElement | null;
    const signupLinkEl = root.querySelector("#ecmd-auth-signup-link") as HTMLElement | null;
    const rememberRowEl = root.querySelector("#ecmd-auth-remember-row") as HTMLElement | null;
    const rememberCheckEl = root.querySelector("#ecmd-auth-remember-check") as HTMLElement | null;
    const eyeBtnEl = root.querySelector("#ecmd-auth-eye-toggle-btn") as HTMLElement | null;
    const eyeTextEl = root.querySelector("#ecmd-auth-eye-text") as HTMLElement | null;
    const statusBannerEl = root.querySelector("#ecmd-auth-status-banner") as HTMLElement | null;

    if (emailEl && savedEmail && !emailEl.value) emailEl.value = savedEmail;
    if (passEl) { passEl.type = showPass ? "text" : "password"; passEl.style.display = mode === "forgot" ? "none" : ""; }
    if (confirmEl) { confirmEl.type = showPass ? "text" : "password"; confirmEl.style.display = mode === "signup" ? "" : "none"; }
    if (titleEl) titleEl.textContent = mode === "login" ? "Login" : mode === "signup" ? "Create Account" : "Reset Password";
    if (submitEl) submitEl.textContent = status === "loading" ? "Please wait..." : mode === "login" ? "Login" : mode === "signup" ? "Sign Up" : "Send Reset Link";
    if (forgotEl) forgotEl.textContent = mode === "forgot" ? "Back to Login" : "Forgot Password?";
    if (signupPromptEl) signupPromptEl.textContent = mode === "signup" ? "Already have an account?" : "Need an account?";
    if (signupLinkEl) signupLinkEl.textContent = mode === "signup" ? "Login" : "Sign Up";
    if (rememberRowEl) rememberRowEl.style.display = showRememberMe && mode !== "forgot" ? "flex" : "none";
    if (rememberCheckEl) rememberCheckEl.textContent = rememberMe ? "✓" : "";
    if (eyeBtnEl) eyeBtnEl.style.display = showPasswordEyeToggle && mode !== "forgot" ? "flex" : "none";
    if (eyeTextEl) eyeTextEl.textContent = showPass ? "Hide Password" : "Show Password";
    if (statusBannerEl) {
      if (status === "idle" || (!msg && status !== "success")) statusBannerEl.style.display = "none";
      else {
        statusBannerEl.style.display = "block";
        statusBannerEl.textContent = msg || previewSuccessText;
        statusBannerEl.style.background = status === "error" ? "#FEF2F2" : status === "success" ? "#ECFDF5" : "#EFF6FF";
        statusBannerEl.style.color = status === "error" ? "#DC2626" : status === "success" ? "#059669" : "#2563EB";
        statusBannerEl.style.border = status === "error" ? "1px solid #FECACA" : status === "success" ? "1px solid #A7F3D0" : "1px solid #BFDBFE";
      }
    }

    const triggerFail = (errText: string) => {
      setStatus("error"); setMsg(errText);
      if (shakeOnError) { setIsShaking(true); setTimeout(() => setIsShaking(false), 450); }
      if (onAuthError) onAuthError(errText);
    };

    const handleSubmit = async (e?: Event) => {
      if (e) { e.preventDefault(); e.stopPropagation(); }
      const email = (emailEl?.value || "").trim().toLowerCase();
      const password = passEl?.value || "";
      const confirmPass = confirmEl?.value || "";
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return triggerFail("Please enter a valid email address.");
      if (mode !== "forgot" && password.length < 6) return triggerFail("Password must be at least 6 characters.");
      if (mode === "signup" && password !== confirmPass) return triggerFail("Passwords do not match.");

      setStatus("loading"); setMsg("Verifying credentials...");
      try {
        const sq = String.fromCharCode(39);
        const safeEmail = email.split(sq).join(sq + sq);
        const safePass = password.split(sq).join(sq + sq);
        const sql = "SELECT public.ecmd_auth_member(" + sq + mode + sq + ", " + sq + safeEmail + sq + ", " + sq + safePass + sq + ") AS res";
        const resp = await fetch(supabaseUrl, { method: "POST", headers: { "x-bridge-key": "[REDACTED_SECRET]", "Content-Type": "application/json" }, body: JSON.stringify({ action: "run_sql", sql }) });
        const data = await resp.json();
        const res = data?.rows?.[0]?.res;
        if (!res || !res.ok) return triggerFail(res?.error || data?.error || "Authentication failed.");
        setStatus("success"); setMsg(res.message || previewSuccessText);
        if (mode !== "forgot" && res.user) {
          setLoggedUser(res.user);
          try {
            localStorage.setItem("ecmd_remember_me", rememberMe ? "true" : "false");
            if (rememberMe) { localStorage.setItem("ecmd_saved_email", email); localStorage.setItem("ecmd_auth_user", JSON.stringify(res.user)); }
            else { sessionStorage.setItem("ecmd_auth_user", JSON.stringify(res.user)); localStorage.removeItem("ecmd_auth_user"); }
          } catch {}
          if (onAuthSuccess) onAuthSuccess(res.user);
          if (onOk) onOk();
          if (autoCloseMs > 0) setTimeout(() => setModalOpen(false), autoCloseMs);
        }
      } catch (err: any) { triggerFail(err?.message || "Network error during authentication."); }
    };

    const onForgotClick = (e: Event) => { e.preventDefault(); changeMode(mode === "forgot" ? "login" : "forgot"); };
    const onSignupClick = (e: Event) => { e.preventDefault(); changeMode(mode === "signup" ? "login" : "signup"); };
    const onRememberClick = (e: Event) => { e.preventDefault(); setRememberMe((v) => !v); };
    const onEyeClick = (e: Event) => { e.preventDefault(); setShowPass((v) => !v); };
    const onCancelClick = (e: Event) => { e.preventDefault(); if (onCancel) onCancel(); setModalOpen(false); };
    const onInputKey = (e: KeyboardEvent) => { if (e.key === "Enter") handleSubmit(e); };

    submitEl?.addEventListener("click", handleSubmit);
    cancelEl?.addEventListener("click", onCancelClick);
    forgotEl?.addEventListener("click", onForgotClick);
    signupLinkEl?.addEventListener("click", onSignupClick);
    rememberRowEl?.addEventListener("click", onRememberClick);
    eyeBtnEl?.addEventListener("click", onEyeClick);
    emailEl?.addEventListener("keydown", onInputKey);
    passEl?.addEventListener("keydown", onInputKey);
    confirmEl?.addEventListener("keydown", onInputKey);

    return () => {
      submitEl?.removeEventListener("click", handleSubmit);
      cancelEl?.removeEventListener("click", onCancelClick);
      forgotEl?.removeEventListener("click", onForgotClick);
      signupLinkEl?.removeEventListener("click", onSignupClick);
      rememberRowEl?.removeEventListener("click", onRememberClick);
      eyeBtnEl?.removeEventListener("click", onEyeClick);
      emailEl?.removeEventListener("keydown", onInputKey);
      passEl?.removeEventListener("keydown", onInputKey);
      confirmEl?.removeEventListener("keydown", onInputKey);
    };
  }, [mode, isOpen, rememberMe, showPass, showRememberMe, showPasswordEyeToggle, status, msg, previewSuccessText, autoCloseMs, supabaseUrl, shakeOnError, onAuthSuccess, onAuthError, onModeChange, onOk, onCancel]);

  useEffect(() => {
    const trig = triggerRef.current;
    if (!trig) return;
    const handleTriggerClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("button, a, [role=button], div") as HTMLElement || e.target as HTMLElement;
      const text = (target.textContent || "").trim().toLowerCase();
      if (autoSwapLogout && loggedUser && (text.includes("log out") || text.includes("sign out") || target.id === "ecmd-auth-trigger-btn")) {
        setLoggedUser(null);
        try { localStorage.removeItem("ecmd_auth_user"); sessionStorage.removeItem("ecmd_auth_user"); } catch {}
        if (onLogout) onLogout();
        return;
      }
      if (text.includes("sign up") || text.includes("register") || target.id === "ecmd-auth-signup-trigger-btn") {
        changeMode("signup");
        setModalOpen(true);
      } else {
        changeMode("login");
        setModalOpen(true);
      }
    };
    trig.addEventListener("click", handleTriggerClick);
    return () => trig.removeEventListener("click", handleTriggerClick);
  }, [autoSwapLogout, loggedUser, onLogout]);

  const shouldShowTrigger = !hideTrigger && showTrigger;
  const combinedCardClass = [themeGroup && themeGroup !== "none" ? themeGroup : "", modalCardClassName || ""].filter(Boolean).join(" ") || undefined;

  const modalCard = (
    <div
      id="ecmd-auth-modal"
      ref={modalRef}
      className={combinedCardClass}
      style={{
        position: floatOverlay && !fixedBreakout ? "absolute" : "relative",
        top: floatOverlay && !fixedBreakout ? `calc(100% + ${gapBelowTrigger}px)` : undefined,
        right: floatOverlay && !fixedBreakout && alignModal === "right" ? 0 : undefined,
        left: floatOverlay && !fixedBreakout ? (alignModal === "left" ? 0 : alignModal === "center" ? "50%" : undefined) : undefined,
        transform: floatOverlay && !fixedBreakout && alignModal === "center" ? "translateX(-50%)" : undefined,
        marginTop: !floatOverlay ? `${gapBelowTrigger}px` : undefined,
        maxWidth: "calc(100vw - 24px)",
        zIndex: 9999,
        animation: isShaking ? "ecmdAuthShake 0.42s ease-in-out" : undefined
      }}
    >
      {showCloseIcon && (
        <div id="ecmd-auth-close-icon" onClick={() => { if (onCancel) onCancel(); setModalOpen(false); }} style={{ position: "absolute", top: "14px", right: "16px", cursor: "pointer", color: "#64748B", fontSize: "18px", lineHeight: 1 }}>
          {closeIcon ?? <DefaultNativeCloseIcon />}
        </div>
      )}
      {showHeader && <div id="ecmd-auth-title-slot" style={{ marginBottom: "12px", width: "100%" }}>{title ?? <DefaultNativeTitle />}</div>}
      <div id="ecmd-auth-body-slot" style={{ width: "100%", position: "relative" }}>{children ?? <DefaultNativeBody previewSuccessText={previewSuccessText} />}</div>
      {showFooter && <div id="ecmd-auth-footer-slot" style={{ marginTop: "16px", width: "100%" }}>{footer ?? <DefaultNativeFooter />}</div>}
    </div>
  );

  return (
    <div ref={rootRef} className={className} style={{ position: "relative", display: "inline-flex", flexDirection: "column", alignItems: alignModal === "right" ? "flex-end" : alignModal === "center" ? "center" : "flex-start" }}>
      <style>{`
        @keyframes ecmdAuthShake { 0%, 100% { transform: translateX(0); } 20%, 60% { transform: translateX(-7px); } 40%, 80% { transform: translateX(7px); } }
        :where(#ecmd-auth-modal) { width: ${modalWidth}; background-color: ${modalBackground}; color: #0F172A; border: 1.25px solid ${modalBorderColor}; border-radius: ${modalRadius}; padding: 24px; box-shadow: 0 20px 45px rgba(15, 23, 42, 0.22); box-sizing: border-box; }
        #ecmd-auth-modal.ecmd-group-1 #ecmd-auth-title-text, #ecmd-auth-modal.ecmd-group-2 #ecmd-auth-title-text, #ecmd-auth-modal.ecmd-group-3 #ecmd-auth-title-text, #ecmd-auth-modal.ecmd-group-4 #ecmd-auth-title-text,
        #ecmd-auth-modal.ecmd-group-1 #ecmd-auth-links-row *, #ecmd-auth-modal.ecmd-group-2 #ecmd-auth-links-row *, #ecmd-auth-modal.ecmd-group-3 #ecmd-auth-links-row *, #ecmd-auth-modal.ecmd-group-4 #ecmd-auth-links-row * { color: inherit !important; }
      `}</style>
      {shouldShowTrigger && (
        <div id="ecmd-auth-trigger-slot" ref={triggerRef} className={triggerSlotClassName} style={{ display: "inline-flex", alignItems: "center", cursor: "pointer" }}>
          {trigger ?? <DefaultNativeTrigger loggedOutText={loggedOutText} showSecondTrigger={showSecondTrigger} secondTriggerText={secondTriggerText} />}
        </div>
      )}
      {isOpen && (
        fixedBreakout ? (
          <div id="ecmd-auth-backdrop" onClick={(e) => { if (closeOnBackdropClick && e.target === e.currentTarget) { if (onCancel) onCancel(); setModalOpen(false); } }} style={{ position: "fixed", inset: 0, backgroundColor: dimBackdrop ? `rgba(15, 23, 42, ${dimOpacity})` : "transparent", backdropFilter: blurBackdrop && overlayBlurPx > 0 ? `blur(${overlayBlurPx}px)` : undefined, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "16px" }}>
            {modalCard}
          </div>
        ) : (
          <>
            {(dimBackdrop || blurBackdrop) && <div id="ecmd-auth-backdrop" onClick={() => { if (closeOnBackdropClick) { if (onCancel) onCancel(); setModalOpen(false); } }} style={{ position: "fixed", inset: 0, backgroundColor: dimBackdrop ? `rgba(15, 23, 42, ${dimOpacity})` : "transparent", backdropFilter: blurBackdrop && overlayBlurPx > 0 ? `blur(${overlayBlurPx}px)` : undefined, zIndex: 9998 }} />}
            {modalCard}
          </>
        )
      )}
    </div>
  );
}
