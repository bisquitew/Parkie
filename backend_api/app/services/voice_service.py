import os
from openai import OpenAI
from ..config import settings

openai_client = OpenAI(api_key=settings.OPENAI_API_KEY) if settings.OPENAI_API_KEY else None

def transcribe_audio(file_path: str, suffix: str):
    if not openai_client:
        raise Exception("OpenAI API key is not configured.")
    
    with open(file_path, "rb") as audio_file:
        file_to_send = (f"recording{suffix}", audio_file, "audio/mp4")
        transcription = openai_client.audio.transcriptions.create(
            model="whisper-1",
            file=file_to_send,
            language="ro"
        )
    return transcription.text.strip()
