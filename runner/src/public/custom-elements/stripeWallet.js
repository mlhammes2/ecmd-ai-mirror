// custom-elements/stripeWallet.js

class StripeWallet extends HTMLElement {
    constructor() {
        super();
        this.clientSecret = null;
        this.publishableKey = null;
        this.walletType = null; 
        this.isInitialized = false; 
    }

    connectedCallback() {
        console.log("📌 [STRIPE_WALLET -> connectedCallback]: Connected to DOM.");
        this.container = document.createElement('div');
        this.container.style.width = '100%';
        this.container.style.height = '100%';
        this.appendChild(this.container);
    }

    static get observedAttributes() {
        return ['client-secret', 'publishable-key', 'wallet-type'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        console.log(`📌 [STRIPE_WALLET -> attributeChangedCallback]: Received attribute '${name}'`);
        
        if (name === 'client-secret') {
            this.clientSecret = newValue;
            if (!newValue) this.isInitialized = false;
        }
        if (name === 'publishable-key') this.publishableKey = newValue;
        if (name === 'wallet-type') this.walletType = newValue;

        if (this.clientSecret && this.publishableKey && this.walletType && !this.isInitialized) {
            console.log(`📌 [STRIPE_WALLET -> attributeChangedCallback]: Initializing Stripe for walletType='${this.walletType}'...`);
            this.isInitialized = true;
            this.initializeStripe();
        }
    }

    async initializeStripe() {
        try {
            if (!window.Stripe) {
                console.log("📌 [STRIPE_WALLET -> initializeStripe]: Loading Stripe.js v3 SDK...");
                await new Promise((resolve, reject) => {
                    const script = document.createElement('script');
                    script.src = 'https://js.stripe.com/v3/';
                    script.onload = resolve;
                    script.onerror = reject;
                    document.head.appendChild(script);
                });
            }

            const stripe = window.Stripe(this.publishableKey);
            const elements = stripe.elements({
                clientSecret: this.clientSecret,
                appearance: { theme: 'flat' }
            });

            const walletConfig = {
                paymentMethods: {
                    applePay: this.walletType === 'apple_pay' ? 'always' : 'never',
                    googlePay: this.walletType === 'google_pay' ? 'always' : 'never',
                    link: 'never'
                }
            };

            const expressCheckout = elements.create('expressCheckout', walletConfig);
            expressCheckout.mount(this.container);

            expressCheckout.on('ready', ({ availablePaymentMethods }) => {
                console.log("📌 [STRIPE_WALLET -> ready]: Available methods:", availablePaymentMethods);
                window.__ECMD_STRIPE_WALLET_STATE__ = {
                    walletType: this.walletType,
                    availablePaymentMethods: availablePaymentMethods || null,
                    updatedAt: new Date().toISOString()
                };
                
                let isSupported = false;
                if (this.walletType === 'apple_pay' && availablePaymentMethods && availablePaymentMethods.applePay) {
                    isSupported = true;
                }
                if (this.walletType === 'google_pay' && availablePaymentMethods && availablePaymentMethods.googlePay) {
                    isSupported = true;
                }

                if (!isSupported) {
                    let prettyName = this.walletType === 'apple_pay' ? 'Apple Pay' : 'Google Pay';
                    console.warn(`📌 [STRIPE_WALLET -> ready]: ${prettyName} not supported on this device/browser.`);
                    this.dispatchEvent(new CustomEvent('walletError', {
                        detail: `${prettyName} is not supported or not configured on this device.`
                    }));
                } else {
                    this.dispatchEvent(new CustomEvent('walletReady'));
                }
            });

            expressCheckout.on('confirm', async () => {
                console.log(`📌 [STRIPE_WALLET -> confirm]: Confirming ${this.walletType} payment...`);
                const { error } = await stripe.confirmPayment({
                    elements,
                    clientSecret: this.clientSecret,
                    confirmParams: { return_url: "https://www.ecmdutah.com" },
                });

                if (error) {
                    console.error("📌 [STRIPE_WALLET -> confirmError]:", error.message);
                    this.dispatchEvent(new CustomEvent('walletError', { detail: error.message }));
                }
            });
        } catch (err) {
            console.error("📌 [STRIPE_WALLET -> initializeStripeError]:", err);
            this.dispatchEvent(new CustomEvent('walletError', { detail: err.message || "Stripe initialization error" }));
        }
    }
}

customElements.define('stripe-wallet', StripeWallet);