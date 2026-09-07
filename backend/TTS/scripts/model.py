import os

from huggingface_hub import login
from huggingface_hub import hf_hub_download

login(token=os.getenv("HF_TOKEN"))

# Define model repository and filenames

# Metta sinhala
repo_id = "Sasangi/VITS_Metta_SInhala"  # replace with your Hugging Face repo
config_filename = "config.json"
checkpoint_filename = "checkpoint_324600.pth"

# Metta Roman
# repo_id = "Sasangi/Vits_Metta_Roman"  # replace with your Hugging Face repo
# config_filename = "config.json"
# checkpoint_filename = "checkpoint_87600.pth"

# # Oshadi SInhala
# repo_id = "Sasangi/Vits_Oshadi_Sinhala"  # replace with your Hugging Face repo
# config_filename = "config.json"
# checkpoint_filename = "checkpoint_38400.pth"

# Oshadi Roman
# repo_id = "Sasangi/Vits_Oshadi_Roman"  # replace with your Hugging Face repo
# config_filename = "config.json"
# checkpoint_filename = "checkpoint_38400.pth"

# multi speaker
# repo_id = "Sasangi/Vits_Multi_Sinhala"  # replace with your Hugging Face repo
# config_filename = "config.json"
# checkpoint_filename = "checkpoint_323400.pth"

# Download config and checkpoint files
config_path = hf_hub_download(repo_id=repo_id, filename=config_filename)
checkpoint_path = hf_hub_download(repo_id=repo_id, filename=checkpoint_filename)
