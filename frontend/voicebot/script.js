// Voice Input: Use Web Speech API
let mediaRecorder; // Variable to track the MediaRecorder instance
let isRecording = false; // Toggle state
let audioChunks = []; // Store recorded audio chunks

const baseURL = "https://subasa.lk/voc-si/";

const asrPort = "api/asr";
const chatbotPort = "api/chatbot";
const ttsPort = "api/tts";
const frameworkPort = "api/framework";

// Toggle recording when the button is clicked
async function startVoiceInput(buttonElement) {
    if (!isRecording) {
        // Start recording
        isRecording = true;
        buttonElement.textContent = "🛑"; // Change to stop icon

        try {
            const constraints = { audio: true }; // Access user's microphone
            const stream =
                await navigator.mediaDevices.getUserMedia(constraints);
            mediaRecorder = new MediaRecorder(stream, {
                mimeType: "audio/webm",
            });

            // Clear previous audio chunks
            audioChunks = [];

            mediaRecorder.start(); // Start recording

            // Capture audio data in chunks
            mediaRecorder.ondataavailable = (event) => {
                audioChunks.push(event.data);
            };

            mediaRecorder.onstop = async () => {
                document.getElementById("user-input").value = "⏳ සැකසෙමින්...";
                const audioBlob = new Blob(audioChunks, { type: "audio/webm" });

                // Re-encode and process the audio
                const reencodedAudioBlob = await reencodeAudio(audioBlob);

                try {
                    // Send audio to the backend
                    const formData = new FormData();
                    formData.append("file", reencodedAudioBlob, "audio.wav");
                    const response = await fetch(
                        `${baseURL}${asrPort}/transcribe`,
                        {
                            method: "POST",
                            body: formData,
                        },
                    );

                    const data = await response.json();

                    // Display transcription in the input field and optionally send the message
                    document.getElementById("user-input").value =
                        data.transcription;
                    sendChatbotMessage(); // Automatically send the transcription as a message
                } catch (error) {
                    alert("ශ්‍රව්‍ය පිටපත් කිරීමේ දෝෂයකි: " + error.message);
                }
            };
        } catch (error) {
            alert("මයික්‍රෆෝන ප්‍රවේශ දෝෂය: " + error.message);
            isRecording = false;
            // rather than having the icon as text i need to add <i class="fa-solid fa-microphone"></i>

            buttonElement.textContent = "🎙"; // Reset icon to start
            // const iconElement = document.createElement("i");
            // iconElement.classList.add("fa-solid", "fa-microphone");
            // buttonElement.appendChild(iconElement);
        }
    } else {
        // Stop recording
        isRecording = false;
        //     const iconElement = document.createElement("i");
        // iconElement.classList.add("fa-solid", "fa-microphone");
        // buttonElement.appendChild(iconElement);

        buttonElement.textContent = "🎙"; // Change to start icon

        if (mediaRecorder && mediaRecorder.state === "recording") {
            mediaRecorder.stop(); // Stop recording
        }
    }
}

