"""
jarvis_voice.py - Voice processing module for Jarvis Assistant

Note: Voice input (speech-to-text) is handled entirely in the browser
via the Web Speech API. This module provides optional server-side
text-to-speech via pyttsx3 (offline, no API key needed).
"""

import threading
from typing import Optional

# ============================================================
# TEXT-TO-SPEECH (TTS) - Optional server-side speaking
# ============================================================

_tts_engine = None
_tts_lock = threading.Lock()

def get_tts_engine():
    """Get or initialize the TTS engine (lazy initialization)."""
    global _tts_engine
    if _tts_engine is None:
        try:
            import pyttsx3
            _tts_engine = pyttsx3.init()
            _tts_engine.setProperty('rate', 180)
            _tts_engine.setProperty('volume', 0.9)
            
            # Try to select an English voice for Jarvis-like tone
            voices = _tts_engine.getProperty('voices')
            for voice in voices:
                if 'english' in voice.name.lower() or 'en_' in voice.id.lower():
                    _tts_engine.setProperty('voice', voice.id)
                    break
        except Exception as e:
            print(f"[JARVIS VOICE] TTS init error: {e}")
            _tts_engine = None
    return _tts_engine


def speak_text(text: str) -> bool:
    """Convert text to speech (optional, non-blocking)."""
    try:
        engine = get_tts_engine()
        if engine is None:
            return False
        
        def _speak():
            with _tts_lock:
                engine.say(text)
                engine.runAndWait()
        
        thread = threading.Thread(target=_speak, daemon=True)
        thread.start()
        return True
    except Exception as e:
        print(f"[JARVIS VOICE] TTS error: {e}")
        return False


def is_tts_available() -> bool:
    """Check if TTS is available."""
    try:
        engine = get_tts_engine()
        return engine is not None
    except:
        return False
