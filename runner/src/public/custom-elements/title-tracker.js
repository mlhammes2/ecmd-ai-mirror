// custom-elements/title-tracker.js

class TitleTracker extends HTMLElement {
    connectedCallback() {
        setTimeout(() => {
            const smallTitle = document.querySelector('.my-small-title');
            if (!smallTitle) {
                console.log("📌 [TITLE_TRACKER -> connectedCallback]: .my-small-title not found on this view.");
                return;
            }

            const observer = new ResizeObserver(entries => {
                for (let entry of entries) {
                    const h = `${entry.contentRect.height}px`;
                    document.documentElement.style.setProperty('--title-height', h);
                    window.__ECMD_TITLE_HEIGHT__ = h;
                }
            });
            observer.observe(smallTitle);
            console.log("📌 [TITLE_TRACKER -> connectedCallback]: Observing .my-small-title height.");
        }, 500);
    }
}
customElements.define('title-tracker', TitleTracker);