// Voice Output: Use SpeechSynthesis API
// Function to handle audio generation and playback
function speakText(text, playButton) {
    if (!text || text.trim() === "") {
        console.error("Text input is empty!");
        return;
    }

    // Get the saved voice from localStorage
    const selectedVoice = localStorage.getItem("preferredVoice") || "male";
    console.log("Voice from localStorage:", selectedVoice);

    // Determine speaker type and name
    const speakerType = selectedVoice === "male" ? "single" : "multi";
    const speakerName = selectedVoice === "male" ? "mettananda" : "oshadi";

    console.log("Selected voice:", selectedVoice);
    console.log("Speaker type:", speakerType);
    console.log("Speaker name:", speakerName);

    // Disable the button and show processing message
    playButton.disabled = true;
    playButton.textContent = "සැකසෙමින්...";

    // Prepare the payload
    const payload = {
        text: text.trim(),
        speaker: speakerName,
        speaker_type: speakerType,
        voice: selectedVoice,
        input_type: "sinhala",
    };

    console.log("Payload sent to backend:", payload);

    // Make the request
    fetch(`${baseURL}${ttsPort}/voicebot-generate-audio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    })
        .then((response) => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then((data) => {
            if (data.audioUrl) {
                const uniqueAudioUrl = `${baseURL}${ttsPort}${data.audioUrl}?t=${Date.now()}`;
                const audio = new Audio(uniqueAudioUrl);

                console.log("Playing audio:", uniqueAudioUrl);

                audio.play();

                audio.onplaying = () => {
                    playButton.disabled = false;
                    playButton.textContent = "🔊";
                };

                audio.onerror = () => {
                    console.error("Error playing audio");
                    playButton.disabled = false;
                    playButton.textContent = "🔊";
                };
            } else {
                console.error("Error in audio generation:", data.error);
                playButton.disabled = false;
                playButton.textContent = "🔊";
            }
        })
        .catch((error) => {
            console.error("Error fetching audio:", error);
            playButton.disabled = false;
            playButton.textContent = "🔊";
        });
}

// Existing sendMessage function with voice output
function sendChatbotMessage() {
    const userInput = document.getElementById("user-input");
    const message = userInput.value.trim();

    if (message === "") return;

    // Display the user's message
    displayMessage(message, "user-message");
    userInput.value = "";

    fetch(`${baseURL}${chatbotPort}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
    })
        .then((response) => response.json())
        .then((data) => {
            // Display the bot's message with a new play button
            displayMessage(data.response, "bot-message");

            // Find the new play button for the current bot response
            const currentPlayButton = document.querySelector(
                ".bot-message:last-child .play-button",
            );

            // Automatically speak the response (first time) and pass the play button of the current message
            speakText(data.response, currentPlayButton);
        })
        .catch((error) => {
            console.error("Error:", error);
            displayMessage(
                "An error occurred. Please try again.",
                "bot-message",
            );
        });
}

