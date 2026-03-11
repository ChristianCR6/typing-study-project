const startButton = document.getElementById("startButton");
const typingInput = document.getElementById("typingInput");

startButton.addEventListener("click", function () {

    typingInput.disabled = false;

    typingInput.focus();

});