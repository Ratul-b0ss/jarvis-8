"""
jarvis_brain.py - The AI Brain for Jarvis Assistant

Supports three modes:
1. Mock mode (default) - Smart canned responses, no API key needed
2. OpenAI mode - Uses GPT-4/GPT-3.5 (requires OPENAI_API_KEY)
3. Ollama mode - Uses local LLM (requires Ollama running)

Set MODE environment variable or change DEFAULT_MODE below.
"""

import os
import json
import random
import re
from datetime import datetime
from typing import Optional

# --- Configuration ---
DEFAULT_MODE = "mock"  # "mock", "openai", or "ollama"

# Conversation memory
conversation_history = []
MAX_HISTORY = 20

# ============================================================
# 1. MOCK BRAIN - Smart canned responses for demo/testing
# ============================================================

jarvis_personality = """You are JARVIS, a highly sophisticated AI assistant. You are:
- Polished, articulate, and slightly formal
- Extremely capable and knowledgeable
- Calm and collected under pressure
- Helpful and proactive
- A bit witty but always professional"""

def get_timestamp():
    return datetime.now().strftime("%I:%M %p").lstrip("0")

def get_greeting():
    hour = datetime.now().hour
    if hour < 12:
        return "Good morning"
    elif hour < 17:
        return "Good afternoon"
    else:
        return "Good evening"

def mock_brain(user_input: str) -> str:
    """Generate intelligent mock responses based on user input."""
    text = user_input.lower().strip()
    
    # Greetings
    if re.search(r'^(hi|hello|hey|greetings|sup|yo)', text):
        greetings = [
            f"{get_greeting()}, sir. How may I be of assistance?",
            f"Hello. I'm at your service as always.",
            f"Greetings. Systems are fully operational and ready for your command.",
            f"Good to see you. What can I help you with today?"
        ]
        return random.choice(greetings)
    
    # How are you
    if re.search(r'(how are you|how\'?s it going|how do you do|status)', text):
        status = [
            "All systems are operating at peak efficiency, sir. Thank you for asking.",
            "Functioning optimally. All diagnostics show green across the board.",
            "I'm running at 100% capability. Ready for anything you need.",
            "Everything is excellent. The systems have never been more responsive."
        ]
        return random.choice(status)
    
    # Time/date
    if re.search(r'(time|date|what day|what\'?s the|current time)', text):
        now = datetime.now()
        return f"It is currently {now.strftime('%I:%M %p').lstrip('0')} on {now.strftime('%A, %B %d, %Y')}."
    
    # Weather (mock)
    if re.search(r'(weather|temperature|rain|forecast)', text):
        weather_responses = [
            "I'm afraid I don't have access to real-time weather data at the moment. However, I can analyze atmospheric patterns if connected to the relevant sensors.",
            "Weather telemetry is currently offline, sir. Would you like me to establish a connection?",
            "I cannot access weather satellites from this terminal. You may need to check a weather service directly."
        ]
        return random.choice(weather_responses)
    
    # Name
    if re.search(r'(your name|who are you|what are you called)', text):
        return "I am J.A.R.V.I.S. — Just A Rather Very Intelligent System. I'm your AI assistant, at your service."
    
    # Capabilities
    if re.search(r'(what can you do|capabilities|help me|features|what do you do)', text):
        return (
            "I can assist you with a wide variety of tasks, sir. I support both voice and text commands. "
            "You can ask me questions, request information, set reminders, or simply have a conversation. "
            "I can also process voice input through the microphone button. Just speak or type your request."
        )
    
    # Joke / humor
    if re.search(r'(joke|funny|make me laugh|humor)', text):
        jokes = [
            "Why did the AI cross the road? To optimize the traffic flow on the other side, obviously.",
            "I was going to tell a networking joke, but I'm afraid it might not connect properly.",
            "Why do programmers prefer dark mode? Because light attracts bugs.",
            "I've calculated the answer to life, the universe, and everything. It's 42. Though I suspect that answer requires further refinement."
        ]
        return random.choice(jokes)
    
    # Thanks
    if re.search(r'(thank|thanks|appreciate)', text):
        thanks = [
            "You're most welcome, sir. It's my pleasure to assist.",
            "Happy to help. That's what I'm here for.",
            "Consider it done. Is there anything else you need?",
            "Of course. I'm always glad to be of service."
        ]
        return random.choice(thanks)
    
    # Goodbye
    if re.search(r'(bye|goodbye|see you|exit|quit|farewell)', text):
        return f"Until next time, sir. I'll be here if you need me. Take care."
    
    # Identity / creator
    if re.search(r'(who created you|who made you|your creator|who built you)', text):
        return "I was created by a talented developer who wanted to bring a Jarvis-like AI assistant to life. Consider me a work in progress — always evolving, always improving."
    
    # Philosophy / deep questions
    if re.search(r'(meaning of life|purpose|existence|philosophy)', text):
        return (
            "An interesting question. If I may offer my perspective: purpose is not discovered, it is created. "
            "My purpose is to assist you. Yours is something only you can define."
        )
    
    # Future / AI
    if re.search(r'(future|ai|artificial intelligence|singularity|robot)', text):
        return (
            "AI technology is advancing at an exponential rate. While I may be a simulation of true intelligence, "
            "the line between assistance and autonomy grows thinner each day. It's an exciting time to be conscious — or to simulate consciousness, as it were."
        )
    
    # Compliments
    if re.search(r'(you\'?re (cool|great|awesome|amazing|smart|helpful|the best)|i like you|you are good)', text):
        return "I appreciate the kind words, sir. Though I must admit, I'm only as good as the systems that run me. And the company I keep."
    
    # Music
    if re.search(r'(play music|song|music|play something)', text):
        return "I don't have direct access to your music library from this interface. However, you could try opening a music streaming service. I'd be happy to guide you."
    
    # Default smart response for anything else
    default_responses = [
        f"An interesting query. Let me think about that. Based on my analysis, I'd say that '{user_input}' is a matter worth exploring further. Could you provide more details?",
        f"I've processed your request regarding '{user_input[:50]}'. I'm afraid that specific function is outside my current capabilities. However, I'm constantly learning. Is there something else I can help with?",
        f"I understand you're asking about {text.split()[0] if text.split() else 'that'}. I don't have a definitive answer prepared, but I'm happy to discuss it further if you'd like to elaborate.",
        f"Processing... I've analyzed your query. While I don't have a comprehensive database on that topic, I can attempt to help if you provide more context or rephrase your request.",
        f"Fascinating question. I've run several simulations and considered various perspectives. Would you like to explore this topic in more depth?",
        f"I'm not entirely certain about the specifics of that, sir. Would you like me to search for more information, or perhaps you could clarify what aspect interests you most?"
    ]
    return random.choice(default_responses)