// Function to display messages in the chat display
function displayMessage(text, className) {
    const chatDisplay = document.getElementById("chat-display");
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${className}`;

    // Add the message text
    const textSpan = document.createElement("span");
    textSpan.textContent = text;
    messageDiv.appendChild(textSpan);

    // Add a play button for bot messages
    if (className === "bot-message") {
        const playButton = document.createElement("button");
        playButton.textContent = "🔊";
        playButton.className = "play-button";
        // Pass the play button's click event to speakText
        playButton.onclick = (event) => speakText(text, playButton); // Add voice output functionality
        messageDiv.appendChild(playButton);
    }

    chatDisplay.appendChild(messageDiv);
    chatDisplay.scrollTop = chatDisplay.scrollHeight;
}

async function reencodeAudio(blob) {
    // Use AudioContext to modify audio properties
    const audioContext = new AudioContext({ sampleRate: 22050 }); // Set sample rate to 22.05 kHz
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Create a new buffer source
    const offlineContext = new OfflineAudioContext(
        audioBuffer.numberOfChannels,
        audioBuffer.length,
        audioContext.sampleRate,
    );
    const bufferSource = offlineContext.createBufferSource();
    bufferSource.buffer = audioBuffer;
    bufferSource.connect(offlineContext.destination);
    bufferSource.start(0);

    const renderedBuffer = await offlineContext.startRendering();

    // Encode the reprocessed audio buffer into a Blob
    const wavBlob = await encodeToWav(renderedBuffer, audioBuffer.sampleRate);
    return wavBlob;
}

async function encodeToWav(audioBuffer, sampleRate) {
    // Encode audio buffer to WAV format
    const numOfChannels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length * numOfChannels * 2 + 44;
    const buffer = new ArrayBuffer(length);
    const view = new DataView(buffer);

    // WAV header
    const writeString = (offset, string) => {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    };

    writeString(0, "RIFF");
    view.setUint32(4, length - 8, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true); // PCM format
    view.setUint16(20, 1, true);
    view.setUint16(22, numOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2 * numOfChannels, true); // Byte rate
    view.setUint16(32, numOfChannels * 2, true);
    view.setUint16(34, 16, true); // Bits per sample
    writeString(36, "data");
    view.setUint32(40, length - 44, true);

    // Audio data
    let offset = 44;
    for (let channel = 0; channel < numOfChannels; channel++) {
        const data = audioBuffer.getChannelData(channel);
        for (let i = 0; i < data.length; i++) {
            const sample = Math.max(-1, Math.min(1, data[i]));
            view.setInt16(
                offset,
                sample < 0 ? sample * 0x8000 : sample * 0x7fff,
                true,
            );
            offset += 2;
        }
    }

    return new Blob([buffer], { type: "audio/wav" });
}

// menu bar part
document.addEventListener("DOMContentLoaded", function () {
    const menuToggle = document.querySelector(".menu-toggle");
    const sidebar = document.querySelector(".sidebar");
    const menuItems = document.querySelectorAll(".sidebar ul li");
    const mainContent = document.getElementById("main-content");

    // Sidebar toggle
    menuToggle.addEventListener("click", function () {
        sidebar.classList.toggle("collapsed");
    });

    // Function to load content
    function loadPage(page) {
        fetch(`pages/${page}.html`)
            .then((response) => response.text())
            .then((html) => {
                mainContent.innerHTML = html;
            })
            .catch((error) => {
                mainContent.innerHTML = "<h2>Error loading page</h2>";
                console.error("Error loading page:", error);
            });
    }

    // Default page load
    loadPage("chatbot");

    // Handle menu item clicks
    menuItems.forEach((item) => {
        item.addEventListener("click", function () {
            // Remove active class
            menuItems.forEach((menu) => menu.classList.remove("active"));
            this.classList.add("active");

            // Load the selected page
            const page = this.getAttribute("data-page");
            console.log(`Loading ${page}`);
            loadPage(page);
        });
    });
});

// ASR output
async function startVoiceInputASR(buttonElement) {
    if (!isRecording) {
        // Start recording
        isRecording = true;
        buttonElement.textContent = "..."; // Change to stop icon

        try {
            const constraints = { audio: true }; // Access user's microphone
            const stream =
                await navigator.mediaDevices.getUserMedia(constraints);
            mediaRecorder = new MediaRecorder(stream, {
                mimeType: "audio/webm",
            });

            // Clear previous audio chunks
            audioChunks = [];

            mediaRecorder.start(); // Start recording

            // Capture audio data in chunks
            mediaRecorder.ondataavailable = (event) => {
                audioChunks.push(event.data);
            };

            mediaRecorder.onstop = async () => {
                document.getElementById("user-input").value = "⏳ සැකසෙමින්...";

                const audioBlob = new Blob(audioChunks, { type: "audio/webm" });

                // Re-encode and process the audio
                const reencodedAudioBlob = await reencodeAudio(audioBlob);

                try {
                    // Send audio to the backend
                    const formData = new FormData();
                    formData.append("file", reencodedAudioBlob, "audio.wav");

                    const response = await fetch(
                        `${baseURL}${asrPort}/transcribe`,
                        {
                            method: "POST",
                            body: formData,
                        },
                    );

                    const data = await response.json();

                    // Display transcription in the input field and optionally send the message
                    document.getElementById("user-input").value =
                        data.transcription;
                } catch (error) {
                    alert("ශ්‍රව්‍ය පිටපත් කිරීමේ දෝෂයකි: " + error.message);
                }
            };
        } catch (error) {
            alert("මයික්‍රෆෝන ප්‍රවේශ දෝෂය: " + error.message);
            isRecording = false;
            // rather than having the icon as text i need to add <i class="fa-solid fa-microphone"></i>

            buttonElement.textContent = "පටිගත කරන්න";
        }
    } else {
        // Stop recording
        isRecording = false;

        buttonElement.textContent = "පටිගත කරන්න"; // Change to start icon

        if (mediaRecorder && mediaRecorder.state === "recording") {
            mediaRecorder.stop(); // Stop recording
        }
    }
}

// TTS Scripts
function generateAudio() {
    const voice = document.querySelector('input[name="voice"]:checked');
    const inputType = document.getElementById("TTS-input-type").value;
    const inputText = document.getElementById("TTS-input-text").value.trim();
    const errorMessage = document.getElementById("TTS-error-message");
    console.log(inputType);

    // Clear previous error messages
    errorMessage.textContent = "";

    // Validation
    if (!voice || !inputType) {
        errorMessage.textContent = "කරුණාකර සියලු විකල්ප තෝරන්න.";
        return;
    }
    if (!inputText) {
        errorMessage.textContent = "කරුණාකර පෙළ ඇතුලත් කරන්න.";
        return;
    }
    // Determine speaker type based on voice selection
    let speakerType; // Declare it first

    if (inputType === "sinhala") {
        speakerType = voice.value === "male" ? "single" : "multi"; // Assign value
    } else {
        speakerType = "single"; // Assign value in else block
    }

    const speakerName = voice.value === "male" ? "mettananda" : "oshadi";

    // Show a "Processing..." message
    errorMessage.textContent = "⏳ සැකසෙමින්...";
    const audioPlayer = document.getElementById("TTS-audio-player");
    audioPlayer.style.display = "none"; // Hide the audio player while processing

    const payload = {
        text: inputText,
        speaker: speakerName,
        speaker_type: speakerType, //multi or single
        voice: voice.value, //male or female
        input_type: inputType, //sinhala or roman
    };

    // Call the backend API to generate audio
    fetch(`${baseURL}${ttsPort}/voicebot-generate-audio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    })
        .then((response) => response.json())
        .then((data) => {
            if (data.audioUrl) {
                // Append a unique query parameter to the audio URL to avoid caching
                const uniqueUrl = `${baseURL}${ttsPort}${data.audioUrl}?t=${Date.now()}`;
                audioPlayer.src = uniqueUrl;
                audioPlayer.style.display = "block"; // Show the audio player
                audioPlayer.controls = true;
                audioPlayer.removeAttribute("disabled");
                audioPlayer.load();
                audioPlayer.play();
                errorMessage.textContent = ""; // Clear the processing message
            }
        })
        .catch((error) => {
            errorMessage.textContent = "ශ්‍රව්‍ය ජනනය කිරීමේ දෝෂයකි.";
        });
}

