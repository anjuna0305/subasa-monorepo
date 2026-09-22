function sendMessage() {
    const userInput = document.getElementById("user-input").value;
    if (!userInput) return;
    
    displayMessage("ප්‍රශ්නය", userInput);
    
    // Call chatbot backend API
    getChatbotResponse(userInput).then(response => {
        displayMessage("පිළිතුර", response);
    });
    
    document.getElementById("user-input").value = "";
}

function displayMessage(sender, message) {
    const chatDisplay = document.getElementById("chat-display");
    const messageElement = document.createElement("p");
    messageElement.textContent = `${sender}: ${message}`;
    chatDisplay.appendChild(messageElement);
    chatDisplay.scrollTop = chatDisplay.scrollHeight;
}

async function getChatbotResponse(message) {
    try {
        const response = await fetch("http://127.0.0.1:5001/chat", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ message: message })
        });
        const data = await response.json();
        return data.response;
    } catch (error) {
        console.error("Error:", error);
        return "සමාවන්න, සම්බන්ධ වීමේ දෝෂයක් ඇති විය.";
    }
}

