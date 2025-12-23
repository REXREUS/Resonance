import { GoogleGenerativeAI } from '@google/generative-ai';
import * as SecureStore from 'expo-secure-store';
import { API_CONFIG } from '../constants/api';
import { documentProcessor } from '../utils/documentProcessor';
import { databaseService } from './databaseService';
import { 
  globalErrorHandler, 
  ResonanceError, 
  ErrorCode, 
  ErrorCategory,
  createNetworkError 
} from '../utils/errorHandler';

/**
 * Gemini Service for AI conversation logic and contextual reasoning
 * Handles conversation generation, emotion analysis, and coach feedback
 */
export class GeminiService {
  constructor() {
    this.genAI = null;
    this.model = null;
    this.config = null;
    this.conversationHistory = [];
    this.contextDocuments = [];
    this.isInitialized = false;
  }

  /**
   * Validate API key by making a test request
   * @param {string} apiKey - API key to validate
   * @returns {Promise<boolean>} - Whether the key is valid
   */
  async validateApiKey(apiKey) {
    try {
      if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
        console.error('Gemini API key validation failed: Invalid or empty key');
        return false;
      }

      const testGenAI = new GoogleGenerativeAI(apiKey.trim());
      const testModel = testGenAI.getGenerativeModel({ model: API_CONFIG.GEMINI.MODEL });
      
      // Make a simple test request with minimal tokens
      const result = await testModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: 'Hi' }] }],
        generationConfig: {
          maxOutputTokens: 5,
        }
      });
      const response = result.response.text();
      
      return response && response.length > 0;
    } catch (error) {
      // Log specific error for debugging but don't expose to user
      console.warn('Gemini API key validation failed:', error.message || error);
      return false;
    }
  }

  /**
   * Initialize the Gemini service with configuration
   * @param {Object|string} configOrApiKey - Configuration object or API key string
   * @param {string} configOrApiKey.apiKey - Gemini API key (if object)
   * @param {string} configOrApiKey.model - Model name (default: gemini-2.5-flash)
   * @param {number} configOrApiKey.temperature - Temperature for response generation
   * @param {number} configOrApiKey.maxTokens - Maximum tokens for response
   * @returns {Promise<boolean>} - Success status
   */
  async initialize(configOrApiKey = {}) {
    try {
      // Support both string (API key only) and object config
      let config = {};
      if (typeof configOrApiKey === 'string') {
        config = { apiKey: configOrApiKey };
      } else {
        config = configOrApiKey || {};
      }

      // Get API key from secure storage if not provided
      if (!config.apiKey) {
        const storedKey = await SecureStore.getItemAsync('api_key_gemini');
        if (!storedKey) {
          throw new ResonanceError(
            ErrorCode.GEMINI_API_ERROR,
            'Gemini API key not found',
            ErrorCategory.AI_SERVICE,
            false,
            'Please configure your Gemini API key in settings'
          );
        }
        config.apiKey = storedKey;
      }

      this.config = {
        model: API_CONFIG.GEMINI.MODEL,
        temperature: API_CONFIG.GEMINI.TEMPERATURE,
        maxTokens: API_CONFIG.GEMINI.MAX_TOKENS,
        ...config
      };

      this.genAI = new GoogleGenerativeAI(this.config.apiKey);
      this.model = this.genAI.getGenerativeModel({ 
        model: this.config.model,
        generationConfig: {
          temperature: this.config.temperature,
          maxOutputTokens: this.config.maxTokens,
        }
      });

      // Load cached context documents
      await this._loadContextDocuments();

      this.isInitialized = true;
      console.log('GeminiService initialized successfully');
      return true;
    } catch (error) {
      console.error('GeminiService initialization failed:', error);
      this.isInitialized = false;
      
      if (error instanceof ResonanceError) {
        throw error;
      }
      
      throw new ResonanceError(
        ErrorCode.SERVICE_INIT_FAILED,
        `GeminiService initialization failed: ${error.message}`,
        ErrorCategory.INITIALIZATION,
        true,
        'Failed to initialize AI service. Please check your API key and try again.'
      );
    }
  }

  /**
   * Generate AI response based on context and user input
   * @param {Object} context - Conversation context
   * @param {string} context.scenario - Training scenario type
   * @param {string} context.userRole - User's role in the scenario
   * @param {string} context.aiRole - AI's role in the scenario
   * @param {Array} context.contextDocuments - Uploaded context documents
   * @param {Array} context.conversationHistory - Previous conversation turns
   * @param {string} userInput - User's current input
   * @returns {Promise<string>} - AI response text
   */
  async generateResponse(context, userInput) {
    if (!this.isInitialized) {
      throw new Error('GeminiService not initialized');
    }

    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Build the conversation prompt
        const prompt = this._buildConversationPrompt(context, userInput);
        
        // Generate response
        const result = await this.model.generateContent(prompt);
        const response = result.response;
        const text = response.text();

        // Update conversation history
        this.conversationHistory.push(
          { role: 'user', content: userInput },
          { role: 'assistant', content: text }
        );

        console.log('Generated AI response:', text.substring(0, 100) + '...');
        return text;
      } catch (error) {
        lastError = error;
        console.warn(`Gemini API attempt ${attempt}/${maxRetries} failed:`, error.message);
        
        // Check if it's a retryable error (503, 429, network errors)
        const isRetryable = error.message?.includes('503') || 
                           error.message?.includes('429') ||
                           error.message?.includes('UNAVAILABLE') ||
                           error.message?.includes('RESOURCE_EXHAUSTED') ||
                           error.message?.includes('network') ||
                           error.message?.includes('timeout');
        
        if (isRetryable && attempt < maxRetries) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, attempt - 1) * 1000;
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        // Non-retryable error or max retries reached
        break;
      }
    }

    console.error('All Gemini API attempts failed:', lastError);
    // Fallback response for offline/error scenarios
    return this._getFallbackResponse(context, userInput);
  }

  /**
   * Analyze emotion from text input
   * @param {string} text - Text to analyze
   * @returns {Promise<string>} - Emotion state: 'neutral' | 'hostile' | 'happy' | 'frustrated' | 'anxious'
   */
  async analyzeEmotion(text) {
    if (!this.isInitialized) {
      return 'neutral';
    }

    try {
      const prompt = `Analyze the emotional tone of this text and respond with only one word from these options: neutral, hostile, happy, frustrated, anxious.

Text: "${text}"

Emotion:`;

      const result = await this.model.generateContent(prompt);
      const response = result.response.text().trim().toLowerCase();
      
      // Validate response is one of the expected emotions
      const validEmotions = ['neutral', 'hostile', 'happy', 'frustrated', 'anxious'];
      if (validEmotions.includes(response)) {
        return response;
      }
      
      return 'neutral';
    } catch (error) {
      console.error('Failed to analyze emotion:', error);
      return 'neutral';
    }
  }

  /**
   * Generate structured coach feedback for a completed session
   * @param {Object} sessionData - Session performance data
   * @param {number} sessionData.score - Overall session score (0-100)
   * @param {Object} sessionData.metrics - Performance metrics
   * @param {Array} sessionData.transcript - Conversation transcript
   * @param {Array} sessionData.emotionalTelemetry - Emotional state changes
   * @param {string} sessionData.language - Language preference ('id' or 'en')
   * @returns {Promise<Object>} - Structured feedback object
   */
  async generateCoachFeedback(sessionData) {
    if (!this.isInitialized) {
      return this._getFallbackFeedback(sessionData);
    }

    try {
      const prompt = this._buildCoachFeedbackPrompt(sessionData);
      
      const result = await this.model.generateContent(prompt);
      const response = result.response.text();
      
      // Parse the structured response
      const feedback = this._parseCoachFeedback(response);
      
      console.log('Generated coach feedback for session:', sessionData.sessionId);
      return feedback;
    } catch (error) {
      console.error('Failed to generate coach feedback:', error);
      return this._getFallbackFeedback(sessionData);
    }
  }

  /**
   * Generate global AI insight based on all sessions performance
   * @param {Array} sessions - Array of completed sessions
   * @param {string} language - Language preference ('id' or 'en')
   * @returns {Promise<string>} - AI insight text
   */
  async generateGlobalInsight(sessions, language = 'id') {
    if (!this.isInitialized || sessions.length === 0) {
      return this._getFallbackGlobalInsight(language);
    }

    try {
      const isIndonesian = language === 'id';
      const languageInstruction = isIndonesian 
        ? 'Berikan saran dalam Bahasa Indonesia yang natural dan mudah dipahami.'
        : 'Provide advice in clear, natural English.';

      // Calculate aggregate stats
      const completedSessions = sessions.filter(s => s.completed === 1);
      const avgScore = completedSessions.length > 0 
        ? Math.round(completedSessions.reduce((sum, s) => sum + (s.score || 0), 0) / completedSessions.length)
        : 0;
      const avgClarity = completedSessions.length > 0
        ? Math.round(completedSessions.reduce((sum, s) => sum + (s.clarity_score || 0), 0) / completedSessions.length)
        : 0;
      const avgConfidence = completedSessions.length > 0
        ? Math.round(completedSessions.reduce((sum, s) => sum + (s.confidence_score || 0), 0) / completedSessions.length)
        : 0;
      const avgPace = completedSessions.length > 0
        ? Math.round(completedSessions.reduce((sum, s) => sum + (s.pace || 0), 0) / completedSessions.length)
        : 0;
      const totalFillerWords = completedSessions.reduce((sum, s) => sum + (s.filler_word_count || 0), 0);

      const prompt = `You are an AI communication coach. Based on the user's training history, provide ONE personalized, actionable insight or advice.

${languageInstruction}

USER'S TRAINING STATISTICS:
- Total Sessions: ${completedSessions.length}
- Average Score: ${avgScore}/100
- Average Clarity: ${avgClarity}%
- Average Confidence: ${avgConfidence}%
- Average Pace: ${avgPace} WPM
- Total Filler Words Used: ${totalFillerWords}

INSTRUCTIONS:
- Provide exactly ONE sentence of personalized advice
- Be specific and actionable based on the statistics
- Focus on the area that needs most improvement
- Be encouraging but honest
- Keep it under 30 words
- Do NOT use quotes or quotation marks

RESPONSE:`;

      const result = await this.model.generateContent(prompt);
      const response = result.response.text().trim();
      
      // Clean up response - remove quotes if present
      const cleanedResponse = response.replace(/^["']|["']$/g, '').trim();
      
      console.log('Generated global AI insight');
      return cleanedResponse;
    } catch (error) {
      console.error('Failed to generate global insight:', error);
      return this._getFallbackGlobalInsight(language);
    }
  }

  /**
   * Get fallback global insight
   * @private
   */
  _getFallbackGlobalInsight(language) {
    const isIndonesian = language === 'id';
    
    const fallbackInsightsID = [
      "Terus berlatih untuk meningkatkan kepercayaan diri dalam komunikasi Anda.",
      "Fokus pada pengurangan kata-kata pengisi untuk komunikasi yang lebih jelas.",
      "Latihan yang konsisten akan membantu Anda menguasai situasi sulit.",
      "Perhatikan kecepatan bicara Anda untuk komunikasi yang lebih efektif."
    ];
    
    const fallbackInsightsEN = [
      "Keep practicing to build confidence in your communication skills.",
      "Focus on reducing filler words for clearer communication.",
      "Consistent practice will help you master challenging situations.",
      "Pay attention to your speaking pace for more effective communication."
    ];
    
    const insights = isIndonesian ? fallbackInsightsID : fallbackInsightsEN;
    return insights[Math.floor(Math.random() * insights.length)];
  }

  /**
   * Upload and process document for RAG context
   * @returns {Promise<Object>} - Processed document object
   */
  async uploadDocument() {
    try {
      if (!this.isInitialized) {
        throw new ResonanceError(
          ErrorCode.SERVICE_INIT_FAILED,
          'GeminiService not initialized',
          ErrorCategory.INITIALIZATION,
          false,
          'AI service not ready. Please restart the app.'
        );
      }

      // Pick document using document processor
      const document = await documentProcessor.pickDocument();
      if (!document) {
        return null; // User cancelled
      }

      // Validate document
      if (!documentProcessor.validateDocument(document)) {
        throw new ResonanceError(
          ErrorCode.INVALID_INPUT,
          'Invalid document format or size',
          ErrorCategory.VALIDATION,
          false,
          'Please select a valid PDF, DOCX, or TXT file under 10MB'
        );
      }

      // Store document in database
      await this._storeContextDocument(document);

      // Add to current context
      this.contextDocuments.push({
        name: document.name,
        content: document.content,
        type: 'document',
        uploadedAt: document.extractedAt
      });

      console.log(`Document uploaded and processed: ${document.name}`);
      return document;
    } catch (error) {
      console.error('Failed to upload document:', error);
      
      if (error instanceof ResonanceError) {
        throw error;
      }
      
      throw new ResonanceError(
        ErrorCode.GEMINI_API_ERROR,
        `Document upload failed: ${error.message}`,
        ErrorCategory.AI_SERVICE,
        true,
        'Failed to process document. Please try again with a different file.'
      );
    }
  }

  /**
   * Add context documents for RAG (Retrieval Augmented Generation)
   * @param {Array} documents - Array of document objects with text content
   */
  addContextDocuments(documents) {
    this.contextDocuments = documents.map(doc => ({
      name: doc.name,
      content: doc.content,
      type: doc.type || 'text',
      uploadedAt: doc.uploadedAt || Date.now()
    }));
    
    console.log(`Added ${documents.length} context documents`);
  }

  /**
   * Remove context document by name
   * @param {string} documentName - Name of document to remove
   */
  async removeContextDocument(documentName) {
    try {
      // Remove from current context
      this.contextDocuments = this.contextDocuments.filter(
        (doc) => doc.name !== documentName
      );

      // Remove from database - find by file_name and delete
      const files = await databaseService.getContextFiles();
      const fileToDelete = files.find((f) => f.file_name === documentName);
      if (fileToDelete) {
        await databaseService.deleteContextFile(fileToDelete.id);
      }

      console.log(`Context document removed: ${documentName}`);
    } catch (error) {
      console.error('Failed to remove context document:', error);
      throw error;
    }
  }

  /**
   * Get list of current context documents
   * @returns {Array} - Array of context document metadata
   */
  getContextDocuments() {
    return this.contextDocuments.map(doc => ({
      name: doc.name,
      type: doc.type,
      uploadedAt: doc.uploadedAt,
      contentLength: doc.content?.length || 0
    }));
  }

  /**
   * Clear conversation history
   */
  clearHistory() {
    this.conversationHistory = [];
    console.log('Conversation history cleared');
  }

  /**
   * Get current conversation history
   * @returns {Array} - Conversation history
   */
  getHistory() {
    return [...this.conversationHistory];
  }

  /**
   * Build conversation prompt with context and history
   * @private
   */
  _buildConversationPrompt(context, userInput) {
    // Determine language instruction - CRITICAL for language enforcement
    const isIndonesian = context.language === 'id';
    const languageInstruction = isIndonesian 
      ? 'WAJIB MUTLAK: Anda HARUS merespons HANYA dalam Bahasa Indonesia. DILARANG KERAS menggunakan Bahasa Inggris. Setiap kata dalam respons Anda WAJIB dalam Bahasa Indonesia yang natural dan alami. Jika Anda merespons dalam bahasa lain, itu adalah KESALAHAN FATAL.'
      : 'ABSOLUTE REQUIREMENT: You MUST respond ONLY in English. Using any other language is STRICTLY FORBIDDEN. Every word in your response MUST be in natural English.';

    const languageName = isIndonesian ? 'Bahasa Indonesia' : 'English';

    // Build context documents section
    let contextSection = '';
    if (this.contextDocuments.length > 0) {
      contextSection = `\n\nCONTEXT DOCUMENTS (Use this information to inform your responses):\n`;
      this.contextDocuments.forEach((doc, index) => {
        contextSection += `\n--- Document ${index + 1}: ${doc.name} ---\n${doc.content}\n`;
      });
      contextSection += '\n--- End of Context Documents ---\n';
    }

    // Build conversation history section
    let historySection = '';
    if (this.conversationHistory.length > 0) {
      historySection = `\nCONVERSATION HISTORY:\n${this.conversationHistory.map(turn => `${turn.role.toUpperCase()}: ${turn.content}`).join('\n')}\n`;
    }

    // Build prompt with stronger language enforcement
    let prompt;
    
    if (isIndonesian) {
      prompt = `Anda adalah asisten AI dalam simulasi pelatihan komunikasi berisiko tinggi.

=== PERSYARATAN BAHASA WAJIB ===
${languageInstruction}
BAHASA TARGET: ${languageName}
=== AKHIR PERSYARATAN BAHASA ===

SKENARIO: ${context.scenario}
PERAN ANDA: ${context.aiRole}
PERAN PENGGUNA: ${context.userRole}
${contextSection}${historySection}
INSTRUKSI:
- Tetap dalam karakter sebagai ${context.aiRole}
- Buat skenario yang realistis dan menantang sesuai dengan ${context.scenario}
- Respons secara natural dan percakapan
- Variasikan nada emosional untuk menciptakan skenario pelatihan yang realistis
- Jaga respons tetap singkat tapi menarik (1-3 kalimat)
- Tantang pengguna sesuai dengan tingkat pelatihan mereka
- KRITIS: SEMUA respons Anda WAJIB dalam ${languageName}. Ini tidak bisa ditawar.

INPUT PENGGUNA: ${userInput}

RESPONS (dalam ${languageName}):`;
    } else {
      prompt = `You are an AI assistant in a high-stakes communication training simulation.

=== CRITICAL LANGUAGE REQUIREMENT ===
${languageInstruction}
TARGET LANGUAGE: ${languageName}
=== END LANGUAGE REQUIREMENT ===

SCENARIO: ${context.scenario}
YOUR ROLE: ${context.aiRole}
USER ROLE: ${context.userRole}
${contextSection}${historySection}
INSTRUCTIONS:
- Stay in character as ${context.aiRole}
- Create realistic, challenging scenarios appropriate for ${context.scenario}
- Respond naturally and conversationally
- Vary your emotional tone to create realistic training scenarios
- Keep responses concise but engaging (1-3 sentences)
- Challenge the user appropriately for their training level
- CRITICAL: ALL your responses MUST be in ${languageName}. This is non-negotiable.

USER INPUT: ${userInput}

RESPONSE (in ${languageName}):`;
    }

    return prompt;
  }

  /**
   * Build coach feedback prompt
   * @private
   */
  _buildCoachFeedbackPrompt(sessionData) {
    return `Analyze this communication training session and provide structured feedback.

SESSION DATA:
- Overall Score: ${sessionData.score}/100
- Pace: ${sessionData.metrics.pace} WPM
- Filler Words: ${sessionData.metrics.fillerWordCount}
- Clarity: ${sessionData.metrics.clarity}%
- Confidence: ${sessionData.metrics.confidence}%
- Duration: ${sessionData.metrics.duration} seconds

TRANSCRIPT:
${sessionData.transcript.map(entry => `${entry.sender.toUpperCase()}: ${entry.text}`).join('\n')}

EMOTIONAL TELEMETRY:
${sessionData.emotionalTelemetry.map(point => `${point.timestamp}ms: ${point.state} (${point.intensity})`).join('\n')}

Please provide feedback in this exact format:

POSITIVE ASPECTS:
- [List 2-3 specific positive aspects]

IMPROVEMENT AREAS:
- [List 2-3 specific areas for improvement]

NEXT STEPS:
- [List 2-3 actionable next steps]

OVERALL SUMMARY:
[2-3 sentence summary of the session]`;
  }

  /**
   * Parse structured coach feedback from AI response
   * @private
   */
  _parseCoachFeedback(response) {
    const sections = {
      positiveAspects: [],
      improvementAreas: [],
      nextSteps: [],
      overallSummary: ''
    };

    try {
      const lines = response.split('\n');
      let currentSection = null;

      for (const line of lines) {
        const trimmed = line.trim();
        
        if (trimmed.startsWith('POSITIVE ASPECTS:')) {
          currentSection = 'positiveAspects';
        } else if (trimmed.startsWith('IMPROVEMENT AREAS:')) {
          currentSection = 'improvementAreas';
        } else if (trimmed.startsWith('NEXT STEPS:')) {
          currentSection = 'nextSteps';
        } else if (trimmed.startsWith('OVERALL SUMMARY:')) {
          currentSection = 'overallSummary';
        } else if (trimmed.startsWith('- ') && currentSection !== 'overallSummary') {
          sections[currentSection].push(trimmed.substring(2));
        } else if (currentSection === 'overallSummary' && trimmed) {
          sections.overallSummary += (sections.overallSummary ? ' ' : '') + trimmed;
        }
      }
    } catch (error) {
      console.error('Failed to parse coach feedback:', error);
    }

    return sections;
  }

  /**
   * Get fallback response for offline/error scenarios
   * @private
   */
  _getFallbackResponse(context, userInput) {
    // Check language from context
    const isIndonesian = context?.language === 'id';
    
    const fallbackResponsesEN = [
      "I understand your concern. Let me think about this situation.",
      "That's an interesting point. How would you handle this differently?",
      "I see what you're saying. What's your next step here?",
      "Let me clarify something with you about this situation.",
      "I appreciate your perspective. Can you elaborate on that?"
    ];

    const fallbackResponsesID = [
      "Saya mengerti kekhawatiran Anda. Mari kita pikirkan situasi ini.",
      "Itu poin yang menarik. Bagaimana Anda akan menangani ini secara berbeda?",
      "Saya paham maksud Anda. Apa langkah selanjutnya?",
      "Izinkan saya mengklarifikasi sesuatu tentang situasi ini.",
      "Saya menghargai perspektif Anda. Bisakah Anda jelaskan lebih lanjut?"
    ];

    const responses = isIndonesian ? fallbackResponsesID : fallbackResponsesEN;
    const randomIndex = Math.floor(Math.random() * responses.length);
    return responses[randomIndex];
  }

  /**
   * Get fallback feedback for offline/error scenarios
   * @private
   */
  _getFallbackFeedback(sessionData) {
    return {
      positiveAspects: [
        "You maintained engagement throughout the conversation",
        "Your responses showed good understanding of the situation"
      ],
      improvementAreas: [
        "Consider reducing filler words to improve clarity",
        "Work on maintaining consistent pace during responses"
      ],
      nextSteps: [
        "Practice active listening techniques",
        "Focus on clear, concise communication"
      ],
      overallSummary: `You completed the session with a score of ${sessionData.score}/100. Continue practicing to improve your communication skills.`
    };
  }

  /**
   * Load cached context documents from database
   * @private
   */
  async _loadContextDocuments() {
    try {
      const documents = await databaseService.getContextFiles();

      this.contextDocuments = documents.map((doc) => ({
        name: doc.file_name,
        content: doc.extracted_text_content,
        type: 'document',
        uploadedAt: doc.uploaded_at,
      }));

      console.log(`Loaded ${documents.length} cached context documents`);
    } catch (error) {
      console.warn('Failed to load cached context documents:', error);
      this.contextDocuments = [];
    }
  }

  /**
   * Store context document in database
   * @private
   */
  async _storeContextDocument(document) {
    try {
      await databaseService.createContextFile(
        document.name,
        document.content,
        document.size
      );
    } catch (error) {
      console.error('Failed to store context document:', error);
      throw error;
    }
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.genAI = null;
    this.model = null;
    this.conversationHistory = [];
    this.contextDocuments = [];
    this.isInitialized = false;
    console.log('GeminiService cleaned up');
  }
}

// Export singleton instance
export const geminiService = new GeminiService();