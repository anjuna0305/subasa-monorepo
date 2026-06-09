function initVoiceSettings() {
    const voiceInputs = document.querySelectorAll('input[name="voice"]');
    if (voiceInputs.length === 0) {
        // Try again after 100ms
        return setTimeout(initVoiceSettings, 100);
    }

    console.log("Found", voiceInputs.length, "voice input(s)");

    const savedVoice = localStorage.getItem("preferredVoice") || "male";
    const targetInput = document.querySelector(`input[name="voice"][value="${savedVoice}"]`);
    if (targetInput) {
        targetInput.checked = true;
        console.log("Set checked voice to:", savedVoice);
    }

    voiceInputs.forEach(input => {
        input.addEventListener("change", () => {
            localStorage.setItem("preferredVoice", input.value);
            console.log("Voice preference saved:", input.value);
        });
    });
}

// Call after initial load
document.addEventListener("DOMContentLoaded", initVoiceSettings);

document.getElementById("settings-form").addEventListener("submit", function (event) {
    event.preventDefault(); // prevent form reload

    const selectedVoice = document.querySelector('input[name="voice"]:checked');
    if (selectedVoice) {
        localStorage.setItem("preferredVoice", selectedVoice.value);
        console.log("Voice preference saved:", selectedVoice.value);
        alert("සැකසීම් සුරකින ලදී!");
    } else {
        alert("කරුණාකර හඬ විකල්පයක් තෝරන්න.");
    }
});