const API_UPLOAD_URL = `${baseURL}${frameworkPort}/upload`; // Adjust backend URL
const API_CHAT_URL = `${baseURL}${frameworkPort}/chat`; // Adjust backend URL

// Handle File Upload
function uploadFile() {
    const fileInput = document.getElementById("file-input");
    const file = fileInput.files[0];
    const progressBar = document.getElementById("upload-progress");
    const progressWrapper = document.getElementById("progress-wrapper");
    const analyzingIndicator = document.getElementById("analyzing-indicator");

    if (!file) {
        alert("කරුණාකර උඩුගත කිරීමට ගොනුවක් තෝරන්න!");
        return;
    }

    const formData = new FormData();
    formData.append("file", file);

    // Show progress bar
    progressWrapper.classList.remove("hidden");
    progressBar.style.width = "0%";
    progressBar.innerText = "0%";

    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = function (event) {
        if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            progressBar.style.width = percent + "%";
            progressBar.innerText = percent + "%";
        }
    };

    xhr.onload = function () {
        progressWrapper.classList.add("hidden");
        const response = JSON.parse(xhr.responseText);

        if (xhr.status === 200 && response.success) {
            // Show analyzing indicator
            analyzingIndicator.classList.remove("hidden");

            // Simulate processing time before showing chatbot
            setTimeout(() => {
                analyzingIndicator.classList.add("hidden");
                document
                    .getElementById("upload-section")
                    .classList.add("hidden");
                document
                    .getElementById("chatbot-container")
                    .classList.remove("hidden");
            }, 3500);
        } else {
            console.error(response.error || "Upload failed.");
        }
    };

    xhr.onerror = function () {
        progressWrapper.classList.add("hidden");
        analyzingIndicator.classList.add("hidden");
        console.error("Upload error.");
    };

    xhr.open("POST", API_UPLOAD_URL);
    xhr.send(formData);
}

