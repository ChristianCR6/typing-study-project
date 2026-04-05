// Constant variables
const startButton = document.getElementById("startButton");
const typingInput = document.getElementById("typingInput");
const timerDisplay = document.getElementById("timer");
const taskText = document.getElementById("taskText");
const taskTypeSelect = document.getElementById("taskType");
const participantIdInput = document.getElementById("participantId");

// Use 30 for testing, then revert to 5 minutes for real study
// const TEST_DURATION = 5 * 60; // 5 minutes in seconds
const TEST_DURATION = 30;
const PAUSE_THRESHOLD_MS = 2000;

// Task data
const copyTasks = [
    "The quick brown fox jumps over the lazy dog.",
    "Typing accuracy is important when collecting experimental data.",
    "Students often improve software by building and testing small features."
];

const promptTasks = [
    "Describe your typical morning routine.",
    "Explain a hobby or activity that you enjoy.",
    "Write about a challenge you have faced during university."
];

// Test timer variables
let timeRemaining = TEST_DURATION;
let timerInterval = null;

// Logging/session variables
let keystrokeLog = [];
let sessionStartTime = null;
let currentSessionId = null;
let currentTaskType = null;
let currentTaskContent = null;
let currentParticipantId = null;
let rawBackspaceCount = 0;
let effectiveBackspaceCount = 0;
let lastKeystrokeTime = null;
let pauseEvents = [];
let pendingTextChangeLog = null;

