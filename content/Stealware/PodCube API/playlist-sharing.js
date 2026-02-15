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
                <span class="pc-share-label">Import Code</span>
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
     * THE "FANTASY" EXPORT:
     * Creates a single ClipboardItem containing BOTH the PNG Blob and the Text Blob.
     */
    exportToClipboard: async function(playlistName) {
        // Feature detection
        if (!window.html2canvas || !navigator.clipboard || !navigator.clipboard.write) {
             alert("Your browser doesn't support advanced clipboard features. Downloading image instead.");
             this.downloadImage(playlistName);
             return;
        }

        const exportData = PodCube.exportPlaylist(playlistName);
        if (!exportData) return;
        
        if (typeof logCommand !== 'undefined') logCommand(`// Initiating rich export for "${playlistName}"...`);

        // 1. Generate Image Blob
        const card = this.createCardElement(exportData);
        document.body.appendChild(card);
        await new Promise(r => setTimeout(r, 150)); // Render wait

        try {
            const canvas = await html2canvas(card, { 
                scale: 2, 
                backgroundColor: null, 
                useCORS: true,
                logging: false
            });
            
            // Generate PNG Blob
            const imageBlob = await new Promise(res => canvas.toBlob(res, 'image/png'));

            // 2. Generate Text Blob
            // We wrap the string in a Blob because strict implementations require it
            //const textBlob = new Blob([exportData.url], {type: 'text/plain'});

            // 3. Create the multi-MIME ClipboardItem
            // This is the magic key: one item, two representations
            const item = new ClipboardItem({
                "image/png": imageBlob,
                //"text/plain": textBlob
            });

            // 4. Write the combined item to the clipboard
            await navigator.clipboard.write([item]);
            
            if (typeof logCommand !== 'undefined') logCommand(`// EXPORT SUCCESS: PUNCHCARD ADDED TO YOUR CLIPBOARD.`);
            alert(":: PUNCHCARD ADDED TO CLIPBOARD.\n // PASTE ANYWHERE TO SHARE.\n // PASTE HERE TO IMPORT.\n // Thank you for choosing, or having already chosen, \nPodCube™");

        } catch (e) {
            console.error("Rich export failed", e);
            if (typeof logCommand !== 'undefined') logCommand(`// ERROR: Rich export failed. Falling back to download.`);
            this.downloadImage(playlistName);
        } finally {
            if (card.parentNode) card.parentNode.removeChild(card);
        }
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