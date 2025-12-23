import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Play, AlertTriangle } from 'lucide-react-native';
import Badge from '../ui/Badge';
import { COLORS, BORDER_RADIUS, SPACING } from '../../constants/theme';

/**
 * Transcript Bubble component for chat messages
 * @param {string} message - Message text
 * @param {boolean} isUser - Whether message is from user
 * @param {Array} fillerWords - Array of filler word positions
 * @param {boolean} hasHesitation - Whether hesitation was detected
 * @param {string} hesitationTip - Tip for hesitation
 * @param {function} onPlaySegment - Callback to play audio segment
 */
export default function TranscriptBubble({
  message,
  isUser = false,
  fillerWords = [],
  hasHesitation = false,
  hesitationTip,
  onPlaySegment,
  style,
}) {
  // Highlight filler words in message
  const renderMessageWithHighlights = () => {
    // Ensure message is a string
    const messageText = typeof message === 'string' ? message : String(message || '');
    
    // Ensure fillerWords is an array of strings
    const validFillerWords = (fillerWords || [])
      .filter(fw => fw !== null && fw !== undefined)
      .map(fw => typeof fw === 'string' ? fw : (fw?.word || fw?.text || String(fw)))
      .filter(fw => fw && typeof fw === 'string' && fw.length > 0);
    
    if (!validFillerWords.length || !messageText) {
      return <Text style={styles.messageText}>{messageText}</Text>;
    }

    // Simple implementation - highlight specific words
    const words = messageText.split(' ');
    return (
      <Text style={styles.messageText}>
        {words.map((word, index) => {
          const isFillerWord = validFillerWords.some((fw) => {
            try {
              return word.toLowerCase().includes(fw.toLowerCase());
            } catch (e) {
              return false;
            }
          });
          return (
            <Text
              key={index}
              style={[
                styles.messageText,
                isFillerWord && styles.fillerWordHighlight,
              ]}
            >
              {word}
              {index < words.length - 1 ? ' ' : ''}
            </Text>
          );
        })}
      </Text>
    );
  };

  const styles = {
    messageText: {
      fontSize: 14,
      color: isUser ? COLORS.LIGHT_TEXT : COLORS.LIGHT_TEXT,
      lineHeight: 20,
    },
    fillerWordHighlight: {
      backgroundColor: COLORS.CYBER_YELLOW,
      color: '#000000',
      fontWeight: '600',
      borderRadius: 2,
      overflow: 'hidden',
    },
  };

  return (
    <View style={[{ marginBottom: SPACING.MD }, style]}>
      {/* Message Bubble */}
      <View
        style={{
          alignSelf: isUser ? 'flex-end' : 'flex-start',
          maxWidth: '85%',
        }}
      >
        {isUser && (
          <Badge
            variant="yellow"
            size="sm"
            style={{ alignSelf: 'flex-end', marginBottom: 4 }}
          >
            You
          </Badge>
        )}
        <View
          style={{
            backgroundColor: isUser ? '#FFF9E6' : '#F5F5F5',
            borderRadius: BORDER_RADIUS.LG,
            borderTopRightRadius: isUser ? 4 : BORDER_RADIUS.LG,
            borderTopLeftRadius: isUser ? BORDER_RADIUS.LG : 4,
            padding: SPACING.MD,
          }}
        >
          {renderMessageWithHighlights()}
        </View>
      </View>

      {/* Hesitation Warning */}
      {hasHesitation && (
        <View
          style={{
            backgroundColor: '#FFF3E0',
            borderRadius: BORDER_RADIUS.MD,
            padding: SPACING.SM,
            marginTop: SPACING.SM,
            marginLeft: isUser ? 'auto' : 0,
            marginRight: isUser ? 0 : 'auto',
            maxWidth: '85%',
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: SPACING.XS,
            }}
          >
            <AlertTriangle size={14} color="#FF9800" />
            <Text
              style={{
                fontSize: 12,
                fontWeight: '700',
                color: '#FF9800',
                marginLeft: 6,
                textTransform: 'uppercase',
              }}
            >
              HESITATION DETECTED
            </Text>
          </View>
          {hesitationTip && (
            <Text
              style={{
                fontSize: 12,
                color: COLORS.LIGHT_TEXT_SECONDARY,
                lineHeight: 18,
              }}
            >
              {hesitationTip}
            </Text>
          )}
          {onPlaySegment && (
            <TouchableOpacity
              onPress={onPlaySegment}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginTop: SPACING.SM,
              }}
            >
              <Play size={14} color={COLORS.LIGHT_TEXT} fill={COLORS.LIGHT_TEXT} />
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: COLORS.LIGHT_TEXT,
                  marginLeft: 6,
                }}
              >
                Play Segment
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}
