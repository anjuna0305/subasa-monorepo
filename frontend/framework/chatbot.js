const API_UPLOAD_URL = "http://127.0.0.1:5001/upload"; // Adjust backend URL
const API_CHAT_URL = "http://127.0.0.1:5001/chat"; // Adjust backend URL

// Handle File Upload
function uploadFile() {
    const fileInput = document.getElementById('file-input');
    const file = fileInput.files[0];

    if (!file) {
        alert("Please select a file to upload!");
        return;
    }

    const formData = new FormData();
    formData.append("file", file);

    // Upload to the backend
    fetch(API_UPLOAD_URL, {
        method: "POST",
        body: formData
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert(data.message);
                document.getElementById('upload-section').classList.add('hidden');
                document.getElementById('chatbot-container').classList.remove('hidden');
            } else {
                alert(data.error || "Upload failed!");
            }
        })
        .catch(error => console.error("Upload error:", error));
}

// Handle Sending and Receiving Messages
function sendMessage() {
    const userInput = document.getElementById('user-input');
    const message = userInput.value.trim();

    if (!message) return;

    displayMessage(message, "user-message");
    userInput.value = "";

    fetch(API_CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message })
    })
        .then(response => response.json())
        .then(data => {
            if (data.response) {
                displayMessage(data.response, "bot-message");
            } else {
                displayMessage("Could not fetch response. Try again!", "bot-message");
            }
        })
        .catch(error => {
            console.error("Chat error:", error);
            displayMessage("An error occurred while processing your request.", "bot-message");
        });
}

// Display Messages in Chat
function displayMessage(text, className) {
    const chatDisplay = document.getElementById('chat-display');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${className}`;
    messageDiv.textContent = text;

    chatDisplay.appendChild(messageDiv);
    chatDisplay.scrollTop = chatDisplay.scrollHeight; // Scroll to the bottom
}