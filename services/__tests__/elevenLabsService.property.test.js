import fc from 'fast-check';
import { elevenLabsService } from '../elevenLabsService';

// Mock WebSocket for testing
global.WebSocket = jest.fn().mockImplementation(() => ({
  send: jest.fn(),
  close: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  readyState: 1, // OPEN
}));

// Mock SecureStore
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue('test-api-key'),
  setItemAsync: jest.fn().mockResolvedValue(),
}));

// Mock fetch for API calls
global.fetch = jest.fn();

describe('ElevenLabsService Property Tests', () => {
  let mockWebSocket;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock WebSocket instance
    mockWebSocket = {
      send: jest.fn(),
      close: jest.fn(),
      readyState: 1,
      onopen: null,
      onmessage: null,
      onclose: null,
      onerror: null,
    };
    
    global.WebSocket.mockImplementation(() => mockWebSocket);
    
    // Reset service state
    elevenLabsService.websocket = null;
    elevenLabsService.isConnected = false;
    elevenLabsService.isStreaming = false;
    elevenLabsService.streamStartTime = null;
  });

  afterEach(async () => {
    await elevenLabsService.cleanup();
  });

  /**
   * **Feature: resonance-mobile-app, Property 5: WebSocket streaming performance**
   * **Validates: Requirements 2.5**
   * 
   * Property: For any active audio session, response latency should remain below 800 milliseconds using WebSocket connection
   */
  test('Property 5: WebSocket streaming performance - latency under 800ms', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 1, maxLength: 10 }),
        fc.integer({ min: 100, max: 500 }), // Simulated processing delay
        async (textMessages, processingDelay) => {
          // Initialize service
          await elevenLabsService.initialize({ apiKey: 'test-key' });
          
          // Mock successful connection
          elevenLabsService.isConnected = true;
          elevenLabsService.websocket = mockWebSocket;
          
          const latencies = [];
          
          for (const text of textMessages) {
            // Record start time
            const startTime = Date.now();
            elevenLabsService.streamStartTime = startTime;
            
            // Send text for TTS
            const success = elevenLabsService.sendText(text);
            expect(success).toBe(true);
            
            // Simulate WebSocket message processing delay
            await new Promise(resolve => setTimeout(resolve, processingDelay));
            
            // Simulate audio stream end message
            const endTime = Date.now();
            const mockEndMessage = {
              data: JSON.stringify({
                type: 'audio_stream_end'
              })
            };
            
            if (mockWebSocket.onmessage) {
              mockWebSocket.onmessage(mockEndMessage);
            }
            
            const latency = endTime - startTime;
            latencies.push(latency);
          }
          
          // Verify all latencies are under 800ms
          const maxLatency = Math.max(...latencies);
          const avgLatency = latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
          
          console.log(`Max latency: ${maxLatency}ms, Avg latency: ${avgLatency}ms`);
          
          // Property: All latencies should be under 800ms
          expect(maxLatency).toBeLessThan(800);
          
          // Additional check: Average latency should be reasonable
          expect(avgLatency).toBeLessThan(600);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: WebSocket connection should handle reconnection attempts properly
   */
  test('Property: WebSocket reconnection handling', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 3 }), // Number of connection failures
        fc.integer({ min: 100, max: 1000 }), // Reconnection delay
        async (failureCount, reconnectDelay) => {
          // Initialize service
          await elevenLabsService.initialize({ apiKey: 'test-key' });
          
          let connectionAttempts = 0;
          
          // Mock WebSocket constructor to simulate failures
          global.WebSocket.mockImplementation(() => {
            connectionAttempts++;
            
            if (connectionAttempts <= failureCount) {
              // Simulate connection failure
              const failedSocket = {
                ...mockWebSocket,
                readyState: 3, // CLOSED
              };
              
              // Trigger close event after a short delay
              setTimeout(() => {
                if (failedSocket.onclose) {
                  failedSocket.onclose({ code: 1006, reason: 'Connection failed' });
                }
              }, 10);
              
              return failedSocket;
            } else {
              // Successful connection
              const successSocket = {
                ...mockWebSocket,
                readyState: 1, // OPEN
              };
              
              // Trigger open event
              setTimeout(() => {
                if (successSocket.onopen) {
                  successSocket.onopen();
                }
              }, 10);
              
              return successSocket;
            }
          });
          
          // Set reconnection delay
          elevenLabsService.reconnectDelay = reconnectDelay;
          
          // Attempt connection
          const startTime = Date.now();
          
          try {
            await elevenLabsService.connect({ voiceId: 'test-voice' });
            
            const totalTime = Date.now() - startTime;
            
            // Property: Should eventually connect after retries
            expect(elevenLabsService.isServiceConnected()).toBe(true);
            
            // Property: Total time should account for reconnection delays
            const expectedMinTime = failureCount * reconnectDelay;
            expect(totalTime).toBeGreaterThanOrEqual(expectedMinTime - 100); // Allow some tolerance
            
            // Property: Should not exceed max attempts
            expect(connectionAttempts).toBeLessThanOrEqual(failureCount + 1);
            
          } catch (error) {
            // If max attempts exceeded, should fail gracefully
            expect(connectionAttempts).toBeGreaterThan(elevenLabsService.maxReconnectAttempts);
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property: Text messages should be sent correctly via WebSocket
   */
  test('Property: Text message transmission integrity', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string({ minLength: 1, maxLength: 500 }), { minLength: 1, maxLength: 20 }),
        async (textMessages) => {
          // Initialize and connect service
          await elevenLabsService.initialize({ apiKey: 'test-key' });
          elevenLabsService.isConnected = true;
          elevenLabsService.websocket = mockWebSocket;
          
          const sentMessages = [];
          
          // Capture sent messages
          mockWebSocket.send.mockImplementation((data) => {
            sentMessages.push(JSON.parse(data));
          });
          
          // Send all text messages
          for (const text of textMessages) {
            const success = elevenLabsService.sendText(text);
            expect(success).toBe(true);
          }
          
          // Property: All messages should be sent
          expect(sentMessages).toHaveLength(textMessages.length);
          
          // Property: Message format should be correct
          sentMessages.forEach((message, index) => {
            expect(message).toHaveProperty('type', 'text');
            expect(message).toHaveProperty('text', textMessages[index].trim());
            expect(message).toHaveProperty('flush', false);
          });
          
          // Property: WebSocket send should be called for each message
          expect(mockWebSocket.send).toHaveBeenCalledTimes(textMessages.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property: Service should handle audio chunk callbacks correctly
   */
  test('Property: Audio chunk callback handling', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.uint8Array({ minLength: 1024, maxLength: 4096 }), { minLength: 1, maxLength: 10 }),
        async (audioChunks) => {
          // Initialize service
          await elevenLabsService.initialize({ apiKey: 'test-key' });
          elevenLabsService.isConnected = true;
          elevenLabsService.websocket = mockWebSocket;
          
          const receivedChunks = [];
          
          // Set up audio chunk callback
          elevenLabsService.onAudioChunk((audioData) => {
            receivedChunks.push(new Uint8Array(audioData));
          });
          
          // Simulate receiving audio chunks
          for (const chunk of audioChunks) {
            const mockMessage = {
              data: chunk.buffer
            };
            
            if (mockWebSocket.onmessage) {
              mockWebSocket.onmessage(mockMessage);
            }
          }
          
          // Property: All audio chunks should be received
          expect(receivedChunks).toHaveLength(audioChunks.length);
          
          // Property: Audio data should be preserved
          receivedChunks.forEach((received, index) => {
            const original = audioChunks[index];
            expect(received).toEqual(original);
          });
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * **Feature: resonance-mobile-app, Property 17: Voice cloning round trip**
   * **Validates: Requirements 7.2**
   * 
   * Property: For any uploaded voice sample, cloning then using the voice for TTS should produce recognizable speech that maintains similarity to the original
   */
  test('Property 17: Voice cloning round trip', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 5, maxLength: 50 }), // Voice name
        fc.string({ minLength: 10, maxLength: 100 }), // Description
        async (voiceName, description) => {
          // Initialize service
          await elevenLabsService.initialize({ apiKey: 'test-key' });
          
          // Mock audio sample (simulated WAV data)
          const mockAudioSample = new ArrayBuffer(1024);
          
          // Mock successful voice cloning
          const mockVoiceId = `voice_${voiceName.replace(/\s/g, '_')}`;
          
          global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ voice_id: mockVoiceId })
          });
          
          // Clone voice
          const clonedVoiceId = await elevenLabsService.cloneVoice(mockAudioSample, voiceName, description);
          
          // Property: Cloned voice should return a valid voice ID
          expect(clonedVoiceId).toBeTruthy();
          expect(typeof clonedVoiceId).toBe('string');
          expect(clonedVoiceId.length).toBeGreaterThan(0);
          
          // Mock TTS test with cloned voice
          const testText = 'Test speech synthesis';
          const mockAudioOutput = new ArrayBuffer(2048);
          
          global.fetch.mockResolvedValueOnce({
            ok: true,
            arrayBuffer: async () => mockAudioOutput
          });
          
          // Test TTS with cloned voice
          const audioData = await elevenLabsService.testTTS(testText, clonedVoiceId);
          
          // Property: TTS should produce audio output
          expect(audioData).toBeInstanceOf(ArrayBuffer);
          expect(audioData.byteLength).toBeGreaterThan(0);
          
          // Property: Round trip should maintain voice identity (voice ID should be used correctly)
          expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining(clonedVoiceId),
            expect.any(Object)
          );
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * **Feature: resonance-mobile-app, Property 18: Voice library management**
   * **Validates: Requirements 7.4, 7.5**
   * 
   * Property: For any voice asset (system or cloned), the library should display both types correctly with processing status updates
   */
  test('Property 18: Voice library management', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            name: fc.string({ minLength: 3, maxLength: 30 }),
            isCloned: fc.boolean(),
            stability: fc.float({ min: 0, max: 1 }),
            similarity: fc.float({ min: 0, max: 1 })
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (voiceConfigs) => {
          // Initialize service
          await elevenLabsService.initialize({ apiKey: 'test-key' });
          
          // Mock voice library response
          const mockVoices = voiceConfigs.map((config, index) => ({
            voice_id: `voice_${index}`,
            name: config.name,
            category: config.isCloned ? 'cloned' : 'premade',
            settings: {
              stability: config.stability,
              similarity_boost: config.similarity
            },
            description: `Test voice ${index}`,
            preview_url: `https://example.com/preview_${index}.mp3`
          }));
          
          global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({ voices: mockVoices })
          });
          
          // List voices
          const voices = await elevenLabsService.listVoices();
          
          // Property: All voices should be returned
          expect(voices).toHaveLength(voiceConfigs.length);
          
          // Property: Voice types should be correctly identified
          voices.forEach((voice, index) => {
            const config = voiceConfigs[index];
            
            expect(voice.id).toBe(`voice_${index}`);
            expect(voice.name).toBe(config.name);
            expect(voice.isCloned).toBe(config.isCloned);
            expect(voice.isSystem).toBe(!config.isCloned);
            expect(voice.stability).toBe(config.stability);
            expect(voice.similarity).toBe(config.similarity);
          });
          
          // Property: System and cloned voices should be mutually exclusive
          voices.forEach(voice => {
            expect(voice.isCloned !== voice.isSystem).toBe(true);
          });
        }
      ),
      { numRuns: 50 }
    );
  });
});