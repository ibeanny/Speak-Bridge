import os
from elevenlabs.client import ElevenLabs
from dotenv import load_dotenv

# Force reload the .env file
load_dotenv(override=True)

# Get API key and debug
api_key = os.getenv("ELEVENLABS_API_KEY")

if not api_key:
    raise ValueError(
        "ELEVENLABS_API_KEY not found in environment variables!\n"
        "Please check your .env file exists and contains: ELEVENLABS_API_KEY=sk_..."
    )

# Mask the key for security but show it's loaded
masked_key = f"{api_key[:7]}...{api_key[-4:]}" if len(api_key) > 11 else "***"
print(f" ElevenLabs API Key loaded: {masked_key}")

# Initialize ElevenLabs client
client = ElevenLabs(api_key=api_key)

def generate_speech(text: str) -> bytes:
    """
    Generate speech from text using Eleven Labs API.

    Args:
        text: The text to convert to speech

    Returns:
        bytes: Audio data in MP3 format
    """
    if not text or not text.strip():
        raise ValueError("Text cannot be empty")

    try:
        print(f"🎤 Requesting TTS for: '{text[:50]}{'...' if len(text) > 50 else ''}'")

        # Generate audio using the client
        audio = client.text_to_speech.convert(
            text=text,
            voice_id="JBFqnCBsd6RMkjVDRZzb",  # Rachel voice (you can change this)
            model_id="eleven_multilingual_v2",
            output_format="mp3_44100_128",
        )

        # Convert generator to bytes
        audio_bytes = b"".join(audio)
        print(f"✅ Generated {len(audio_bytes)} bytes of audio")
        return audio_bytes

    except Exception as e:
        print(f"❌ \\ElevenLabs API Error: {str(e)}")
        raise Exception(f"ElevenLabs API error: {str(e)}")