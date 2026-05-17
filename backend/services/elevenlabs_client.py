import os
import io
import json
from fastapi import HTTPException
from elevenlabs import ElevenLabs

def get_client() -> ElevenLabs:
    from config import ELEVENLABS_API_KEY
    if not ELEVENLABS_API_KEY:
         raise ValueError("ELEVENLABS_API_KEY is not set.")
    return ElevenLabs(api_key=ELEVENLABS_API_KEY)

async def generate_audio_briefing(text: str) -> bytes:
    """Generates a 60s summary audio."""
    client = get_client()
    try:
        # Using a professional narrator voice (e.g. Chris)
        audio_generator = client.text_to_speech.convert(
            voice_id="iP95p4xoKVk53GoZ742B", 
            text=text,
            model_id="eleven_multilingual_v2" # Supports Indian languages too
        )
        audio_bytes = b"".join(list(audio_generator))
        return audio_bytes
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def generate_negotiation_coach(text: str) -> bytes:
    """Generates negotiation pushback audio."""
    client = get_client()
    try:
        audio_generator = client.text_to_speech.convert(
            voice_id="iP95p4xoKVk53GoZ742B", 
            text=text,
            model_id="eleven_multilingual_v2"
        )
        audio_bytes = b"".join(list(audio_generator))
        return audio_bytes
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

async def generate_agent_debate(risk_hunter_text: str, devils_advocate_text: str) -> bytes:
    """Generates a 2-voice debate."""
    client = get_client()
    # Currently elevenlabs python sdk might not have text_to_dialogue.convert exposed in all versions yet.
    # As a fallback, we can synthesize two audios and stitch them, or we can just synthesize the text sequentially using standard TTS 
    # but the API specifies Text-to-Speech only for now unless we do multiple calls.
    # We will do two calls and concatenate the mp3 bytes.
    
    try:
        # George for Risk Hunter
        rh_audio = b"".join(list(client.text_to_speech.convert(
            voice_id="JBFqnCBsd6RMkjVDRZzb",
            text=f"Risk Hunter here. {risk_hunter_text}",
            model_id="eleven_multilingual_v2"
        )))
        
        # Aria for Devil's Advocate
        da_audio = b"".join(list(client.text_to_speech.convert(
            voice_id="9BWtsMINqrJLrRacOk9x",
            text=f"Devil's Advocate here. {devils_advocate_text}",
            model_id="eleven_multilingual_v2"
        )))
        
        # Concatenate MP3s (basic concatenation works for raw mp3 streams often, or we use pydub if needed, but we try basic concat first)
        return rh_audio + da_audio
    except Exception as e:
         raise HTTPException(status_code=500, detail=str(e))
