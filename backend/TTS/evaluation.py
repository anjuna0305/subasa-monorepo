from huggingface_hub import hf_hub_download
from TTS.api import TTS
import os

# Import your preprocessing functions
from text import text_to_sequence
from text.cleaners import sinhala_cleaners

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
    return cleaned_text

# Initialize TTS model
def generate_tts_output(input_text, output_dir, output_filename):
    """
    Generate TTS output from input text and save the audio to a specified directory.
    
    Args:
        input_text (str): Raw input text in Sinhala.
        output_dir (str): Directory to save the output audio file.
        output_filename (str): Name of the output audio file.
    """
    # Preprocess the input text
    preprocessed_text = preprocess_text(input_text)
    
    # Load TTS model
    tts = TTS(model_path=checkpoint_path, config_path=config_path)
    
    # Generate audio
    os.makedirs(output_dir, exist_ok=True)
    audio_path = os.path.join(output_dir, output_filename)
    tts.tts_to_file(text=preprocessed_text, file_path=audio_path)
    
    print(f"Generated audio saved to: {audio_path}")

# Generate test audios from sentences in a text file
def generate_audios_from_file(file_path, output_dir="test_audios", base_filename="met_sin"):
    """
    Generate TTS output for sentences in a text file.
    
    Args:
        file_path (str): Path to the text file containing sentences.
        output_dir (str): Directory to save the output audio files.
        base_filename (str): Base name for output audio files.
    """
    with open(file_path, 'r', encoding='utf-8') as file:
        sentences = file.readlines()
    
    for idx, sentence in enumerate(sentences):
        sentence = sentence.strip()  # Remove leading/trailing whitespace
        if not sentence:
            continue  # Skip empty lines
        
        # Generate a filename like "met_sin_1.wav", "met_sin_2.wav", etc.
        output_filename = f"{base_filename}_{idx + 1}.wav"
        print(f"Processing sentence {idx + 1}: {sentence}")
        generate_tts_output(sentence, output_dir, output_filename)

# Example usage
if __name__ == "__main__":
    # Path to the text file containing test sentences
    input_file_path = r"evaluation/test_sentences.txt"  # Replace with your actual file path
    
    # Directory to save the generated audios
    output_directory = r"evaluation/osh_sin_single"
    
    # Base filename for the audio files
    base_audio_filename = "osh_sin_single"
    
    # Generate audios from sentences in the text file
    generate_audios_from_file(input_file_path, output_dir=output_directory, base_filename=base_audio_filename)
