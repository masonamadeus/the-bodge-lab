/* =========================================
   TIMER ENGINE
   ========================================= */

let countdownInterval = null;
let totalSeconds = 0;
let remainingSeconds = 0;

export function startTimer(minutes) {
    stopTimer(); 
    totalSeconds = minutes * 60;
    remainingSeconds = totalSeconds;
    dispatchTick();

    countdownInterval = setInterval(() => {
        remainingSeconds--;
        if (remainingSeconds <= 0) {
            stopTimer();
            dispatchTick(); 
            dispatchComplete();
        } else {
            dispatchTick();
        }
    }, 1000);
}

export function stopTimer() {
    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = null;
}

// Added 'export' here
export function formatTime(seconds) {
    if (seconds < 0) seconds = 0;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    const mStr = m < 10 ? "0" + m : m;
    const sStr = s < 10 ? "0" + s : s;
    
    if (h > 0) return `${h}:${mStr}:${sStr}`;
    return `${mStr}:${sStr}`;
}

// --- Internal Helpers ---
function dispatchTick() {
    window.dispatchEvent(new CustomEvent('timerTick', { 
        detail: { 
            seconds: remainingSeconds, 
            formatted: formatTime(remainingSeconds),
        } 
    }));
}

function dispatchComplete() {
    window.dispatchEvent(new CustomEvent('timerComplete'));
}