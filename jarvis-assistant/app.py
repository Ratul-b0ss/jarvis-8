"""
app.py - Jarvis Assistant Web Server

A Flask-based web application with:
- Real-time chat via Flask-SocketIO
- AI-powered responses
- Jarvis-inspired HUD interface

Run with: python app.py
"""

import os
import sys
import json
import logging

from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_socketio import SocketIO, emit

# Import Jarvis modules
from jarvis_brain import process_input, clear_history
from jarvis_voice import speak_text, is_tts_available

# Configure logging
logging.basicConfig(level=logging.INFO, format='[JARVIS] %(message)s')
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = os.urandom(24).hex()
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max upload

# Initialize SocketIO with eventlet
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# ============================================================
# ROUTES
# ============================================================

@app.route('/')
def index():
    """Serve the main Jarvis interface."""
    tts_avail = is_tts_available()
    logger.info(f"TTS Available: {tts_avail}")
    return render_template('index.html', tts_available=str(tts_avail).lower())


@app.route('/static/<path:filename>')
def static_files(filename):
    """Serve static files."""
    return send_from_directory('static', filename)


@app.route('/api/chat', methods=['POST'])
def chat_api():
    """REST API endpoint for text chat (fallback if WebSocket fails)."""
    data = request.get_json()
    if not data or 'message' not in data:
        return jsonify({'error': 'No message provided'}), 400
    
    user_message = data['message'].strip()
    if not user_message:
        return jsonify({'error': 'Empty message'}), 400
    
    logger.info(f"User (REST): {user_message[:100]}")
    
    # Process through AI brain
    response = process_input(user_message)
    
    logger.info(f"Jarvis: {response[:100]}")
    return jsonify({'response': response, 'timestamp': __import__('datetime').datetime.now().isoformat()})


@app.route('/api/speak', methods=['POST'])
def speak_api():
    """API endpoint to trigger server-side TTS (optional fallback)."""
    data = request.get_json()
    if not data or 'text' not in data:
        return jsonify({'error': 'No text provided'}), 400
    
    success = speak_text(data['text'])
    return jsonify({'success': success})


@app.route('/api/clear', methods=['POST'])
def clear_chat():
    """Clear conversation history."""
    msg = clear_history()
    return jsonify({'message': msg})


# ============================================================
# SOCKETIO EVENTS (Real-time communication)
# ============================================================

@socketio.on('connect')
def handle_connect():
    logger.info(f"Client connected: {request.sid}")


@socketio.on('disconnect')
def handle_disconnect():
    logger.info(f"Client disconnected: {request.sid}")


@socketio.on('text_message')
def handle_text_message(data):
    """Handle incoming text messages via WebSocket."""
    user_message = data.get('message', '').strip()
    if not user_message:
        emit('error', {'message': 'Empty message'})
        return
    
    logger.info(f"User (WS): {user_message[:100]}")
    
    # Process through AI brain
    response = process_input(user_message)
    
    logger.info(f"Jarvis: {response[:100]}")
    emit('jarvis_response', {
        'response': response,
        'timestamp': __import__('datetime').datetime.now().isoformat()
    })


@socketio.on('clear_history')
def handle_clear_history():
    """Clear conversation history."""
    msg = clear_history()
    emit('history_cleared', {'message': msg})


# ============================================================
# MAIN
# ============================================================

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5000))
    host = os.getenv('HOST', '0.0.0.0')
    debug = os.getenv('DEBUG', 'false').lower() == 'true'
    
    # Check for .env file
    try:
        from dotenv import load_dotenv
        load_dotenv()
        logger.info("Loaded .env file")
    except ImportError:
        pass
    
    logger.info(f"🤖 JARVIS Assistant starting on {host}:{port}")
    logger.info(f"📝 Mode: Text + Voice input supported")
    logger.info(f"🔊 TTS Available: {is_tts_available()}")
    logger.info("=" * 50)
    
    # Try SocketIO with eventlet first, fallback to standard Flask server
    try:
        socketio.run(app, host=host, port=port, debug=debug, allow_unsafe_werkzeug=True)
    except Exception as e:
        logger.warning(f"SocketIO failed to start: {e}")
        logger.warning("Falling back to standard Flask server (REST API mode)")
        app.run(host=host, port=port, debug=debug)
