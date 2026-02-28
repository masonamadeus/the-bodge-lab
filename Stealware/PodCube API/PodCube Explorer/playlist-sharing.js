const PlaylistSharing = {

    /**
     * Helper to build the invisible DOM element for the card.
     */
    createCardElement: function(exportData) {
        const card = document.createElement('div');
        card.className = 'pc-share-card-container';
        
        // FIX: Use absolute positioning at 0,0 with deep negative z-index
        // This prevents viewport clipping issues common with 'fixed' off-screen elements
        card.style.position = 'absolute';
        card.style.left = '-9999px'; 
        card.style.top = '-9999px';
        card.style.zIndex = '-9999px'; 
        
        // Force width to match CSS
        card.style.width = '400px'; 
        
        card.innerHTML = `
            <div class="pc-share-card-bg"></div>
            <div class="pc-share-header">PodCube™</div>
            <div class="pc-share-body">
                <div class="pc-share-title">${escapeHtml(exportData.name)}</div>
                <div class="pc-share-meta">${exportData.episodes.length} Transmissions</div>
                <div class="pc-share-meta">Duration: ${formatTime(exportData.totalDuration)}</div>
                <div class="pc-share-qr-frame">
                    <div class="cardQrTarget"></div>
                </div>
            </div>
            <div class="pc-share-footer">
                <span class="pc-share-label">COPY/PASTE THIS CARD INTO BODGELAB.COM/S/PODCUBE</span>
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
     * ROBUST PUNCH: Creates a new canvas and clips the image to the specific shape.
     * CSS Reference: clip-path: polygon(0 0, calc(100% - 100px) 0, 100% 125px, 100% 100%, 0 100%);
     */
    reshapeCanvas: function(sourceCanvas) {
        // Config
        const padding = 40; 
        const shadowBlur = 25;
        
        // 1. Setup Destination Canvas
        const canvas = document.createElement('canvas');
        canvas.width = sourceCanvas.width + (padding * 2);
        canvas.height = sourceCanvas.height + (padding * 2);
        const ctx = canvas.getContext('2d');

        const x = padding;
        const y = padding;
        const w = sourceCanvas.width;
        const h = sourceCanvas.height;
        
        // Cut Size (Scale 2x)
        const cutW = 125 * 2; 
        const cutH = 125 * 2; 

        // 2. DEFINE THE SHAPE PATH
        // We reuse this path for both the shadow and the clip
        ctx.beginPath();
        ctx.moveTo(x, y);                   // Top Left
        ctx.lineTo(x + w - cutW, y);        // Top Edge (Start of Cut)
        ctx.lineTo(x + w, y + cutH);        // Right Edge (End of Cut)
        ctx.lineTo(x + w, y + h);           // Bottom Right
        ctx.lineTo(x, y + h);               // Bottom Left
        ctx.closePath();

        // 3. DRAW SHADOW (Before Clipping)
        ctx.save();
        ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
        ctx.shadowBlur = shadowBlur;
        ctx.shadowOffsetX = 12;
        ctx.shadowOffsetY = 12;
        ctx.fillStyle = "#ffffff";
        ctx.fill(); // Draws the white shape + shadow
        ctx.restore();

        // 4. CLIP & DRAW CONTENT
        // Anything drawn after this will be confined to the shape
        ctx.save();
        ctx.clip(); 
        ctx.drawImage(sourceCanvas, x, y);
        ctx.restore(); // Release the clip so we can draw the border on top

        // 5. DRAW BORDER
        // We redraw the path just to stroke the line
        ctx.beginPath();
        ctx.moveTo(x + w - cutW, y+4);      // Start of cut
        ctx.lineTo(x + w-4, y + cutH);      // End of cut
        
        ctx.lineWidth = 8;               // 16px (matches CSS 8px visual at 2x scale)
        ctx.strokeStyle = "#1768da";
        ctx.lineCap = "round";
        ctx.stroke();

        return canvas;
    },

    open: function(playlistName) {
        const exportData = PodCube.exportPlaylist(playlistName);
        if (!exportData) {
            alert("Could not export playlist. It may be empty or invalid.");
            return;
        }

        const panel = document.getElementById('sharingSectionPanel');
        const content = document.getElementById('sharingContent');
        if (!panel || !content) return;

        content.innerHTML = `
            <div class="sharing-diagnostic-wrapper">
                <div class="card-preview-area">
                     <div class="pc-share-card-container active-preview">
                        <div class="pc-share-header">PodCube™ PUNCHCARD</div>
                        <div class="pc-share-body">
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
                    colorDark: "#000000",
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.M
                });
            }
        }, 50);

        panel.style.display = 'block';
        panel.scrollIntoView({ behavior: 'smooth' });
    },

    exportToClipboard: async function(playlistName) {
        if (!window.html2canvas || !navigator.clipboard || !navigator.clipboard.write) {
             alert("Clipboard features unavailable. Downloading image instead.");
             this.downloadImage(playlistName);
             return;
        }

        const exportData = PodCube.exportPlaylist(playlistName);
        if (!exportData) return;

        // UI Feedback (Scanning Line)
        const cards = document.querySelectorAll('.pc-share-card-container');
        let targetCard = null;
        cards.forEach(c => {
            if (c.querySelector('.pc-share-title')?.textContent.trim() === playlistName) targetCard = c;
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

        // Delay to allow UI render
        setTimeout(async () => {
            const cardElement = this.createCardElement(exportData);
            document.body.appendChild(cardElement);

            try {
                // 1. Capture Raw Square
                const rawCanvas = await html2canvas(cardElement, { 
                    scale: 2, 
                    backgroundColor: null, 
                    useCORS: true,
                    logging: false,
                    scrollX: 0, // Force top-left capture
                    scrollY: 0
                });

                // 2. Apply The Geometry (Reshape)
                const finalCanvas = this.reshapeCanvas(rawCanvas);
                
                const imageBlob = await new Promise(res => finalCanvas.toBlob(res, 'image/png'));
                const textBlob = new Blob([exportData.url], {type: 'text/plain'});

                const item = new ClipboardItem({ 
                    "image/png": imageBlob,
                    "text/plain": textBlob 
                });

                await navigator.clipboard.write([item]);

                // Track punchcard export for achievements
                if (window.PodUser) window.PodUser.logPunchcardExport();
                
                if (typeof logCommand !== 'undefined') logCommand(`// EXPORT SUCCESS: PUNCHCARD ADDED TO CLIPBOARD.`);
                
                if (btn) btn.textContent = 'COPIED!';
                if (overlay) {
                    overlay.querySelector('.pc-export-scanner-line').style.display = 'none';
                    overlay.querySelector('.pc-export-status-text').innerHTML = `
                        COPIED TO CLIPBOARD.<br>
                        PASTE ANYWHERE TO SHARE.<br>
                        PASTE INTO PUNCH CARD READER TO UPLOAD.
                    `;
                    overlay.style.background = 'rgba(23, 104, 218, 0.9)';
                }

                setTimeout(() => {
                    if (cardElement.parentNode) cardElement.parentNode.removeChild(cardElement);
                    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
                    if (btn) {
                        btn.classList.remove('is-exporting');
                        btn.textContent = originalBtnText;
                    }
                }, 3500);

            } catch (e) {
                console.error("Rich export failed", e);
                if (btn) btn.textContent = 'FAILED';
                this.downloadImage(playlistName);
                if (cardElement.parentNode) cardElement.parentNode.removeChild(cardElement);
                if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
            }
        }, 50);
    },

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
            const rawCanvas = await html2canvas(card, { 
                scale: 2, 
                backgroundColor: null, 
                useCORS: true,
                scrollX: 0,
                scrollY: 0
            });

            // Apply Punch
            const finalCanvas = this.reshapeCanvas(rawCanvas);
            
            const link = document.createElement('a');
            link.download = `PodCube_Card_${playlistName.replace(/\s+/g, '_')}.png`;
            link.href = finalCanvas.toDataURL("image/png");
            link.click();

            // Track punchcard export for achievements
            if (window.PodUser) PodUser.logPunchcardExport();
        } catch (e) {
            console.error("Download failed", e);
        } finally {
            if (card.parentNode) card.parentNode.removeChild(card);
        }
    }
};

window.showPlaylistSharing = PlaylistSharing.open;