async function voiceInput(buttonElement) {
    if (!isRecording) {
        // Start recording
        isRecording = true;
        buttonElement.textContent = "🛑"; // Change to stop icon

        try {
            const constraints = { audio: true }; // Access user's microphone
            const stream =
                await navigator.mediaDevices.getUserMedia(constraints);
            mediaRecorder = new MediaRecorder(stream, {
                mimeType: "audio/webm",
            });

            // Clear previous audio chunks
            audioChunks = [];

            mediaRecorder.start(); // Start recording

            // Capture audio data in chunks
            mediaRecorder.ondataavailable = (event) => {
                audioChunks.push(event.data);
            };

            mediaRecorder.onstop = async () => {
                document.getElementById("user-input").value = "⏳ සැකසෙමින්...";
                const audioBlob = new Blob(audioChunks, { type: "audio/webm" });

                // Re-encode and process the audio
                const reencodedAudioBlob = await reencodeAudio(audioBlob);

                try {
                    // Send audio to the backend
                    const formData = new FormData();
                    formData.append("file", reencodedAudioBlob, "audio.wav");

                    const response = await fetch(
                        `${baseURL}${asrPort}/transcribe`,
                        {
                            method: "POST",
                            body: formData,
                        },
                    );

                    const data = await response.json();

                    // Display transcription in the input field and optionally send the message
                    document.getElementById("user-input").value =
                        data.transcription;
                    sendMessage(); // Automatically send the transcription as a message
                } catch (error) {
                    alert("ශ්‍රව්‍ය පිටපත් කිරීමේ දෝෂයකි: " + error.message);
                }
            };
        } catch (error) {
            alert("මයික්‍රෆෝන ප්‍රවේශ දෝෂය: " + error.message);
            isRecording = false;
            // rather than having the icon as text i need to add <i class="fa-solid fa-microphone"></i>

            buttonElement.textContent = "🎙"; // Reset icon to start
            // const iconElement = document.createElement("i");
            // iconElement.classList.add("fa-solid", "fa-microphone");
            // buttonElement.appendChild(iconElement);
        }
    } else {
        // Stop recording
        isRecording = false;
        //     const iconElement = document.createElement("i");
        // iconElement.classList.add("fa-solid", "fa-microphone");
        // buttonElement.appendChild(iconElement);

        buttonElement.textContent = "🎙"; // Change to start icon

        if (mediaRecorder && mediaRecorder.state === "recording") {
            mediaRecorder.stop(); // Stop recording
        }
    }
}

function sendMessage() {
    const userInput = document.getElementById("user-input");
    const message = userInput.value.trim();

    if (message === "") return;

    // Display the user's message
    displayMessage(message, "user-message");
    userInput.value = "";

    fetch(API_CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
    })
        .then((response) => response.json())
        .then((data) => {
            // Display the bot's message with a new play button
            displayMessage(data.response, "bot-message");

            // Find the new play button for the current bot response
            const currentPlayButton = document.querySelector(
                ".bot-message:last-child .play-button",
            );

            // Automatically speak the response (first time) and pass the play button of the current message
            speakText(data.response, currentPlayButton);
        })
        .catch((error) => {
            console.error("Error:", error);
            displayMessage(
                "දෝෂයක් ඇති විය. කරුණාකර නැවත උත්සාහ කරන්න.",
                "bot-message",
            );
        });
}
