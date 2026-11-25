// custom-elements/height-tracker.js

class HeightTracker extends HTMLElement {
    connectedCallback() {
        requestAnimationFrame(() => {
            const header = document.querySelector('.my-native-header');
            if (!header) {
                console.log("📌 [HEIGHT_TRACKER -> connectedCallback]: .my-native-header not found on this view.");
                return;
            }

            const observer = new ResizeObserver(entries => {
                for (let entry of entries) {
                    const h = `${entry.contentRect.height}px`;
                    document.documentElement.style.setProperty('--header-height', h);
                    window.__ECMD_HEADER_HEIGHT__ = h;
                }
                if (typeof window.__ECMD_SCAN_BROWSER_DOM__ === "function") {
                    window.__ECMD_SCAN_BROWSER_DOM__();
                }
            });
            observer.observe(header);
            console.log("📌 [HEIGHT_TRACKER -> connectedCallback]: Observing .my-native-header height.");
        });
    }
}
customElements.define('height-tracker', HeightTracker);