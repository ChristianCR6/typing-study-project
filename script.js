const startButton = document.getElementById("startButton");
const typingInput = document.getElementById("typingInput");
const timerDisplay = document.getElementById("timer");
const taskText = document.getElementById("taskText");

// Use 30 for testing, then revert to 5 minutes for real study
//const TEST_DURATION = 5 * 60; // 5 minutes in seconds
const TEST_DURATION = 30

let timeRemaining = TEST_DURATION;
let timerInterval = null;

// logging variables

let keystrokeLog = [];
let sessionStartTime = null;
let currentSessionId = null;


function updateTimerDisplay() {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;

    timerDisplay.textContent =
        `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function generateSessionId() {
    return `session-${Date.now()}`;
}

function downloadJSON(data, filename) {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const downloadLink = document.createElement("a");
    downloadLink.href = url;
    downloadLink.download = filename;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);

    URL.revokeObjectURL(url);
}

function endTest() {
    clearInterval(timerInterval);
    timerInterval = null;

    typingInput.disabled = true;
    startButton.disabled = false;
    startButton.textContent = "Restart Test";

    // session data object for keystroke logging
    const sessionData = {
        sessionId: currentSessionId,
        taskText: taskText.textContent.trim(),
        startTime: new Date(sessionStartTime).toISOString(),
        endTime: new Date().toISOString(),
        durationSeconds: TEST_DURATION,
        finalText: typingInput.value,
        totalKeystrokes: keystrokeLog.length,
        keystrokes: keystrokeLog
    };

    console.log("Session data:", sessionData);

    // Download the session data automatically
    downloadJSON(sessionData, `${currentSessionId}.json`);

    alert("Time is up! The typing test has ended.");
}

startButton.addEventListener("click", function () {
    // Reset timer
    timeRemaining = TEST_DURATION;
    updateTimerDisplay();

    // Reset input
    typingInput.value = "";
    typingInput.disabled = false;
    typingInput.focus();

    // Reset logging/session info
    keystrokeLog = [];
    sessionStartTime = Date.now();
    currentSessionId = generateSessionId();

    startButton.disabled = true;
    startButton.textContent = "Test Running...";

    timerInterval = setInterval(function () {
        timeRemaining--;
        updateTimerDisplay();

        if (timeRemaining <= 0) {
            endTest();
        }
    }, 1000);
});

// log every key input with a timestamp
typingInput.addEventListener("keydown", function (event) {
    if (typingInput.disabled || !sessionStartTime) return;

    const keyTime = Date.now();

    // Use setTimeout so the textarea value is captured AFTER the key press changes it
    setTimeout(() => {
        keystrokeLog.push({
            key: event.key,
            code: event.code,
            timestamp: new Date(keyTime).toISOString(),
            elapsedTimeMs: keyTime - sessionStartTime,
            textAfterKey: typingInput.value,
            cursorPosition: typingInput.selectionStart
        });
    }, 0);
});

// Set initial timer display when page loads
updateTimerDisplay();