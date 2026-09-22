// Function to handle file upload
function uploadDocument() {
    const fileInput = document.getElementById('file-input');
    const file = fileInput.files[0];

    if (!file) {
        alert('Please select a file to upload.');
        return;
    }

    const formData = new FormData();
    formData.append('file', file);

    fetch('http://127.0.0.1:5000/upload', {
        method: 'POST',
        body: formData
    })
        .then(response => {
            if (response.ok) {
                alert('Document uploaded successfully!');
                document.getElementById('chatbot-section').classList.remove('hidden');
            } else {
                alert('Failed to upload document. Please try again.');
            }
        })
        .catch(error => {
            console.error('Error uploading document:', error);
            alert('An error occurred. Please try again.');
        });
}

// Function to send a message to the chatbot
function sendMessage() {
    const userInput = document.getElementById('user-input');
    const message = userInput.value.trim();

    if (message === "") return;

    displayMessage(message, 'user-message');
    userInput.value = "";

    fetch('http://127.0.0.1:5000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
    })
        .then(response => response.json())
        .then(data => {
            displayMessage(data.response, 'bot-message');
        })
        .catch(error => {
            console.error('Error:', error);
            displayMessage('An error occurred. Please try again.', 'bot-message');
        });
}

// Function to display messages in the chat display
function displayMessage(text, className) {
    const chatDisplay = document.getElementById('chat-display');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${className}`;
    messageDiv.textContent = text;
    chatDisplay.appendChild(messageDiv);
    chatDisplay.scrollTop = chatDisplay.scrollHeight;
}