// Timer update function
function updateTimerDisplay() {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;

    timerDisplay.textContent =
        `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function generateSessionId() {
    return `session-${Date.now()}`;
}

// Takes session data object and makes it into a downloadable JSON file
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

// Random task selection function
function getRandomTask(taskType) {
    if (taskType === "copy") {
        return copyTasks[Math.floor(Math.random() * copyTasks.length)];
    } else {
        return promptTasks[Math.floor(Math.random() * promptTasks.length)];
    }
}

// Load task function
function loadTask() {
    currentTaskType = taskTypeSelect.value;
    currentTaskContent = getRandomTask(currentTaskType);
    taskText.textContent = currentTaskContent;
}


// -----------------------------------
// Helper Metric calculating functions
// -----------------------------------


// Calculates Gross WPM using the formula: (number of typed characters / 5) / time in minutes
function calculateGrossWPM(finalText, elapsedTimeMs) {
    const minutes = elapsedTimeMs / 60000;

    if (minutes <= 0) return 0;

    const totalCharacters = finalText.length;
    const grossWPM = (totalCharacters / 5) / minutes;

    return Number(grossWPM.toFixed(2));
}

function calculatePauseStats(pauseEvents) {
    if (pauseEvents.length === 0) {
        return {
            pauseCount: 0,
            averagePauseMs: 0,
            longestPauseMs: 0
        };
    }

    const totalPauseTime = pauseEvents.reduce((sum, pause) => sum + pause.durationMs, 0);
    const averagePauseMs = totalPauseTime / pauseEvents.length;
    const longestPauseMs = Math.max(...pauseEvents.map(pause => pause.durationMs));

    return {
        pauseCount: pauseEvents.length,
        averagePauseMs: Number(averagePauseMs.toFixed(2)),
        longestPauseMs: longestPauseMs
    };
}

function calculateCopyTaskAccuracy(finalText, targetText) {
    const typedLength = finalText.length;
    const targetLength = targetText.length;
    const minLength = Math.min(typedLength, targetLength);

    let correctCharacters = 0;
    let incorrectCharacters = 0;

    for (let i = 0; i < minLength; i++) {
        if (finalText[i] === targetText[i]) {
            correctCharacters++;
        } else {
            incorrectCharacters++;
        }
    }

    const extraCharacters = Math.max(0, typedLength - targetLength);
    const omittedCharacters = Math.max(0, targetLength - typedLength);

    // Extra typed characters should count as incorrect attempts
    incorrectCharacters += extraCharacters;

    const accuracyPercent =
        typedLength > 0
            ? Number(((correctCharacters / typedLength) * 100).toFixed(2))
            : 0;

    return {
        correctCharacters: correctCharacters,
        incorrectCharacters: incorrectCharacters,
        extraCharacters: extraCharacters,
        omittedCharacters: omittedCharacters,
        accuracyPercent: accuracyPercent
    };
}

function endTest() {
    clearInterval(timerInterval);
    timerInterval = null;

    typingInput.disabled = true;
    taskTypeSelect.disabled = false;
    participantIdInput.disabled = false;
    startButton.disabled = false;
    startButton.textContent = "Restart Test";

    const endTime = Date.now();
    const elapsedTimeMs = endTime - sessionStartTime;
    const elapsedTimeSeconds = Number((elapsedTimeMs / 1000).toFixed(2));
    const finalText = typingInput.value;
    const grossWPM = calculateGrossWPM(finalText, elapsedTimeMs);

    // Ensures if test ends with a pause over 2seconds the pause is counted.
    if (lastKeystrokeTime !== null) {
        const finalPauseMs = endTime - lastKeystrokeTime;

        if (finalPauseMs >= PAUSE_THRESHOLD_MS) {
            pauseEvents.push({
                startAfterElapsedMs: lastKeystrokeTime - sessionStartTime,
                endAtElapsedMs: endTime - sessionStartTime,
                durationMs: finalPauseMs,
                endedBy: "testEnd"
            });
        }
    }

    const pauseStats = calculatePauseStats(pauseEvents);

    let copyTaskMetrics = null;

        if (currentTaskType === "copy") {
            copyTaskMetrics = calculateCopyTaskAccuracy(finalText, currentTaskContent);
    }

    const sessionData = {
        metadata: {
            exportVersion: 1,
            sessionId: currentSessionId,
            participantId: currentParticipantId,
            startTime: new Date(sessionStartTime).toISOString(),
            endTime: new Date(endTime).toISOString(),
            durationSeconds: elapsedTimeSeconds
        },

        task: {
            taskType: currentTaskType,
            promptOrSourceText: currentTaskContent,
            finalText: finalText
        },

        config: {
            testDurationSeconds: TEST_DURATION,
            pauseThresholdMs: PAUSE_THRESHOLD_MS
        },

        metrics: {
            totalCharactersTyped: finalText.length,
            grossWPM: grossWPM,
            rawBackspaceCount: rawBackspaceCount,
            effectiveBackspaceCount: effectiveBackspaceCount,
            pauseCount: pauseStats.pauseCount,
            averagePauseMs: pauseStats.averagePauseMs,
            longestPauseMs: pauseStats.longestPauseMs,
            copyTaskMetrics: copyTaskMetrics
        },

        logs: {
            totalKeystrokes: keystrokeLog.length,
            pauseEvents: pauseEvents,
            keystrokes: keystrokeLog
        }
    };

    console.log("Session data:", sessionData);

    downloadJSON(sessionData, `${currentParticipantId}_${currentSessionId}.json`);

    let endMessage = `Time is up! The typing test has ended.\nGross WPM: ${grossWPM}`;

    if (copyTaskMetrics) {
        endMessage += `\nCopy Accuracy: ${copyTaskMetrics.accuracyPercent}%`;
    }

    alert(endMessage);
}

// Validation - prevents empty participant IDs
startButton.addEventListener("click", function () {
    const enteredParticipantId = participantIdInput.value.trim();

    if (!enteredParticipantId) {
        alert("Please enter a participant ID before starting the test.");
        participantIdInput.focus();
        return;
    }

    // keep participant ID attached to session
    currentParticipantId = enteredParticipantId;

    // Load the selected task
    loadTask();

    // Reset timer
    timeRemaining = TEST_DURATION;
    updateTimerDisplay();

    // Reset input
    typingInput.value = "";
    typingInput.disabled = false;
    typingInput.focus();

    // Reset logging/session info
    keystrokeLog = [];
    rawBackspaceCount = 0;
    effectiveBackspaceCount = 0;
    lastKeystrokeTime = null;
    pauseEvents = [];
    pendingTextChangeLog = null;
    sessionStartTime = Date.now();
    currentSessionId = generateSessionId();

    // Prevents user from interacting with these elements during test
    taskTypeSelect.disabled = true;
    participantIdInput.disabled = true;
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

// Optional: preview a task when selection changes
taskTypeSelect.addEventListener("change", function () {
    const selectedType = taskTypeSelect.value;

    if (selectedType === "copy") {
        taskText.textContent = "Press Start Test to load a copy typing passage.";
    } else {
        taskText.textContent = "Press Start Test to load a writing prompt.";
    }
});

// Log every key input with a timestamp
typingInput.addEventListener("keydown", function (event) {
    if (typingInput.disabled || !sessionStartTime) return;

    const keyTime = Date.now();
    const textBeforeKey = typingInput.value;
    const selectionStartBefore = typingInput.selectionStart;
    const selectionEndBefore = typingInput.selectionEnd;

    if (lastKeystrokeTime !== null) {
        const gapMs = keyTime - lastKeystrokeTime;

        if (gapMs >= PAUSE_THRESHOLD_MS) {
            pauseEvents.push({
                startAfterElapsedMs: lastKeystrokeTime - sessionStartTime,
                endAtElapsedMs: keyTime - sessionStartTime,
                durationMs: gapMs
            });
        }
    }

    lastKeystrokeTime = keyTime;

    if (event.key === "Backspace") {
        rawBackspaceCount++;
    }

    const keyChangesText =
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        (
            event.key.length === 1 ||
            event.key === "Backspace" ||
            event.key === "Delete" ||
            event.key === "Enter"
        );

    // Log non-text-changing keys immediately
    if (!keyChangesText) {
        keystrokeLog.push({
            key: event.key,
            code: event.code,
            timestamp: new Date(keyTime).toISOString(),
            elapsedTimeMs: keyTime - sessionStartTime,
            textAfterKey: typingInput.value,
            cursorPosition: typingInput.selectionStart,
            textChanged: false
        });
        return;
    }

    // Save keydown info and finish the log entry on the input event
    pendingTextChangeLog = {
        key: event.key,
        code: event.code,
        keyTime: keyTime,
        textBeforeKey: textBeforeKey,
        selectionStartBefore: selectionStartBefore,
        selectionEndBefore: selectionEndBefore
    };
});

typingInput.addEventListener("input", function () {
    if (typingInput.disabled || !sessionStartTime || !pendingTextChangeLog) return;

    const textAfterKey = typingInput.value;

    const {
        key,
        code,
        keyTime,
        textBeforeKey,
        selectionStartBefore,
        selectionEndBefore
    } = pendingTextChangeLog;

    if (key === "Backspace") {
        const hadSelection = selectionStartBefore !== selectionEndBefore;
        const textGotShorter = textAfterKey.length < textBeforeKey.length;
        const hadCharacterBeforeCursor =
            selectionStartBefore > 0 && selectionStartBefore === selectionEndBefore;

        if ((hadSelection && textGotShorter) || (hadCharacterBeforeCursor && textGotShorter)) {
            effectiveBackspaceCount++;
        }
    }

    keystrokeLog.push({
        key: key,
        code: code,
        timestamp: new Date(keyTime).toISOString(),
        elapsedTimeMs: keyTime - sessionStartTime,
        textAfterKey: textAfterKey,
        cursorPosition: typingInput.selectionStart,
        textChanged: true
    });

    pendingTextChangeLog = null;
});

// Set initial timer display when page loads
updateTimerDisplay();