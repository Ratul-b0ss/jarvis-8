/**
 * main.js - Jarvis Assistant UI Controller
 * 
 * Handles all UI interactions, WebSocket communication,
 * animations, and integration with voice.js
 */

class JarvisUI {
    constructor() {
        // DOM Elements
        this.chatMessages = document.getElementById('chatMessages');
        this.textInput = document.getElementById('textInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.micBtn = document.getElementById('micBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.typingIndicator = document.getElementById('typingIndicator');
        this.welcomeScreen = document.getElementById('welcomeScreen');
        this.voiceStatus = document.getElementById('voiceStatus');
        this.transcriptionOverlay = document.getElementById('transcriptionOverlay');
        this.toast = document.getElementById('toast');
        this.voiceWaveform = document.getElementById('voiceWaveform');
        
        // Socket.IO connection
        this.socket = null;
        this.connected = false;
        
        // Voice module
        this.voice = new JarvisVoice();
        
        // State
        this.isProcessing = false;
        this.autoSpeak = true;
        
        // Init
        this._initSocket();
        this._initEventListeners();
        this._initVoice();
        this._initParticles();
    }

    /**
     * Initialize WebSocket connection
     */
    _initSocket() {
        // Check if Socket.IO library loaded
        if (typeof io === 'undefined') {
            console.warn('[JARVIS] Socket.IO library failed to load. Using REST API fallback.');
            this._showToast('Real-time mode unavailable. Using REST API.');
            this.connected = false;
            document.getElementById('statusText').textContent = 'REST MODE';
            document.getElementById('statusText').style.color = 'var(--warning)';
            return;
        }
        
        this.socket = io({
            transports: ['websocket', 'polling']
        });

        this.socket.on('connect', () => {
            console.log('[JARVIS] Connected to server');
            this.connected = true;
            document.getElementById('statusText').textContent = 'ONLINE';
            document.getElementById('statusText').style.color = 'var(--accent)';
        });

        this.socket.on('disconnect', () => {
            console.log('[JARVIS] Disconnected from server');
            this.connected = false;
            document.getElementById('statusText').textContent = 'OFFLINE';
            document.getElementById('statusText').style.color = 'var(--danger)';
        });

        this.socket.on('jarvis_response', (data) => {
            this.isProcessing = false;
            this._hideTyping();
            
            // Add Jarvis response
            this._addMessage(data.response, 'jarvis');
            
            // Speak the response if auto-speak is on
            if (this.autoSpeak && this.voice.isTTSSupported()) {
                this.voice.speak(data.response);
            }
        });

        this.socket.on('error', (data) => {
            this.isProcessing = false;
            this._hideTyping();
            this._showToast(data.message || 'An error occurred');
        });

        this.socket.on('history_cleared', () => {
            this._showToast('Conversation history cleared');
        });
    }

    /**
     * Initialize event listeners
     */
    _initEventListeners() {
        // Send button
        this.sendBtn.addEventListener('click', () => this._sendMessage());
        
        // Enter key
        this.textInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this._sendMessage();
            }
        });
        
        // Clear button
        this.clearBtn.addEventListener('click', () => {
            this._clearChat();
        });
        
        // Mic button
        this.micBtn.addEventListener('click', () => {
            if (this.voice.isSpeechSupported()) {
                this.voice.toggleListening();
            } else {
                this._showToast('Voice input is not supported in this browser. Try Chrome or Edge.');
            }
        });
        
        // Input focus effect
        this.textInput.addEventListener('focus', () => {
            this.textInput.closest('.input-container').classList.add('focused');
        });
        
        this.textInput.addEventListener('blur', () => {
            this.textInput.closest('.input-container').classList.remove('focused');
        });
        
        // Scroll handling for auto-scroll
        this.chatMessages.addEventListener('scroll', () => {
            // Could add auto-scroll lock logic here
        });
    }

    /**
     * Initialize voice module callbacks
     */
    _initVoice() {
        // Update mic button when listening state changes
        this.voice.onListeningChange = (listening) => {
            if (listening) {
                this.micBtn.classList.add('listening');
                this.textInput.closest('.input-container').classList.add('listening');
                this.voiceWaveform.classList.add('active');
                this.voiceStatus.textContent = '🎤 Listening...';
                this.voiceStatus.classList.add('active');
                this._showTranscription('Listening...');
            } else {
                this.micBtn.classList.remove('listening');
                this.textInput.closest('.input-container').classList.remove('listening');
                this.voiceWaveform.classList.remove('active');
                this.voiceStatus.classList.remove('active');
                this._hideTranscription();
            }
        };

        // Handle transcript
        this.voice.onTranscript = (text, isFinal) => {
            if (isFinal && text.trim()) {
                this._showTranscription(text);
                setTimeout(() => this._hideTranscription(), 1500);
                
                // Send the transcribed text
                this._sendText(text);
            } else {
                this._showTranscription(text || '...');
            }
        };

        // Handle errors
        this.voice.onError = (message) => {
            this._showToast(message);
            this.voiceStatus.textContent = '⚠️ ' + message;
            this.voiceStatus.classList.add('error');
            setTimeout(() => {
                this.voiceStatus.classList.remove('error');
                this.voiceStatus.classList.remove('active');
            }, 3000);
        };

        // Handle speaking state
        this.voice.onSpeakingChange = (speaking) => {
            if (speaking) {
                document.querySelector('.status-dot').style.background = 'var(--warning)';
                document.querySelector('.status-dot').style.boxShadow = '0 0 8px rgba(255, 171, 0, 0.5)';
            } else {
                document.querySelector('.status-dot').style.background = 'var(--accent)';
                document.querySelector('.status-dot').style.boxShadow = '0 0 8px rgba(0, 255, 136, 0.5)';
            }
        };

        // Check speech support
        if (!this.voice.isSpeechSupported()) {
            this.micBtn.style.opacity = '0.4';
            this.micBtn.title = 'Voice not supported in this browser';
        }
    }

    /**
     * Send a text message
     */
    _sendMessage() {
        const text = this.textInput.value.trim();
        if (!text || this.isProcessing) return;
        
        this.textInput.value = '';
        this._sendText(text);
    }

    /**
     * Send text to the server
     */
    _sendText(text) {
        if (!text.trim()) return;
        
        // Add user message to chat
        this._addMessage(text, 'user');
        
        // Hide welcome screen
        this._hideWelcome();
        
        // Show typing indicator
        this._showTyping();
        this.isProcessing = true;
        
        // Send via WebSocket (or REST fallback)
        if (this.connected && this.socket.connected) {
            this.socket.emit('text_message', { message: text });
        } else {
            // REST fallback
            fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text })
            })
            .then(res => res.json())
            .then(data => {
                this.isProcessing = false;
                this._hideTyping();
                this._addMessage(data.response, 'jarvis');
                if (this.autoSpeak && this.voice.isTTSSupported()) {
                    this.voice.speak(data.response);
                }
            })
            .catch(err => {
                this.isProcessing = false;
                this._hideTyping();
                this._showToast('Connection error. Make sure the server is running.');
            });
        }
    }

    /**
     * Add a message to the chat
     */
    _addMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        
        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        
        const textSpan = document.createElement('span');
        textSpan.className = 'typewriter-text';
        
        if (sender === 'jarvis') {
            // Typewriter effect for Jarvis responses
            textSpan.textContent = '';
            bubble.appendChild(textSpan);
            
            const cursor = document.createElement('span');
            cursor.className = 'typewriter-cursor';
            bubble.appendChild(cursor);
            
            const timeDiv = document.createElement('div');
            timeDiv.className = 'message-time';
            timeDiv.textContent = this._getCurrentTime();
            bubble.appendChild(timeDiv);
            
            messageDiv.appendChild(bubble);
            this.chatMessages.appendChild(messageDiv);
            
            // Animate typewriter
            this._typewriterEffect(textSpan, cursor, text);
        } else {
            textSpan.textContent = text;
            bubble.appendChild(textSpan);
            
            const timeDiv = document.createElement('div');
            timeDiv.className = 'message-time';
            timeDiv.textContent = this._getCurrentTime();
            bubble.appendChild(timeDiv);
            
            messageDiv.appendChild(bubble);
            this.chatMessages.appendChild(messageDiv);
        }
        
        // Scroll to bottom
        this._scrollToBottom();
    }

    /**
     * Typewriter animation effect
     */
    _typewriterEffect(element, cursor, text, speed = 25) {
        let index = 0;
        element.textContent = '';
        
        function type() {
            if (index < text.length) {
                element.textContent += text.charAt(index);
                index++;
                setTimeout(type, speed + Math.random() * 20);
            } else {
                cursor.style.display = 'none';
            }
        }
        
        setTimeout(type, 300);
    }

    /**
     * Show typing indicator
     */
    _showTyping() {
        this.typingIndicator.classList.add('active');
        this._scrollToBottom();
    }

    /**
     * Hide typing indicator
     */
    _hideTyping() {
        this.typingIndicator.classList.remove('active');
    }

    /**
     * Hide welcome screen
     */
    _hideWelcome() {
        if (this.welcomeScreen && !this.welcomeScreen.classList.contains('hidden')) {
            this.welcomeScreen.classList.add('hidden');
        }
    }

    /**
     * Show transcription overlay
     */
    _showTranscription(text) {
        this.transcriptionOverlay.textContent = '🎤 ' + text;
        this.transcriptionOverlay.classList.add('active');
    }

    /**
     * Hide transcription overlay
     */
    _hideTranscription() {
        this.transcriptionOverlay.classList.remove('active');
    }

    /**
     * Show toast notification
     */
    _showToast(message) {
        this.toast.textContent = message;
        this.toast.classList.add('show');
        clearTimeout(this._toastTimeout);
        this._toastTimeout = setTimeout(() => {
            this.toast.classList.remove('show');
        }, 3000);
    }

    /**
     * Clear chat
     */
    _clearChat() {
        // Remove all messages except the first (welcome)
        const messages = this.chatMessages.querySelectorAll('.message');
        messages.forEach(msg => msg.remove());
        
        // Show welcome screen
        if (this.welcomeScreen) {
            this.welcomeScreen.classList.remove('hidden');
        }
        
        // Notify server
        if (this.socket && this.socket.connected) {
            this.socket.emit('clear_history');
        } else {
            fetch('/api/clear', { method: 'POST' })
                .catch(() => {});
        }
        
        this._showToast('Chat cleared');
    }

    /**
     * Scroll chat to bottom
     */
    _scrollToBottom() {
        requestAnimationFrame(() => {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        });
    }

    /**
     * Get current time string
     */
    _getCurrentTime() {
        const now = new Date();
        return now.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    }

    /**
     * Initialize particle background
     */
    _initParticles() {
        const canvas = document.getElementById('bgCanvas');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        let particles = [];
        let mouseX = 0;
        let mouseY = 0;
        
        function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        
        // Create particles
        const particleCount = Math.min(80, Math.floor(window.innerWidth / 15));
        
        class Particle {
            constructor() {
                this.reset();
            }
            
            reset() {
                this.x = Math.random() * canvas.width;
                this.y = Math.random() * canvas.height;
                this.size = Math.random() * 2 + 0.5;
                this.speedX = (Math.random() - 0.5) * 0.4;
                this.speedY = (Math.random() - 0.5) * 0.4;
                this.opacity = Math.random() * 0.5 + 0.1;
                this.hue = Math.random() < 0.6 ? 190 : 260; // Cyan or purple
            }
            
            update() {
                this.x += this.speedX;
                this.y += this.speedY;
                
                // Wrap around screen
                if (this.x < 0) this.x = canvas.width;
                if (this.x > canvas.width) this.x = 0;
                if (this.y < 0) this.y = canvas.height;
                if (this.y > canvas.height) this.y = 0;
                
                // Mouse interaction
                const dx = mouseX - this.x;
                const dy = mouseY - this.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 200) {
                    const force = (200 - dist) / 200 * 0.3;
                    this.x -= dx / dist * force;
                    this.y -= dy / dist * force;
                }
            }
            
            draw() {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fillStyle = `hsla(${this.hue}, 80%, 60%, ${this.opacity})`;
                ctx.shadowBlur = 10;
                ctx.shadowColor = `hsla(${this.hue}, 80%, 60%, ${this.opacity * 0.5})`;
                ctx.fill();
                ctx.shadowBlur = 0;
            }
        }
        
        for (let i = 0; i < particleCount; i++) {
            particles.push(new Particle());
        }
        
        // Track mouse
        document.addEventListener('mousemove', (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
        });
        
        // Animation loop
        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Draw connections
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    
                    if (dist < 150) {
                        ctx.beginPath();
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.strokeStyle = `rgba(0, 212, 255, ${0.06 * (1 - dist / 150)})`;
                        ctx.stroke();
                    }
                }
            }
            
            // Update and draw particles
            particles.forEach(p => {
                p.update();
                p.draw();
            });
            
            // No need - each particle resets its own shadow
            
            requestAnimationFrame(animate);
        }
        
        animate();
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.jarvis = new JarvisUI();
});
