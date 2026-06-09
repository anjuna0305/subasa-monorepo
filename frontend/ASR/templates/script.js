function generateAudio() {
    const speakerType = document.querySelector('input[name="speaker"]:checked');
    const voice = document.querySelector('input[name="voice"]:checked');
    const inputType = document.getElementById("input-type").value;
    const inputText = document.getElementById("input-text").value.trim();
    const errorMessage = document.getElementById("error-message");

    // Clear previous error messages
    errorMessage.textContent = "";

    // Validation
    if (!speakerType || !voice || !inputType) {
        errorMessage.textContent = "Please select all options.";
        return;
    }
    if (!inputText) {
        errorMessage.textContent = "Please enter text.";
        return;
    }

    // Additional validation for input type (optional)

    // Call the backend API to generate audio
    fetch("/generate-audio", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            speakerType: speakerType.value,
            voice: voice.value,
            inputType: inputType,
            inputText: inputText
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.audioUrl) {
            const audioPlayer = document.getElementById("audio-player");
            audioPlayer.src = data.audioUrl;
            audioPlayer.style.display = "block";
        }
    })
    .catch(error => {
        errorMessage.textContent = "Error generating audio.";
    });
}