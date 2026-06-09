from TTS.api import TTS
import os

from model import config_path, checkpoint_path

# Initialize TTS with downloaded files
tts = TTS(config_path=config_path, model_path=checkpoint_path)

# Generate audio and save it
# input_text = transcription
input_text = "ඔබට කැමති පරිදි තෝරා ගැනීමට විවිධ  ජ්‍යෙෂ්ඨ පුරවැසි ස්ථාවර තැන්පතු රැසක්."
# input_text = "obaṭa kæmati paridi tōrā gænīmaṭa vividha iturum giṇum ræsak."

def generate_audio(input_text):
    os.makedirs("output", exist_ok=True)
    tts.tts_to_file(text=input_text, file_path="output/output.wav")
    print("Audio generated and saved as output/output.wav")


generate_audio(input_text)
