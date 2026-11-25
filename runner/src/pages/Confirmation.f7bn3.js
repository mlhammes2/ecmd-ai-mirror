// ---- Confirmation Page Code ----

import wixLocationFrontend from 'wix-location-frontend';
import wixWindowFrontend from 'wix-window-frontend';
import { initAiTelemetry, registerModuleState, registerDomElements } from 'public/aiTelemetry';
import { verifyEmailInDB } from 'backend/authBackend.jsw'; 

let verificationStatus = "idle";

$w.onReady(function () {
    if ($w("#statusText2").id) $w("#statusText2").hide();

    if (wixWindowFrontend.rendering.env !== "browser") return;

    initAiTelemetry($w);

    let query = wixLocationFrontend.query;
    let userId = query.verify;

    registerModuleState("confirmationPage", () => ({
        url: wixLocationFrontend.url,
        verifyTokenUserId: userId || null,
        verificationStatus,
        statusText: $w("#statusText").id ? $w("#statusText").text : null
    }));

    registerDomElements({
        boxes: ["#statusText", "#statusText2"]
    });

    if (userId) {
        verificationStatus = "verifying";
        console.log(`📌 [CONFIRMATION_PAGE -> onReady]: Starting email verification for userId=${userId}`);

        let dotCount = 0;
        let loadingInterval = setInterval(() => {
            dotCount = (dotCount + 1) % 4;
            let dots = ".".repeat(dotCount);
            if ($w("#statusText").id) $w("#statusText").text = "VERIFYING YOUR EMAIL" + dots;
        }, 400);

        verifyEmailInDB(userId).then((success) => {
            clearInterval(loadingInterval); 
            
            if (success) {
                verificationStatus = "confirmed";
                console.log(`📌 [CONFIRMATION_PAGE -> verifyEmailInDB]: Email confirmed for userId=${userId}`);
                if ($w("#statusText").id) $w("#statusText").text = "YOUR EMAIL HAS BEEN CONFIRMED!";
                if ($w("#statusText2").id) $w("#statusText2").show("fade", { duration: 300 });
                wixLocationFrontend.queryParams.remove(["verify"]);
            } else {
                verificationStatus = "invalid_or_expired";
                console.warn(`📌 [CONFIRMATION_PAGE -> verifyEmailInDB]: Verification returned false for userId=${userId}`);
                if ($w("#statusText").id) $w("#statusText").text = "We couldn't verify this link. It may have expired.";
            }
        }).catch((err) => {
            clearInterval(loadingInterval); 
            verificationStatus = "error";
            console.error("📌 [CONFIRMATION_PAGE -> verifyEmailInDB]: Error:", err);
            if ($w("#statusText").id) $w("#statusText").text = "An error occurred. Please try again.";
        });
    } else {
        verificationStatus = "missing_token";
        console.warn("📌 [CONFIRMATION_PAGE -> onReady]: No ?verify= token found in URL.");
        if ($w("#statusText").id) $w("#statusText").text = "No verification token found.";
    }
});