import os
import uuid

from flask import (
    Flask,
    jsonify,
    render_template,
    request,
    send_file,
    send_from_directory,
)
from flask_cors import CORS
from huggingface_hub import hf_hub_download, login

# Import your preprocessing functions
from text import text_to_sequence
from text.cleaners import sinhala_cleaners
from TTS.api import TTS


# Preprocess text input
def preprocess_text(input_text):
    """
    Preprocess input text for the Sinhala TTS model.

    Args:
        input_text (str): Raw input text in Sinhala.

    Returns:
        list[int]: Preprocessed text converted to a sequence of IDs.
    """
    # Apply the Sinhala text cleaner pipeline
    cleaned_text = sinhala_cleaners(input_text)
    print("cleaned_text", cleaned_text)
    # Convert cleaned text to a sequence of IDs
    # text_sequence = text_to_sequence(cleaned_text, ["sinhala_cleaners"])
    # print(text_sequence)
    return cleaned_text


# app = Flask(__name__, static_folder="../../frontend/TTS/static",template_folder="../../frontend/TTS/templates")
app = Flask(
    __name__,
    static_folder="../../frontend/voicebot",
    template_folder="../../frontend/TTS/templates",
)
CORS(app)

# tts_speakers_file=hf_hub_download("Sasangi/Vits_Multi_Sinhala", "speakers.pth")

login(token=os.getenv("HF_TOKEN"))
# Load models once
models = {
    "single_male_sinhala": TTS(
        config_path=hf_hub_download("Sasangi/VITS_Metta_SInhala", "config.json"),
        model_path=hf_hub_download(
            "Sasangi/VITS_Metta_SInhala", "checkpoint_324600.pth"
        ),
    ),
    "single_male_romanized": TTS(
        config_path=hf_hub_download("Sasangi/Vits_Metta_Roman", "config.json"),
        model_path=hf_hub_download("Sasangi/Vits_Metta_Roman", "checkpoint_87600.pth"),
    ),
    "single_female_sinhala": TTS(
        config_path=hf_hub_download("Sasangi/Vits_Oshadi_Sinhala", "config.json"),
        model_path=hf_hub_download(
            "Sasangi/Vits_Oshadi_Sinhala", "checkpoint_38400.pth"
        ),
    ),
    "single_female_romanized": TTS(
        config_path=hf_hub_download("Sasangi/Vits_Oshadi_Roman", "config.json"),
        model_path=hf_hub_download("Sasangi/Vits_Oshadi_Roman", "checkpoint_38400.pth"),
    ),
    "multi_male_sinhala": TTS(
        config_path=hf_hub_download("Sasangi/Vits_Multi_Sinhala", "config.json"),
        model_path=hf_hub_download(
            "Sasangi/Vits_Multi_Sinhala", "checkpoint_323400.pth"
        ),
    ),
    "multi_female_sinhala": TTS(
        config_path=hf_hub_download("Sasangi/Vits_Multi_Sinhala", "config.json"),
        model_path=hf_hub_download(
            "Sasangi/Vits_Multi_Sinhala", "checkpoint_323400.pth"
        ),
    ),
}

# Generate and save audio file
output_path = "output"

# @app.route('/favicon.ico')
# def favicon():
#     return app.send_file('favicon.ico')

# @app.route('logo.png')
# def logo():
#     return app.send_file('logo.png')


@app.route("/")
def index():
    return render_template("index.html")  # This serves the HTML page


print("Page loaded")


@app.route("/hello")
def randomHelloMessage():
    return "Hello from the tts"  # This serves the HTML page


# Serve audio files from the 'output' folder
@app.route("/output/<filename>")
def serve_output(filename):
    return send_from_directory("output", filename)


@app.route("/generate-audio", methods=["POST"])
def generate_audio():
    print("function is called")
    try:
        data = request.json  # Read JSON data from POST request
        if not data:
            return jsonify({"error": "No data received"}), 400

        speaker_type = data.get("speakerType")
        voice = data.get("voice")
        input_type = data.get("inputType")
        text = data.get("inputText")

        # preprocess the input text
        preprocessed_text = preprocess_text(text)
        print("preprocessed", preprocessed_text)

        # Validate input
        if not speaker_type or not voice or not input_type or not text:
            return jsonify({"error": "Missing required fields"}), 400

        # Determine which model to use
        model_key = f"{speaker_type}_{voice}_{input_type}"
        model = models.get(model_key)

        file_name = f"{output_path}/{uuid.uuid4()}.wav"

        # Check the model speaker type single or multiple
        if speaker_type == "single":
            model.tts_to_file(text=preprocessed_text, file_path=file_name)
        else:
            if voice == "male":
                model.tts_to_file(
                    text=preprocessed_text, speaker="mettananda", file_path=file_name
                )
            else:
                model.tts_to_file(
                    text=preprocessed_text, speaker="oshadi", file_path=file_name
                )

        if not model:
            return jsonify({"error": f"Model not found for key: {model_key}"}), 404

        # Return audio file URL to frontend
        return jsonify({"audioUrl": f"/output/{os.path.basename(file_name)}"})
    except Exception as e:
        # Log the error for debugging
        print(f"Error occurred: {e}")
        return jsonify({"error": "Internal Server Error"}), 500


if __name__ == "__main__":
    print("server is started running")
    app.run(debug=False, host="0.0.0.0", port=6002)
