import { PodCubeScreen } from '../classes/PodCube_Screen.js';

export class SC_IFRAME extends PodCubeScreen {
    constructor(screenInstance, url) {
        super(screenInstance);
        this.repositionIframeBound = this.repositionIframe.bind(this);
        this.slideIndex = 1;
    }

    onInit() {
        this.createIframes();
        this.defineContexts();

        window.addEventListener('resize', this.repositionIframeBound);
        this.repositionIframeBound();

        PodCube.hideBackdrop();
    }

    destroy() {
        window.removeEventListener('resize', this.repositionIframeBound);
        [this.currentIframe, this.prevIframe, this.nextIframe].forEach(iframe => {
            iframe?.remove();
        });
        this.currentIframe = this.prevIframe = this.nextIframe = null;
        super.destroy?.();
    }

    createIframes() {
        const container = document.getElementById("dom_overlay_container");
        if (!container) return;

        // Create and append three iframes
        this.currentIframe = this.makeIframe();
        this.prevIframe = this.makeIframe(true);
        this.nextIframe = this.makeIframe(true);

        container.appendChild(this.currentIframe);
        container.appendChild(this.prevIframe);
        container.appendChild(this.nextIframe);

        this.updateAllIframes();
    }

    makeIframe(hidden = false) {
        const iframe = document.createElement("iframe");
        iframe.style.position = "absolute";
        iframe.style.border = "2px dashed green";
        iframe.style.zIndex = hidden ? "-2" : "-1";
        iframe.style.opacity = hidden ? "0" : "1";
        iframe.style.pointerEvents = hidden ? "none" : "auto";
        iframe.style.transition = "opacity 0.4s ease-in-out"
        return iframe;
    }

    updateAllIframes() {
        const baseUrl = this.symbol.url.split('#')[0];

        this.currentIframe.src = `${baseUrl}#slide=${this.slideIndex}`;
        this.prevIframe.src = `${baseUrl}#slide=${Math.max(1, this.slideIndex - 1)}`;
        this.nextIframe.src = `${baseUrl}#slide=${this.slideIndex + 1}`;
    }

   swapToSlide(newIndex) {
    if (newIndex === this.slideIndex) return;

    const baseUrl = this.symbol.url.split('#')[0];
    const goingForward = newIndex > this.slideIndex;

    const fadeOut = this.currentIframe;
    const fadeIn = goingForward ? this.nextIframe : this.prevIframe;

    // Fade out current
    fadeOut.style.opacity = "0";
    setTimeout(() => {
        fadeOut.style.zIndex = "-2";
        fadeOut.style.pointerEvents = "none";
    }, 400);

    // Fade in new
    fadeIn.style.opacity = "1";
    fadeIn.style.zIndex = "-1";
    fadeIn.style.pointerEvents = "auto";

    // Rotate references
    if (goingForward) {
        const temp = this.prevIframe;
        this.prevIframe = this.currentIframe;
        this.currentIframe = this.nextIframe;
        this.nextIframe = temp;

        // Reset new next
        this.nextIframe.src = `${baseUrl}#slide=${newIndex + 1}`;
        this.nextIframe.style.opacity = "0";
        this.nextIframe.style.zIndex = "-2";
        this.nextIframe.style.pointerEvents = "none";
    } else {
        const temp = this.nextIframe;
        this.nextIframe = this.currentIframe;
        this.currentIframe = this.prevIframe;
        this.prevIframe = temp;

        // Reset new prev
        this.prevIframe.src = `${baseUrl}#slide=${Math.max(1, newIndex - 1)}`;
        this.prevIframe.style.opacity = "0";
        this.prevIframe.style.zIndex = "-2";
        this.prevIframe.style.pointerEvents = "none";
    }

    this.slideIndex = newIndex;
    this.repositionIframe();
}


    nextSlide() {
        this.swapToSlide(this.slideIndex + 1);
    }

    prevSlide() {
        if (this.slideIndex > 1) {
            this.swapToSlide(this.slideIndex - 1);
        }
    }

    defineContexts() {
        this.defineContext("Iframe:Controls", {
            up: { hint: "Previous", handler: () => this.prevSlide() },
            down: { hint: "Next", handler: () => this.nextSlide() },
            left: { hint: "Previous", handler: () => this.prevSlide() },
            right: { hint: "Next", handler: () => this.nextSlide() },
            yes: {
                hint: "Main Menu", handler: () => PodCube.MSG.pub("Navigate-Screen",
                    {
                        linkageName: "SC_MAIN"
                    })
            },
            no: { hint: "Error", handler: () => this.sendKeyEventToIframe('c') },
        });
        this.switchContext("Iframe:Controls");
    }



    repositionIframe() {
        const canvasEl = document.getElementById("canvas");
        const domOverlayContainer = document.getElementById("dom_overlay_container");
        const animationContainer = document.getElementById("animation_container");

        if (!canvasEl || !domOverlayContainer || !animationContainer) return;
        const region1 = exportRoot.region_1;
        if (!region1) return;

        const movieClipSize = 900;
        const r1x_stage = region1.x;
        const r1y_stage = region1.y;
        const r1w_stage = movieClipSize;
        const r1h_stage = movieClipSize;

        const canvasRect = canvasEl.getBoundingClientRect();
        const overlayRect = domOverlayContainer.getBoundingClientRect();

        if (canvasEl.width === 0 || canvasEl.height === 0) return;

        const scaleX = canvasRect.width / canvasEl.width;
        const scaleY = canvasRect.height / canvasEl.height;

        const region1ScaledXoffset = r1x_stage * scaleX;
        const region1ScaledYoffset = r1y_stage * scaleY;
        const region1ViewportX = canvasRect.left + region1ScaledXoffset;
        const region1ViewportY = canvasRect.top + region1ScaledYoffset;
        const iframeLeft = region1ViewportX - overlayRect.left;
        const iframeTop = region1ViewportY - overlayRect.top;

        const iframeWidth = r1w_stage * scaleX;
        const iframeHeight = r1h_stage * scaleY;

        const desiredScaleFactor = 0.98;
        const finalWidth = iframeWidth * desiredScaleFactor;
        const finalHeight = iframeHeight * desiredScaleFactor;
        const finalX = iframeLeft + (iframeWidth - finalWidth) / 2;
        const finalY = iframeTop + (iframeHeight - finalHeight) / 2;

        const setStyle = iframe => {
            iframe.style.left = `${finalX}px`;
            iframe.style.top = `${finalY}px`;
            iframe.style.width = `${finalWidth}px`;
            iframe.style.height = `${finalHeight}px`;
        };

        [this.currentIframe, this.prevIframe, this.nextIframe].forEach(setStyle);
    }
}