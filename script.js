const startButton = document.getElementById("startButton");
const typingInput = document.getElementById("typingInput");
const timerDisplay = document.getElementById("timer");

const TEST_DURATION = 5 * 60; // 5 minutes in seconds

let timeRemaining = TEST_DURATION;
let timerInterval = null;

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

    alert("Time is up! The typing test has ended.");
}

startButton.addEventListener("click", function () {
    // Reset values each time test starts
    timeRemaining = TEST_DURATION;
    updateTimerDisplay();

    typingInput.value = "";
    typingInput.disabled = false;
    typingInput.focus();

    startButton.disabled = true;

    timerInterval = setInterval(function () {
        timeRemaining--;
        updateTimerDisplay();

        if (timeRemaining <= 0) {
            endTest();
        }
    }, 1000);
});

// Set initial timer display when page loads
updateTimerDisplay();