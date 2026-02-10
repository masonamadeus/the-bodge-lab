/* =========================================
   TIMER ENGINE (Seconds-based)
   ========================================= */

let countdownInterval = null;
let endTime = 0;
let remainingSeconds = 0;

export function startTimer(totalSeconds) {
    stopTimer(); 
    
    const now = Date.now();
    const durationMS = totalSeconds * 1000; // Direct seconds to MS
    endTime = now + durationMS;
    
    updateTimer();

    countdownInterval = setInterval(() => {
        const isFinished = updateTimer();
        if (isFinished) {
            stopTimer();
            dispatchComplete();
        }
    }, 100);
}

export function stopTimer() {
    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = null;
}

function updateTimer() {
    const now = Date.now();
    const diff = endTime - now;
    const secondsLeft = Math.ceil(diff / 1000);

    if (secondsLeft <= 0) {
        remainingSeconds = 0;
        dispatchTick(0);
        return true; 
    } else {
        if (secondsLeft !== remainingSeconds) {
            remainingSeconds = secondsLeft;
            dispatchTick(remainingSeconds);
        }
        return false; 
    }
}

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

function dispatchTick(seconds) {
    window.dispatchEvent(new CustomEvent('timerTick', { 
        detail: { 
            seconds: seconds, 
            formatted: formatTime(seconds),
        } 
    }));
}

function dispatchComplete() {
    window.dispatchEvent(new CustomEvent('timerComplete'));
}