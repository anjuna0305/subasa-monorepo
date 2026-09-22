"""A tiny synthetic WAV, generated rather than committed.

Issue #16 removed the sample audio files from the repository; regenerating a
tone here keeps the smoke test self-contained without putting binaries back in
git. It is silence-adjacent noise, so the transcript is not asserted on — only
that the service accepts the upload and answers in the documented shape.
"""

import io
import math
import struct

SAMPLE_RATE = 16000


def make_wav(seconds: float = 1.0, freq: float = 220.0) -> bytes:
    frames = int(SAMPLE_RATE * seconds)
    samples = b"".join(
        struct.pack(
            "<h", int(0.2 * 32767 * math.sin(2 * math.pi * freq * i / SAMPLE_RATE))
        )
        for i in range(frames)
    )

    buffer = io.BytesIO()
    buffer.write(b"RIFF")
    buffer.write(struct.pack("<I", 36 + len(samples)))
    buffer.write(b"WAVEfmt ")
    buffer.write(struct.pack("<IHHIIHH", 16, 1, 1, SAMPLE_RATE, SAMPLE_RATE * 2, 2, 16))
    buffer.write(b"data")
    buffer.write(struct.pack("<I", len(samples)))
    buffer.write(samples)
    return buffer.getvalue()
