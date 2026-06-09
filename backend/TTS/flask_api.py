from flask import Flask, request, jsonify, send_from_directory, render_template
from flask_cors import CORS
from huggingface_hub import hf_hub_download
from TTS.api import TTS
import os
from text import text_to_sequence
from text.cleaners import sinhala_cleaners

app = Flask(__name__, static_folder="../../frontend/TTS/static", template_folder="../../frontend/voicebot")
CORS(app)  # Enable CORS for all routes

# Load TTS models
models = {
    "single_male_sinhala": TTS(
        config_path=hf_hub_download("Sasangi/VITS_Metta_SInhala", "config.json"),
        model_path=hf_hub_download("Sasangi/VITS_Metta_SInhala", "checkpoint_324600.pth")
    ),
    "single_female_sinhala": TTS(
        config_path=hf_hub_download("Sasangi/Vits_Oshadi_Sinhala", "config.json"),
        model_path=hf_hub_download("Sasangi/Vits_Oshadi_Sinhala", "checkpoint_38400.pth")
    ),
    "multi_male_sinhala": TTS(
        config_path=hf_hub_download("Sasangi/Vits_Multi_Sinhala", "config.json"),
        model_path=hf_hub_download("Sasangi/Vits_Multi_Sinhala", "checkpoint_323400.pth"),
    ),
    "multi_female_sinhala": TTS(
        config_path=hf_hub_download("Sasangi/Vits_Multi_Sinhala", "config.json"),
        model_path=hf_hub_download("Sasangi/Vits_Multi_Sinhala", "checkpoint_323400.pth")
    ),
    "single_male_romanized": TTS(
        config_path=hf_hub_download("Sasangi/Vits_Metta_Roman", "config.json"),
        model_path=hf_hub_download("Sasangi/Vits_Metta_Roman", "checkpoint_87600.pth")
    ),
    "single_female_romanized": TTS(
        config_path=hf_hub_download("Sasangi/Vits_Oshadi_Roman", "config.json"),
        model_path=hf_hub_download("Sasangi/Vits_Oshadi_Roman", "checkpoint_38400.pth")
    )
}

# Output directory
output_path = "output/output.wav"
os.makedirs("output", exist_ok=True)

# Preprocess text
def preprocess_text(input_text):
    try:
        cleaned_text = sinhala_cleaners(input_text)
        return cleaned_text
    except Exception as e:
        raise ValueError(f"Text preprocessing failed: {e}")

# Serve audio files
@app.route('/output/<filename>')
def serve_output(filename):
    return send_from_directory('output', filename)

# Generate audio
@app.route("/voicebot-generate-audio", methods=["POST"])
def generate_audio():
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No data provided"}), 400

        # Extract data from request
        text = data.get('text', '').strip()
        speaker = data.get('speaker', 'oshadi').lower()
        speaker_type = data.get('speaker_type', 'multi').lower()
        voice = data.get('voice', 'female').lower()
        input_type = data.get('input_type', 'sinhala').lower()

        # Validate input
        if not text:
            return jsonify({"error": "Text is required"}), 400
        if speaker_type not in ["single", "multi"] or voice not in ["male", "female"]:
            return jsonify({"error": "Invalid speaker type or voice"}), 400

        # Preprocess text
        preprocessed_text = preprocess_text(text)

        # Determine model
        model_key = f"{speaker_type}_{voice}_{input_type}"
        model = models.get(model_key)
        if not model:
            return jsonify({"error": f"No model found for key: {model_key}"}), 404

        # Generate audio
        if speaker_type == "single":
            model.tts_to_file(text=preprocessed_text, file_path=output_path)
        else:
            model.tts_to_file(text=preprocessed_text, speaker=speaker, file_path=output_path)

        # Return audio URL
        return jsonify({"audioUrl": f"/output/{os.path.basename(output_path)}"}), 200

    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        print(f"Internal Server Error: {e}")
        return jsonify({"error": "Internal Server Error"}), 500

# Serve the frontend
@app.route('/')
def index():
    return render_template('index.html')

if __name__ == "__main__":
    app.run(debug=False, port=6002)



