import re


def process_sentence(sentence):
    # Load question words from the file
    with open("postprocessing/question_words.txt", 'r', encoding='utf-16') as f:
        question_words = set(f.read().strip().splitlines())

    # Tokenize the sentence into words
    words = re.findall(r'\b\S+\b', sentence.strip())

    # Check for exact matches with question words
    is_question = any(word in question_words for word in words)

    # Append appropriate punctuation
    if is_question:
        return sentence.strip() + "?"
    else:
        return sentence.strip() + "."