# Import your preprocessing functions
from text import text_to_sequence
from text.cleaners import sinhala_cleaners


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
    print ("cleaned_text",cleaned_text)
    # Convert cleaned text to a sequence of IDs
    # text_sequence = text_to_sequence(cleaned_text, ["sinhala_cleaners"])
    # print(text_sequence)
    return cleaned_text


text = "2121.45"
preprocessed = preprocess_text(text)
print ("preprocessed", preprocessed)


