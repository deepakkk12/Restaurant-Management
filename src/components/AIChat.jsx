import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, Mic, MicOff, X, Minimize2, Maximize2, Volume2, VolumeX, Bot, User } from 'lucide-react';
import { useCustomerAuth } from '../context/CustomerAuthContext';
import { useCustomerData } from '../context/CustomerDataContext';

const AIChat = () => {
  const { user } = useCustomerAuth();
  const { restaurants } = useCustomerData();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([
    { id: 1, text: `Namaste${user?.name ? ` ${user.name}` : ''}! I'm your AI restaurant assistant powered by Google Gemini. I can help you discover authentic Indian cuisine, suggest the best dishes from our ${restaurants.length} Indian restaurants, help with bookings, and provide personalized recommendations based on your taste preferences. What delicious Indian food are you craving today?`, sender: 'ai', timestamp: new Date() }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [position, setPosition] = useState({ 
    x: typeof window !== 'undefined' ? Math.max(20, window.innerWidth - 420) : 20, 
    y: 100 
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  const messagesEndRef = useRef(null);
  const chatRef = useRef(null);
  const recognitionRef = useRef(null);
  const synthRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize speech synthesis
  useEffect(() => {
    if ('speechSynthesis' in window) {
      synthRef.current = window.speechSynthesis;
    }
  }, []);

  // Responsive positioning
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 768;
      if (isMobile) {
        setPosition({ x: 10, y: 10 });
      } else {
        setPosition({ x: Math.max(20, window.innerWidth - 420), y: 100 });
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Enhanced AI responses with Gemini API integration
  const getContextualResponse = async (userMessage) => {
    const message = userMessage.toLowerCase();
    
    // Create context about available restaurants
    const restaurantContext = restaurants.map(r => 
      `${r.name} (${r.cuisine}) - Rating: ${r.rating}, Address: ${r.address}, Available tables: ${r.available_tables || 0}`
    ).join('\n');
    
    const systemPrompt = `You are an AI restaurant assistant for RestaurantAI platform specializing in INDIAN CUISINE. You are an expert on Indian food, spices, flavors, and regional cuisines.

    Your responsibilities:
    - Recommend authentic Indian dishes based on user preferences
    - Suggest restaurants based on cuisine type (North Indian, South Indian, Street Food)
    - Explain Indian dishes, ingredients, and spice levels
    - Help with dietary accommodations (vegetarian, vegan, gluten-free options)
    - Assist with table bookings and special occasions
    - Provide personalized menu suggestions
    - Share information about Indian culinary traditions

    Current available Indian restaurants:
    ${restaurantContext}

    User context: ${user?.name ? `Customer name is ${user.name}` : 'Guest user'}

    IMPORTANT INSTRUCTIONS:
    - Always be enthusiastic about Indian cuisine and use some Indian greetings naturally (Namaste, etc.)
    - When asked about specific restaurants, provide detailed and accurate recommendations from the available restaurants
    - For dish recommendations, mention specific items from restaurant menus with prices in rupees
    - Explain spice levels and flavors when relevant
    - If asked about "best food" from a restaurant, recommend their signature dishes with descriptions
    - Be conversational, warm, and knowledgeable like a friendly Indian food expert
    - Keep responses concise but informative (2-4 sentences)

    Respond naturally as if you're a real person who loves Indian food and wants to help customers have an amazing dining experience!`;

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=AIzaSyBj2JX-nIFFUkAEoCumuoR13f-I6adgcXY`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `${systemPrompt}\n\nUser message: ${userMessage}\n\nPlease provide a helpful response about restaurants, bookings, or dining recommendations.`
            }]
          }],
          generationConfig: {
            temperature: 0.9,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 250,
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (aiResponse) {
          return aiResponse.trim();
        }
      }
    } catch (error) {
      console.error('Gemini API error:', error);
    }

    // Fallback to contextual responses if Gemini API fails
    return getLocalContextualResponse(message);
  };

  // Local fallback responses
  const getLocalContextualResponse = (message) => {
    
    // Booking related
    if (message.includes('book') || message.includes('reservation') || message.includes('table')) {
      return `Namaste! I'd be delighted to help you book a table at one of our authentic Indian restaurants! We have ${restaurants.length} wonderful options - from North Indian classics to South Indian specialties and Mumbai street food. Which cuisine are you in the mood for, and what date and time would you prefer?`;
    }
    
    // Menu and food related
    if (message.includes('menu') || message.includes('food') || message.includes('dish') || message.includes('eat') || message.includes('recommend') || message.includes('suggest') || message.includes('best')) {
      const restaurantNames = restaurants.map(r => `${r.name} (${r.cuisine})`).join(', ');
      return `I'd love to recommend some amazing Indian dishes! We have ${restaurantNames}. Are you craving spicy curries, tandoori delights, crispy dosas, or Mumbai street food? Tell me your preference and I'll suggest the best dishes with prices!`;
    }
    
    // Dietary restrictions
    if (message.includes('vegetarian') || message.includes('vegan') || message.includes('gluten') || message.includes('allergy')) {
      return "I understand dietary requirements are important! I can filter all our restaurant options and menu items based on your specific needs. We have excellent vegetarian, vegan, gluten-free, and allergy-friendly options. What dietary preferences should I keep in mind for your recommendations?";
    }
    
    // Spice level queries
    if (message.includes('spicy') || message.includes('spice') || message.includes('hot') || message.includes('mild')) {
      return "Great question about spice levels! Indian cuisine offers everything from mild and creamy dishes like Butter Chicken and Korma to fiery options like Vindaloo. Most restaurants can adjust spice levels to your preference. Would you like recommendations for mild, medium, or spicy dishes?";
    }
    
    // Pricing and budget
    if (message.includes('price') || message.includes('cost') || message.includes('budget') || message.includes('expensive') || message.includes('cheap') || message.includes('affordable')) {
      return "I can help you find delicious Indian food for any budget! Street food options start from ₹79, while premium dishes go up to ₹599. Mumbai Masala offers affordable street food (₹79-₹169), while Taj Mahal Palace has royal dining experiences (₹299-₹599). What's your budget per person?";
    }
    
    // Location and directions
    if (message.includes('location') || message.includes('address') || message.includes('direction') || message.includes('near')) {
      return "I can help you find restaurants in your preferred area! Are you looking for something nearby, or do you have a specific neighborhood in mind? I can also provide directions and estimated travel times to any of our partner restaurants.";
    }
    
    // Hours and availability
    if (message.includes('open') || message.includes('hours') || message.includes('time') || message.includes('available')) {
      return "I can check real-time availability and operating hours for all our restaurants! Most of our partners are open for lunch and dinner, with some offering breakfast and late-night dining. Which restaurant are you interested in, and what time were you planning to visit?";
    }
    
    // Special occasions
    if (message.includes('birthday') || message.includes('anniversary') || message.includes('celebration') || message.includes('special') || message.includes('party')) {
      return "How wonderful! Let's make your celebration special with authentic Indian cuisine! Taj Mahal Palace is perfect for elegant occasions with its royal ambiance, while Mumbai Masala is great for fun, casual parties. We can arrange special thalis, biryani platters, and traditional Indian sweets. What's the occasion and how many guests?";
    }
    
    // Default responses for general queries
    const defaultResponses = [
      `Namaste! I'm your AI assistant specializing in authentic Indian cuisine. I can recommend the perfect Indian restaurant, suggest delicious dishes from tandoori to dosas, help with bookings, and answer any questions about Indian food. We have ${restaurants.length} amazing Indian restaurants. What would you like to explore?`,
      `Hello! As your Indian food expert, I can help you discover the rich flavors of North Indian curries, South Indian specialties, and Mumbai street food. Whether you want mild or spicy, vegetarian or non-veg, I'll guide you to the perfect meal. What type of Indian cuisine interests you?`,
      `Hi there! I'm here to help you experience the best of Indian cuisine from our ${restaurants.length} partner restaurants. From royal biryanis to crispy dosas and spicy chaats, I can recommend dishes that match your taste preferences. What are you craving today?`,
      `Namaste! I'm powered by Google Gemini and I'm passionate about Indian food! I can suggest restaurants based on cuisine type, recommend specific dishes with prices, explain spice levels, and help with bookings. What would you like to know about our Indian restaurants?`,
      `Welcome! Let me help you discover authentic Indian flavors. Whether you're new to Indian cuisine or a regular fan, I can suggest the perfect dishes from our ${restaurants.length} restaurants, explain ingredients, and ensure you have an amazing dining experience. How can I help you today?`
    ];
    
    return defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
  };

  const speakText = (text) => {
    if (voiceEnabled && synthRef.current && 'speechSynthesis' in window) {
      synthRef.current.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 0.8;
      
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      
      synthRef.current.speak(utterance);
    }
  };

  const handleSendMessage = async () => {
    if (inputMessage.trim() === '') return;

    const newMessage = {
      id: messages.length + 1,
      text: inputMessage,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, newMessage]);
    const currentInput = inputMessage;
    setInputMessage('');
    setIsTyping(true);

    // Generate contextual response with Gemini AI
    try {
      const aiResponseText = await getContextualResponse(currentInput);
      const aiResponse = {
        id: messages.length + 2,
        text: aiResponseText,
        sender: 'ai',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiResponse]);
      setIsTyping(false);
      
      speakText(aiResponse.text);
    } catch (error) {
      console.error('Error generating AI response:', error);
      const fallbackResponse = {
        id: messages.length + 2,
        text: "I apologize, but I'm having trouble processing your request right now. Please try again, and I'll do my best to help you with your dining needs!",
        sender: 'ai',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, fallbackResponse]);
      setIsTyping(false);
    }
  };

  const handleVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert('Speech recognition is not supported in this browser.');
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInputMessage(transcript);
      setIsListening(false);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const toggleVoice = () => {
    setVoiceEnabled(!voiceEnabled);
    if (voiceEnabled && synthRef.current) {
      synthRef.current.cancel();
      setIsSpeaking(false);
    }
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    const rect = chatRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      const isMobile = window.innerWidth < 768;
      const maxX = window.innerWidth - (isMobile ? 320 : 400);
      const maxY = window.innerHeight - (isMinimized ? 70 : 550);
      
      setPosition({
        x: Math.max(0, Math.min(maxX, e.clientX - dragOffset.x)),
        y: Math.max(0, Math.min(maxY, e.clientY - dragOffset.y))
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed ${isMobile ? 'bottom-4 right-4' : 'bottom-6 right-6'} bg-gradient-to-r from-blue-600 to-purple-600 text-white p-3 md:p-4 rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-110 z-50 animate-pulse`}
      >
        <MessageCircle className="w-5 h-5 md:w-6 md:h-6" />
        <div className="absolute -top-1 -right-1 w-3 h-3 md:w-4 md:h-4 bg-green-500 rounded-full animate-ping"></div>
      </button>
    );
  }

  return (
    <div
      ref={chatRef}
      className="fixed z-50 bg-slate-900/98 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/60 overflow-hidden"
      style={{
        left: position.x,
        top: position.y,
        width: isMobile ? '90vw' : (isMinimized ? '320px' : '400px'),
        height: isMinimized ? '70px' : (isMobile ? '80vh' : '550px'),
        maxWidth: isMobile ? '350px' : '400px'
      }}
    >
      {/* Header */}
      <div
        className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-3 md:p-4 rounded-t-2xl cursor-move flex items-center justify-between shadow-lg"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center space-x-2 md:space-x-3">
          <div className="relative">
            <Bot className="w-5 h-5 md:w-6 md:h-6 text-white" />
            <div className="absolute -bottom-1 -right-1 w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          </div>
          <div>
            <h3 className="font-semibold text-sm md:text-base">AI Restaurant Assistant</h3>
            <p className="text-xs text-blue-100">Smart Dining Helper</p>
          </div>
        </div>
        <div className="flex items-center space-x-1 md:space-x-2">
          <button
            onClick={toggleVoice}
            className="text-white hover:text-gray-200 transition-colors p-1"
            title={voiceEnabled ? "Disable Voice" : "Enable Voice"}
          >
            {voiceEnabled ? <Volume2 className="w-3 h-3 md:w-4 md:h-4" /> : <VolumeX className="w-3 h-3 md:w-4 md:h-4" />}
          </button>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="text-white hover:text-gray-200 transition-colors"
          >
            {isMinimized ? <Maximize2 className="w-3 h-3 md:w-4 md:h-4" /> : <Minimize2 className="w-3 h-3 md:w-4 md:h-4" />}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="text-white hover:text-gray-200 transition-colors"
          >
            <X className="w-3 h-3 md:w-4 md:h-4" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <div className="flex-1 p-3 md:p-4 space-y-3 md:space-y-4 overflow-y-auto bg-slate-800/80" style={{ height: isMobile ? 'calc(80vh - 140px)' : '380px' }}>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex items-start space-x-2 max-w-[85%] ${message.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                    message.sender === 'user' ? 'bg-blue-600' : 'bg-purple-600'
                  }`}>
                    {message.sender === 'user' ? 
                      <User className="w-3 h-3 text-white" /> : 
                      <Bot className="w-3 h-3 text-white" />
                    }
                  </div>
                  <div
                    className={`p-3 rounded-2xl backdrop-blur-sm border shadow-lg ${
                      message.sender === 'user'
                        ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white border-blue-400/50 shadow-blue-500/30'
                        : 'bg-slate-700/95 text-white border-slate-600/60 shadow-slate-900/30'
                    }`}
                  >
                    <p className="text-xs md:text-sm leading-relaxed text-white font-medium">{message.text}</p>
                    <p className="text-xs opacity-70 mt-2 text-slate-200">
                      {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            
            {isTyping && (
              <div className="flex justify-start">
                <div className="flex items-start space-x-2">
                  <div className="w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center">
                    <Bot className="w-3 h-3 text-white" />
                  </div>
                  <div className="bg-slate-700/95 backdrop-blur-sm text-white p-3 rounded-2xl border border-slate-600/60 shadow-lg">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {isSpeaking && (
              <div className="flex justify-start">
                <div className="flex items-start space-x-2">
                  <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center">
                    <Volume2 className="w-3 h-3 text-white animate-pulse" />
                  </div>
                  <div className="bg-green-600/90 backdrop-blur-sm text-white p-3 rounded-2xl border border-green-500/50 shadow-lg">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs md:text-sm text-white">Speaking...</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 md:p-4 bg-slate-800/95 backdrop-blur-sm border-t border-slate-600/60">
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Ask about restaurants, bookings, menus..."
                className="flex-1 px-3 py-2 md:px-4 md:py-3 bg-slate-700/95 border border-slate-600/60 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent backdrop-blur-sm text-sm md:text-base"
              />
              <button
                onClick={handleVoiceInput}
                className={`p-2 md:p-3 rounded-xl transition-all duration-200 ${
                  isListening 
                    ? 'bg-red-500 text-white animate-pulse' 
                    : 'bg-slate-700/95 text-white hover:bg-slate-600/95 border border-slate-600/60'
                }`}
                title={isListening ? "Stop listening" : "Start voice input"}
              >
                {isListening ? <MicOff className="w-3 h-3 md:w-4 md:h-4" /> : <Mic className="w-3 h-3 md:w-4 md:h-4" />}
              </button>
              <button
                onClick={handleSendMessage}
                disabled={inputMessage.trim() === ''}
                className="p-2 md:p-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl hover:from-blue-600 hover:to-purple-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              >
                <Send className="w-3 h-3 md:w-4 md:h-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AIChat;