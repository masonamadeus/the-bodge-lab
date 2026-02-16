const PlaylistSharing = {

    /**
     * Helper to build the invisible DOM element for the card.
     */
    createCardElement: function(exportData) {
        const card = document.createElement('div');
        card.className = 'pc-share-card-container';
        card.style.position = 'fixed';
        card.style.left = '-9999px'; 
        card.style.top = '0';
        card.style.zIndex = '-1'; 
        
        card.innerHTML = `
            <div class="pc-share-card-bg"></div>
            <div class="pc-share-header">PodCube™</div>
            <div class="pc-share-body">
                <div class="pc-share-title">${escapeHtml(exportData.name)}</div>
                <div class="pc-share-meta">${exportData.episodes.length} Transmissions</div>
                <div class="pc-share-qr-frame">
                    <div class="cardQrTarget"></div>
                </div>
            </div>
            <div class="pc-share-footer">
                <span class="pc-share-label">COPY/PASTE THIS IMAGE INTO POWEREDBYPODCUBE.COM</span>
                <div class="pc-share-code-box">${exportData.code}</div>
            </div>
        `;

        if (window.QRCode) {
            const qrDiv = card.querySelector('.cardQrTarget');
            new QRCode(qrDiv, {
                text: exportData.url,
                width: 200,
                height: 200,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });
        }
        
        return card;
    },

    /**
     * Open the sharing diagnostic panel
     */
    open: function(playlistName) {
        const exportData = PodCube.exportPlaylist(playlistName);
        
        if (!exportData) {
            alert("Could not export playlist. It may be empty or invalid.");
            return;
        }

        const panel = document.getElementById('sharingSectionPanel');
        const content = document.getElementById('sharingContent');
        
        if (!panel || !content) return;

        // Render the UI Panel
        content.innerHTML = `
    <div class="sharing-diagnostic-wrapper">
        <div class="card-preview-area">
             <div class="pc-share-card-container active-preview">
                <div class="pc-share-header">PodCube™ PUNCHCARD</div> <div class="pc-share-body">
                    <div class="pc-share-title">${escapeHtml(exportData.name)}</div>
                    <div id="qrPreviewContainer"></div>
                </div>
                <div class="pc-share-footer" onclick="copyToClipboard('shareCodeTarget')">
                    <span class="pc-share-label">CLICK TO COPY NANO-GUID</span>
                    <div class="pc-share-code-box" id="shareCodeTarget">${exportData.code}</div>
                </div>
             </div>
        </div>
        <div class="sharing-controls">
            <button class="hero-btn" onclick="PlaylistSharing.exportToClipboard('${escapeForAttribute(playlistName)}')">
                <strong>EXPORT PUNCHCARD</strong>
                <span>Copy Link & Card Image</span>
            </button>
            <button class="hero-btn" onclick="renamePlaylistUI('${escapeForAttribute(playlistName)}')">
                <strong>RECLASSIFY RECORD</strong>
                <span>Rename Punchcard</span>
            </button>
        </div>
    </div>
`;

        setTimeout(() => {
            const container = document.getElementById('qrPreviewContainer');
            if (container && window.QRCode) {
                container.innerHTML = '';
                new QRCode(container, {
                    text: exportData.url,
                    width: 150,
                    height: 150,
                    colorDark: "#1768da",
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.M
                });
            }
        }, 50);

        panel.style.display = 'block';
        panel.scrollIntoView({ behavior: 'smooth' });
    },


    /**
 * EXPORT: Image + Text to Clipboard with Visual Feedback
 */
exportToClipboard: async function(playlistName) {
    if (!window.html2canvas || !navigator.clipboard || !navigator.clipboard.write) {
         alert("Clipboard features unavailable. Downloading image instead.");
         this.downloadImage(playlistName);
         return;
    }

    const exportData = PodCube.exportPlaylist(playlistName);
    if (!exportData) return;

    // 1. IMMEDIATE UI FEEDBACK (Before heavy work)
    const cards = document.querySelectorAll('.pc-share-card-container');
    let targetCard = null;
    cards.forEach(c => {
        if (c.querySelector('.pc-share-title')?.textContent.trim() === playlistName) {
            targetCard = c;
        }
    });

    const btn = event?.currentTarget;
    const originalBtnText = btn ? btn.textContent : 'EXPORT';

    let overlay = null;
    if (targetCard) {
        overlay = document.createElement('div');
        overlay.className = 'pc-exporting-overlay';
        overlay.innerHTML = `
            <div class="pc-export-scanner-line"></div>
            <div class="pc-export-status-text">GENERATING PHYSICAL RECORD...</div>
        `;
        targetCard.appendChild(overlay);
    }
    
    if (btn) {
        btn.classList.add('is-exporting');
        btn.textContent = '...';
    }

    if (typeof logCommand !== 'undefined') logCommand(`// Initiating record generation for "${playlistName}"...`);

    // 2. DELAY HEAVY WORK: Wrap in setTimeout to let UI render the overlay first
    setTimeout(async () => {
        const cardElement = this.createCardElement(exportData);
        document.body.appendChild(cardElement);

        try {
            const canvas = await html2canvas(cardElement, { 
                scale: 2, 
                backgroundColor: "#ffffff",
                useCORS: true,
                logging: false
            });
            
            const imageBlob = await new Promise(res => canvas.toBlob(res, 'image/png'));
            const textBlob = new Blob([exportData.url], {type: 'text/plain'});

            const item = new ClipboardItem({ 
                "image/png": imageBlob,
                "text/plain": textBlob 
            });

            await navigator.clipboard.write([item]);
            
            if (typeof logCommand !== 'undefined') logCommand(`// EXPORT SUCCESS: PUNCHCARD ADDED TO CLIPBOARD.`);
            
            // 3. SUCCESS STATE: Hang on the "COPIED" screen for 3 seconds
            if (btn) btn.textContent = 'COPIED!';
            if (overlay) {
                overlay.querySelector('.pc-export-scanner-line').style.display = 'none';
                overlay.querySelector('.pc-export-status-text').innerHTML = `
                    COPIED TO CLIPBOARD.<br>
                    PASTE ANYWHERE TO SHARE.<br>
                    PASTE INTO PUNCH CARD READER TO UPLOAD.
                `;
                overlay.style.background = 'rgba(23, 104, 218, 0.9)'; // More solid blue on success
            }

            // Extended delay for readability
            setTimeout(() => cleanup(), 3500);

        } catch (e) {
            console.error("Rich export failed", e);
            if (btn) btn.textContent = 'FAILED';
            this.downloadImage(playlistName);
            cleanup();
        }

        function cleanup() {
            if (cardElement.parentNode) cardElement.parentNode.removeChild(cardElement);
            if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
            if (btn) {
                btn.classList.remove('is-exporting');
                btn.textContent = originalBtnText;
            }
        }
    }, 50); // Small 50ms delay is enough to let the browser paint the overlay
},

    /**
     * Fallback: Download the image as a file
     */
    downloadImage: async function(playlistName) {
        if (!window.html2canvas) {
             alert("Visualization library missing (html2canvas).");
             return;
        }
        const exportData = PodCube.exportPlaylist(playlistName);
        if (!exportData) return;

        const card = this.createCardElement(exportData);
        document.body.appendChild(card);
        
        await new Promise(r => setTimeout(r, 150));

        try {
            const canvas = await html2canvas(card, { scale: 2, backgroundColor: null, useCORS: true });
            const link = document.createElement('a');
            link.download = `PodCube_Card_${playlistName.replace(/\s+/g, '_')}.png`;
            link.href = canvas.toDataURL("image/png");
            link.click();
        } catch (e) {
            console.error("Download failed", e);
        } finally {
            if (card.parentNode) card.parentNode.removeChild(card);
        }
    }
};

window.showPlaylistSharing = PlaylistSharing.open;