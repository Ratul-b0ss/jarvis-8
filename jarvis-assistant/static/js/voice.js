/**
 * voice.js - Jarvis Voice Module
 * 
 * Handles browser-based speech recognition and text-to-speech
 * using the Web Speech API (SpeechRecognition & SpeechSynthesis).
 */

class JarvisVoice {
    constructor() {
        this.recognition = null;
        this.synthesis = window.speechSynthesis;
        this.isListening = false;
        this.isSpeaking = false;
        this.onTranscript = null;
        this.onListeningChange = null;
        this.onSpeakingChange = null;
        this.onError = null;
        
        // Check for browser support
        this.speechSupported = this._checkSpeechSupport();
        this.ttsSupported = this._checkTTSSupport();
        
        // Initialize speech recognition
        this._initRecognition();
    }

    /**
     * Check if SpeechRecognition is supported
     */
    _checkSpeechSupport() {
        const SpeechRecognition = window.SpeechRecognition || 
                                  window.webkitSpeechRecognition || 
                                  window.mozSpeechRecognition ||
                                  window.msSpeechRecognition;
        return !!SpeechRecognition;
    }

    /**
     * Check if SpeechSynthesis is supported
     */
    _checkTTSSupport() {
        return 'speechSynthesis' in window;
    }

    /**
     * Initialize the speech recognition engine
     */
    _initRecognition() {
        if (!this.speechSupported) return;

        const SpeechRecognition = window.SpeechRecognition || 
                                  window.webkitSpeechRecognition;
        
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';
        this.recognition.maxAlternatives = 1;

        // Handle results
        this.recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }

            if (this.onTranscript) {
                this.onTranscript(finalTranscript || interimTranscript, !!finalTranscript);
            }
        };

        // Handle end of speech
        this.recognition.onend = () => {
            if (this.isListening) {
                this.isListening = false;
                if (this.onListeningChange) {
                    this.onListeningChange(false);
                }
            }
        };

        // Handle errors
        this.recognition.onerror = (event) => {
            console.error('[JARVIS VOICE] Recognition error:', event.error);
            
            if (this.isListening) {
                this.isListening = false;
                if (this.onListeningChange) {
                    this.onListeningChange(false);
                }
            }

            if (this.onError) {
                let message = 'Voice recognition error';
                switch (event.error) {
                    case 'no-speech':
                        message = 'No speech was detected. Please try again.';
                        break;
                    case 'audio-capture':
                        message = 'No microphone was found. Please check your microphone.';
                        break;
                    case 'not-allowed':
                        message = 'Microphone access was denied. Please allow microphone access.';
                        break;
                    case 'network':
                        message = 'Network error. Please check your internet connection.';
                        break;
                    case 'aborted':
                        // Don't show error for user-initiated stops
                        return;
                    default:
                        message = `Voice recognition error: ${event.error}`;
                }
                this.onError(message);
            }
        };
    }

    /**
     * Start listening for voice input
     */
    startListening() {
        if (!this.speechSupported) {
            if (this.onError) {
                this.onError('Voice recognition is not supported in this browser. Please use Chrome or Edge.');
            }
            return false;
        }

        if (this.isListening) return false;

        try {
            // Reinitialize if needed
            if (!this.recognition) {
                this._initRecognition();
            }
            
            this.recognition.start();
            this.isListening = true;
            
            if (this.onListeningChange) {
                this.onListeningChange(true);
            }
            
            return true;
        } catch (error) {
            console.error('[JARVIS VOICE] Start error:', error);
            
            // If already started, try stopping and restarting
            if (error.name === 'InvalidStateError') {
                try {
                    this.recognition.stop();
                } catch (e) {}
                setTimeout(() => {
                    this.startListening();
                }, 100);
                return false;
            }
            
            if (this.onError) {
                this.onError('Failed to start voice recognition.');
            }
            return false;
        }
    }

    /**
     * Stop listening
     */
    stopListening() {
        if (!this.recognition || !this.isListening) return;
        
        try {
            this.recognition.stop();
        } catch (error) {
            console.error('[JARVIS VOICE] Stop error:', error);
        }
        
        this.isListening = false;
        if (this.onListeningChange) {
            this.onListeningChange(false);
        }
    }

    /**
     * Toggle listening state
     */
    toggleListening() {
        if (this.isListening) {
            this.stopListening();
        } else {
            this.startListening();
        }
        return this.isListening;
    }

    /**
     * Speak text using SpeechSynthesis (Jarvis-like voice)
     */
    speak(text) {
        if (!this.ttsSupported || this.isSpeaking) return;

        // Cancel any ongoing speech
        this.synthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        
        // Configure voice settings for Jarvis-like tone
        utterance.rate = 0.9;    // Slightly slower
        utterance.pitch = 0.85;  // Lower pitch (more male/Jarvis-like)
        utterance.volume = 1.0;
        
        // Try to find a good English voice
        const voices = this.synthesis.getVoices();
        
        // Prefer Google US English if available
        const preferredVoice = voices.find(v => 
            v.name.includes('Google US English') || 
            v.name.includes('Microsoft David') ||
            v.name.includes('Microsoft Mark') ||
            (v.lang.startsWith('en') && v.name.toLowerCase().includes('male'))
        );
        
        if (preferredVoice) {
            utterance.voice = preferredVoice;
        } else {
            // Fallback: find any English voice
            const englishVoice = voices.find(v => v.lang.startsWith('en'));
            if (englishVoice) utterance.voice = englishVoice;
        }

        // Events
        utterance.onstart = () => {
            this.isSpeaking = true;
            if (this.onSpeakingChange) this.onSpeakingChange(true);
        };

        utterance.onend = () => {
            this.isSpeaking = false;
            if (this.onSpeakingChange) this.onSpeakingChange(false);
        };

        utterance.onerror = (event) => {
            console.error('[JARVIS VOICE] Speech error:', event.error);
            this.isSpeaking = false;
            if (this.onSpeakingChange) this.onSpeakingChange(false);
        };

        // Speak
        this.synthesis.speak(utterance);
    }

    /**
     * Stop speaking
     */
    stopSpeaking() {
        if (this.synthesis) {
            this.synthesis.cancel();
            this.isSpeaking = false;
            if (this.onSpeakingChange) this.onSpeakingChange(false);
        }
    }

    /**
     * Check if speech recognition is supported
     */
    isSpeechSupported() {
        return this.speechSupported;
    }

    /**
     * Check if TTS is supported
     */
    isTTSSupported() {
        return this.ttsSupported;
    }

    /**
     * Get available voices
     */
    getVoices() {
        return this.synthesis.getVoices();
    }
}

// Export as global
window.JarvisVoice = JarvisVoice;
