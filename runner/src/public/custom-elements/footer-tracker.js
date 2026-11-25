// --- public/custom-elements/footer-tracker.js ---

class FooterTracker extends HTMLElement {
    static get observedAttributes() {
        return ['open-file-picker', 'capture-css-now'];
    }

    connectedCallback() {
        console.log("📌 [FOOTER_TRACKER -> connectedCallback]: Observing .my-custom-footer height & live spatial DOM/CSS.");

        const updateHeight = () => {
            const footer = document.querySelector('.my-custom-footer');
            if (footer) {
                const height = footer.offsetHeight;
                document.documentElement.style.setProperty('--footer-height', `${height}px`);
            }
        };

        const getScreenZone = (rect, vw, vh) => {
            if (!rect || rect.width === 0 || rect.height === 0) return "Hidden / Off-Screen (0x0)";
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            const vPos = rect.top < 110 ? "Top Header" : (cy > vh * 0.82 ? "Bottom Footer/Bar" : (cy < vh * 0.45 ? "Upper-Middle" : "Lower-Middle"));
            const hPos = cx < vw * 0.33 ? "Left" : (cx > vw * 0.66 ? "Right" : "Center");
            return `${vPos} (${hPos})`;
        };

        const captureComputedCssSnapshot = () => {
            try {
                const vw = window.innerWidth || 1280;
                const vh = window.innerHeight || 800;
                const allNodes = Array.from(document.querySelectorAll('[id], button, nav, [role="navigation"], [data-mesh-id]')).slice(0, 260);

                const snap = allNodes.map(el => {
                    const cs = window.getComputedStyle(el);
                    const rect = el.getBoundingClientRect();
                    const rawText = (el.innerText || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 80);
                    const ariaLabel = el.getAttribute("aria-label") || el.getAttribute("title") || "";
                    const isVisible = cs.display !== "none" && cs.visibility !== "hidden" && parseFloat(cs.opacity || "1") > 0.02 && rect.width > 0 && rect.height > 0;

                    return {
                        domId: el.id || "",
                        tag: el.tagName,
                        role: el.getAttribute("role") || "",
                        labelOrText: rawText || ariaLabel,
                        isVisibleOnScreen: isVisible,
                        screenZone: getScreenZone(rect, vw, vh),
                        bounds: {
                            x: Math.round(rect.left),
                            y: Math.round(rect.top),
                            width: Math.round(rect.width),
                            height: Math.round(rect.height)
                        },
                        display: cs.display,
                        position: cs.position,
                        backgroundColor: cs.backgroundColor,
                        color: cs.color,
                        fontSize: cs.fontSize,
                        fontWeight: cs.fontWeight,
                        borderRadius: cs.borderRadius,
                        border: cs.border
                    };
                });

                window.__ECMD_COMPUTED_CSS_SNAPSHOT__ = snap;
                this.dispatchEvent(new CustomEvent('cssSnapshotReady', { detail: { snapshot: snap, viewport: { vw, vh } } }));
            } catch (e) {}
        };

        this._captureSnapshot = captureComputedCssSnapshot;
        updateHeight();
        setTimeout(captureComputedCssSnapshot, 1200);
        window.addEventListener('resize', updateHeight);

        const observer = new MutationObserver(() => {
            updateHeight();
        });
        observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'open-file-picker' && newValue && newValue !== oldValue) {
            this.openNativeFilePicker();
        }
        if (name === 'capture-css-now' && newValue && newValue !== oldValue && this._captureSnapshot) {
            this._captureSnapshot();
        }
    }

    openNativeFilePicker() {
        try {
            const input = document.createElement('input');
            input.type = 'file';
            input.multiple = true;
            input.accept = '.js,.jsw,.txt,.css,.json,.config';
            input.style.display = 'none';

            input.onchange = async () => {
                const files = Array.from(input.files || []);
                const out = [];
                for (const f of files) {
                    const text = await f.text();
                    out.push({
                        fileName: f.name,
                        veloSourceCode: text
                    });
                }
                if (document.body.contains(input)) {
                    document.body.removeChild(input);
                }
                this.dispatchEvent(new CustomEvent('filesSelected', {
                    detail: { files: out }
                }));
            };

            document.body.appendChild(input);
            input.click();
        } catch (err) {
            this.dispatchEvent(new CustomEvent('filesSelected', {
                detail: { files: [], error: err.message }
            }));
        }
    }
}

customElements.define('footer-tracker', FooterTracker);
