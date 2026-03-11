const startButton = document.getElementById("startButton");
const typingInput = document.getElementById("typingInput");
const timerDisplay = document.getElementById("timer");
const taskText = document.getElementById("taskText");

//const TEST_DURATION = 5 * 60; // 5 minutes in seconds
const TEST_DURATION = 30

let timeRemaining = TEST_DURATION;
let timerInterval = null;

// logging variables

let keystrokeLog = [];
let sessionStartTime = null;


function updateTimerDisplay() {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;

    timerDisplay.textContent =
        `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function endTest() {
    clearInterval(timerInterval);
    timerInterval = null;

    typingInput.disabled = true;
    startButton.disabled = false;
    startButton.textContent = "Restart Test";

    // session data object for keystroke logging
    const sessionData = {
        taskText: taskText.textContent.trim(),
        startTime: new Date(sessionStartTime).toISOString(),
        endTime: new Date().toISOString(),
        finalText: typingInput.value,
        keystrokes: keystrokeLog
    };

    console.log("Session data:", sessionData);
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

    // Reset logging
    keystrokeLog = [];
    sessionStartTime = Date.now();

    startButton.disabled = true;

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
            code: event.key,
            timestamp: new Date(keyTime).toISOString(),
            elapsedTimeMs: keyTime - sessionStartTime,
            textAfterKey: typingInput.value,
            cursorPosition: typingInput.selectionStart
        });
    }, 0);
});

// Set initial timer display when page loads
updateTimerDisplay();