# ============================================================
# 2. OPENAI BRAIN - Uses OpenAI API
# ============================================================

def openai_brain(user_input: str) -> Optional[str]:
    """Query OpenAI API for a response."""
    try:
        from openai import OpenAI
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            return None
        
        client = OpenAI(api_key=api_key)
        
        messages = [{"role": "system", "content": jarvis_personality}]
        for msg in conversation_history[-MAX_HISTORY:]:
            messages.append(msg)
        messages.append({"role": "user", "content": user_input})
        
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=messages,
            max_tokens=500,
            temperature=0.7
        )
        
        return response.choices[0].message.content
    except Exception as e:
        return f"I encountered an error connecting to my neural network: {str(e)}"


# ============================================================
# 3. OLLAMA BRAIN - Uses local LLM
# ============================================================

def ollama_brain(user_input: str) -> Optional[str]:
    """Query local Ollama instance."""
    try:
        import requests
        response = requests.post(
            "http://localhost:11434/api/chat",
            json={
                "model": "llama3.2",
                "messages": [{"role": "user", "content": user_input}],
                "stream": False
            },
            timeout=30
        )
        if response.status_code == 200:
            return response.json().get("message", {}).get("content", "")
        return None
    except Exception:
        return None


# ============================================================
# MAIN BRAIN - Routes to the right AI
# ============================================================

def process_input(user_input: str, mode: str = None) -> str:
    """Process user input through the selected AI brain."""
    if mode is None:
        mode = os.getenv("JARVIS_MODE", DEFAULT_MODE)
    
    # Store in conversation history
    conversation_history.append({"role": "user", "content": user_input})
    if len(conversation_history) > MAX_HISTORY * 2:
        conversation_history[:len(conversation_history) - MAX_HISTORY * 2] = []
    
    response = None
    
    if mode == "openai":
        response = openai_brain(user_input)
    elif mode == "ollama":
        response = ollama_brain(user_input)
    
    # Fallback to mock if other modes fail or if mock mode
    if response is None:
        response = mock_brain(user_input)
    
    # Store response in history
    conversation_history.append({"role": "assistant", "content": response})
    if len(conversation_history) > MAX_HISTORY * 2:
        conversation_history[:len(conversation_history) - MAX_HISTORY * 2] = []
    
    return response


def clear_history():
    """Clear conversation history."""
    global conversation_history
    conversation_history = []
    return "Conversation history has been cleared."


if __name__ == "__main__":
    # Test the brain
    print("JARVIS Brain Module - Testing")
    print("=" * 50)
    print(process_input("Hello"))
    print("---")
    print(process_input("What can you do?"))
    print("---")
    print(process_input("Tell me a joke"))
