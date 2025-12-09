---
title: Favicon Editor
layout: layout.njk
uid: favicon-editor
directory: false
download: false
contentHash: c3c16b7a
date: '2025-12-09T19:23:32.800Z'
---

## Edit Your Favicon
Click pixels to paint. Right-click to erase.
<div class="editor-ui">
    
    <div class="editor-controls">
        <div class="control-group">
            <label>Color</label>
            <input type="color" id="paint-color">
        </div>
        
        <div class="control-group">
            <label>Opacity</label>
            <input type="range" id="paint-opacity" min="0.1" max="1.0" step="0.1" value="1.0">
        </div>

        <div class="control-group">
            <label>Actions</label>
            <button id="btn-random" class="editor-btn">REROLL</button>
            <button id="btn-clear" class="editor-btn">CLEAR</button>
        </div>
    </div>

    <div id="pixel-grid" class="pixel-grid"></div>

    <p style="text-align:center; font-size:0.8em; color:var(--text-muted); margin-top:1em;">
        Changes save automatically. Check your tab bar!
    </p>
</div>

<style>
/* Editor Styles */
.editor-ui {
    background: var(--bg-muted);
    padding: 2em;
    border: 1px solid var(--border-color);
    max-width: 500px;
    margin: 0 auto;
}

.editor-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 1.5em;
    margin-bottom: 2em;
    justify-content: center;
    border-bottom: 1px dashed var(--border-color);
    padding-bottom: 1em;
}

.control-group {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5em;
}


.pixel-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    
    /* FIX: Force rows to fill the height */
    grid-template-rows: repeat(5, 1fr); 
    
    gap: 2px;
    width: 250px;
    height: 250px;
    margin: 0 auto;
    background-color: var(--border-color);
    border: 2px solid var(--text-color);
}

.pixel {
    background-color: var(--bg-color);
    cursor: pointer;
    transition: transform 0.1s;
}
.pixel:hover { transform: scale(0.9); }

.editor-btn {
    background: var(--bg-color);
    border: 1px solid var(--border-color);
    padding: 5px 10px;
    cursor: pointer;
    font-family: var(--mono-font);
    font-size: 0.8em;
}
.editor-btn:hover, .editor-btn.active {
    background: var(--accent-color);
    color: white;
}
</style>

<script>

function hslToHex(h, s, l) {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

document.addEventListener('DOMContentLoaded', () => {
    const gridEl = document.getElementById('pixel-grid');
    const colorInput = document.getElementById('paint-color');
    const alphaInput = document.getElementById('paint-opacity');
    
    // Global State
    let identity = window.BodgeIdentity ? window.BodgeIdentity.data : { hue: 0, grid: [] };
    let useThemeColor = true;
    const startHex = hslToHex(identity.hue, 70, 50);
    colorInput.value = startHex;

    // --- RENDER GRID ---
    function renderGrid() {
        gridEl.innerHTML = '';
        
        // Base Theme Colors for preview
        const cPreview = `hsl(${identity.hue}, 70%, 50%)`;

        for(let i=0; i<25; i++) {
            const px = identity.grid[i];
            const div = document.createElement('div');
            div.className = 'pixel';
            div.dataset.index = i;
            
            if (px) {
                // If custom color, use it. Else use theme preview.
                div.style.backgroundColor = px.c || cPreview;
                div.style.opacity = px.o;
            } else {
                div.style.backgroundColor = 'transparent';
            }

            // Events
            div.onmousedown = (e) => handlePaint(i, e);
            div.onmouseenter = (e) => { if(e.buttons === 1) handlePaint(i, e); };
            // Right click to erase
            div.oncontextmenu = (e) => { e.preventDefault(); handlePaint(i, e, true); };

            gridEl.appendChild(div);
        }
    }

    // --- PAINT LOGIC ---
    function handlePaint(index, e, forceErase = false) {
        if (forceErase || e.button === 2) {
            // Eraser
            identity.grid[index] = null;
        } else {
            // Brush
            const opacity = alphaInput.value;
            const pixelData = { o: opacity };
            
            if (!useThemeColor) {
                pixelData.c = colorInput.value;
            }
            // If theme color, we just omit 'c' property
            
            identity.grid[index] = pixelData;
        }
        
        // Update UI
        renderGrid();
        // Update Real Favicon
        updateFavicon();
        // Save
        window.BodgeIdentity.save(identity);
    }

    // --- UPDATE REAL FAVICON ---
    function updateFavicon() {
        // We essentially re-run the logic from layout.njk
        
        const cLight = `hsl(${identity.hue}, 80%, 40%)`;
        const cDark  = `hsl(${identity.hue}, 80%, 70%)`;
        
        let rects = '';
        identity.grid.forEach((pixel, i) => {
            if (!pixel) return;
            const x = i % 5;
            const y = Math.floor(i / 5);
            // inline styles for the editor update to ensure immediate feedback
            // (Media queries inside data-uri SVGs can be tricky on some updates, but we try)
            const fillAttr = pixel.c ? `fill="${pixel.c}"` : `class="themable"`;
            rects += `<rect x="${x}" y="${y}" width="1" height="1" opacity="${pixel.o}" ${fillAttr} />`;
        });

        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5 5" shape-rendering="crispEdges">
            <style>
                .themable { fill: ${cLight}; }
                @media (prefers-color-scheme: dark) { .themable { fill: ${cDark}; } }
                text { fill: black; font-weight: 900; pointer-events: none; }
                @media (prefers-color-scheme: dark) { text { fill: white; } }
            <\/style>
            ${rects}
            <text x="2.5" y="3.5" text-anchor="middle" font-family="monospace" font-size="3px"></text>
        </svg>`;

        const link = document.getElementById('dynamic-favicon');
        if(link) link.href = 'data:image/svg+xml,' + encodeURIComponent(svg);
    }

    // --- CONTROLS ---

    colorInput.oninput = () => {
        useThemeColor = false;
        btnTheme.classList.remove('active');
        colorInput.parentElement.style.opacity = '1';
    };

    document.getElementById('btn-clear').onclick = () => {
        identity.grid = new Array(25).fill(null);
        renderGrid();
        updateFavicon();
        window.BodgeIdentity.save(identity);
    };

    document.getElementById('btn-random').onclick = () => {
        // Nuke local storage key and reload to trigger the layout.njk genesis script
        localStorage.removeItem('bodge-id-v1');
        window.location.reload();
    };

    // Init
    renderGrid();
});
</script>
