# TTS offline scripts

Batch / evaluation / voice-cloning helpers. These are **not** part of the
running service — `backend/TTS/voicebot_tts.py` is the only web entry point.

Run them from anywhere; each script puts `backend/TTS` on `sys.path` itself:

```bash
python backend/TTS/scripts/run.py            # synthesise one sample to output/
python backend/TTS/scripts/evaluation.py     # batch synthesis for evaluation
python backend/TTS/scripts/voice_clone.py    # speaker-embedding voice cloning
```

`model.py` resolves the single checkpoint the batch scripts use; edit the
`repo_id` / `checkpoint_filename` block there to switch voices.
