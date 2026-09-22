from TTS.api import TTS
import os

# Import your preprocessing functions
from text import text_to_sequence
from text.cleaners import sinhala_cleaners
from model import config_path, checkpoint_path

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
    print (cleaned_text)
    # Convert cleaned text to a sequence of IDs
    # text_sequence = text_to_sequence(cleaned_text, ["sinhala_cleaners"])
    # print(text_sequence)
    return cleaned_text

# Initialize TTS model
def generate_tts_output(input_text, output_dir="output"):
    """
    Generate TTS output from input text and save the audio to a specified directory.
    
    Args:
        input_text (str): Raw input text in Sinhala.
        output_dir (str): Directory to save the output audio file.
    """
    # Preprocess the input text
    preprocessed_text = preprocess_text(input_text)
    
    # Load TTS model
    tts = TTS(model_path=checkpoint_path, config_path=config_path)
    
    # Generate audio
    audio_path = os.path.join(output_dir, "output.wav")
    os.makedirs(output_dir, exist_ok=True)
    tts.tts_to_file(text=preprocessed_text, file_path=audio_path)
    
    print(f"Generated audio saved to: {audio_path}")

# Example usage
if __name__ == "__main__":
    raw_text = "10.11.2024 දින පෙ.ව. 10.30ට ඔබ හමුවෙන්නට ආවෙමි. 15/11/2024 දී අලුත් වැඩ පටන් ගනී.අගුල් 3.5ක් විය."  # Example Sinhala text
    generate_tts_output(raw_text)
