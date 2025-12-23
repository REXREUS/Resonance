import React from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import { Play, Pause, Plus, Mic, Star, Trash2 } from 'lucide-react-native';
import Avatar from '../ui/Avatar';
import Badge from '../ui/Badge';
import Card from '../ui/Card';
import { COLORS, BORDER_RADIUS, SPACING } from '../../constants/theme';

/**
 * Voice Card component for Voice Lab
 * @param {string} name - Voice name
 * @param {string} avatar - Avatar image source
 * @param {Array} tags - Array of tag strings
 * @param {boolean} isPlaying - Whether voice is currently playing
 * @param {boolean} isProcessing - Whether voice is being processed
 * @param {boolean} isSelected - Whether voice is selected
 * @param {boolean} isDefault - Whether voice is the default
 * @param {number} progress - Processing progress (0-100)
 */
export default function VoiceCard({
  name,
  avatar,
  tags = [],
  isPlaying = false,
  isProcessing = false,
  isSelected = false,
  isDefault = false,
  progress = 0,
  onPlay,
  onPause,
  onSelect,
  onSetDefault,
  onMore,
  style,
}) {
  const isCloned = tags.includes('CLONED');
  
  return (
    <TouchableOpacity 
      onPress={onSelect} 
      activeOpacity={0.7}
      style={style}
    >
      <Card 
        variant="light" 
        padding="md" 
        style={{
          borderWidth: isSelected ? 2 : 1,
          borderColor: isSelected ? COLORS.CYBER_YELLOW : COLORS.LIGHT_BORDER,
        }}
      >
        {/* Header with Avatar and Menu */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: SPACING.SM,
          }}
        >
          <View style={{ position: 'relative' }}>
            <Avatar
              source={avatar}
              name={name}
              size="md"
              showStatus={!isProcessing}
              status="online"
            />
            {isDefault && (
              <View style={{
                position: 'absolute',
                bottom: -2,
                right: -2,
                backgroundColor: COLORS.CYBER_YELLOW,
                borderRadius: 10,
                width: 20,
                height: 20,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Star size={12} color={COLORS.DARK_BG} fill={COLORS.DARK_BG} />
              </View>
            )}
          </View>
          
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {onSetDefault && (
              <TouchableOpacity onPress={onSetDefault}>
                <Star 
                  size={20} 
                  color={isDefault ? COLORS.CYBER_YELLOW : COLORS.LIGHT_TEXT_SECONDARY}
                  fill={isDefault ? COLORS.CYBER_YELLOW : 'transparent'}
                />
              </TouchableOpacity>
            )}
            {isCloned && onMore && (
              <TouchableOpacity onPress={onMore}>
                <Trash2 size={20} color="#FF6B6B" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Name */}
        <Text
          style={{
            fontSize: 16,
            fontWeight: '600',
            color: COLORS.LIGHT_TEXT,
            marginBottom: SPACING.XS,
          }}
          numberOfLines={1}
        >
          {name}
        </Text>

        {/* Processing State */}
        {isProcessing ? (
          <View>
            <Text
              style={{
                fontSize: 12,
                color: COLORS.CYBER_YELLOW,
                marginBottom: SPACING.SM,
              }}
            >
              Processing...
            </Text>
            <View
              style={{
                height: 4,
                backgroundColor: '#E8E8E8',
                borderRadius: 2,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  height: '100%',
                  width: `${progress}%`,
                  backgroundColor: COLORS.CYBER_YELLOW,
                }}
              />
            </View>
          </View>
        ) : (
          <>
            {/* Tags */}
            {tags.length > 0 && (
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: 4,
                  marginBottom: SPACING.SM,
                }}
              >
                {tags.map((tag, index) => (
                  <Badge 
                    key={index} 
                    variant={tag === 'DEFAULT' ? 'yellow' : 'outline'} 
                    size="sm"
                  >
                    {tag}
                  </Badge>
                ))}
              </View>
            )}

            {/* Play Button and Waveform */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginTop: SPACING.XS,
              }}
            >
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  if (isPlaying) {
                    onPause && onPause();
                  } else {
                    onPlay && onPlay();
                  }
                }}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: COLORS.CYBER_YELLOW,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {isPlaying ? (
                  <Pause size={16} color="#000000" fill="#000000" />
                ) : (
                  <Play size={16} color="#000000" fill="#000000" />
                )}
              </TouchableOpacity>

              {/* Waveform dots */}
              <View
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  marginLeft: SPACING.SM,
                }}
              >
                {[0.3, 0.6, 1, 0.6, 0.3].map((height, index) => (
                  <View
                    key={index}
                    style={{
                      width: 4,
                      height: 16 * height,
                      backgroundColor: isPlaying
                        ? COLORS.CYBER_YELLOW
                        : COLORS.LIGHT_BORDER,
                      borderRadius: 2,
                    }}
                  />
                ))}
              </View>
            </View>
          </>
        )}
      </Card>
    </TouchableOpacity>
  );
}

/**
 * Add Voice Card (Clone New)
 */
export function AddVoiceCard({ onPress, style }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        {
          backgroundColor: '#F8F8F8',
          borderRadius: BORDER_RADIUS.LG,
          borderWidth: 2,
          borderColor: COLORS.LIGHT_BORDER,
          borderStyle: 'dashed',
          padding: SPACING.LG,
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 160,
        },
        style,
      ]}
    >
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          backgroundColor: COLORS.CYBER_YELLOW,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: SPACING.SM,
        }}
      >
        <Plus size={24} color="#000000" />
      </View>
      <Text
        style={{
          fontSize: 16,
          fontWeight: '600',
          color: COLORS.LIGHT_TEXT,
          marginBottom: 4,
        }}
      >
        Clone New
      </Text>
      <Text
        style={{
          fontSize: 12,
          color: COLORS.LIGHT_TEXT_SECONDARY,
        }}
      >
        Instant voice model
      </Text>
    </TouchableOpacity>
  );
}

/**
 * Voice Test Input component - Editable text input for TTS testing
 */
export function VoiceTestInput({
  value,
  onChangeText,
  onTest,
  placeholder = 'Type here to test voice...',
  disabled = false,
  style,
}) {
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#F5F5F5',
          borderRadius: BORDER_RADIUS.LG,
          paddingLeft: SPACING.MD,
          paddingRight: SPACING.XS,
          paddingVertical: SPACING.XS,
        },
        style,
      ]}
    >
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={COLORS.LIGHT_TEXT_SECONDARY}
        multiline
        numberOfLines={2}
        style={{
          flex: 1,
          fontSize: 14,
          color: COLORS.LIGHT_TEXT,
          paddingVertical: SPACING.SM,
          maxHeight: 80,
        }}
        editable={!disabled}
      />
      <TouchableOpacity
        onPress={onTest}
        disabled={disabled}
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: disabled ? COLORS.LIGHT_BORDER : COLORS.CYBER_YELLOW,
          alignItems: 'center',
          justifyContent: 'center',
          marginLeft: SPACING.SM,
        }}
      >
        <Mic size={20} color={disabled ? COLORS.LIGHT_TEXT_SECONDARY : '#000000'} />
      </TouchableOpacity>
    </View>
  );
}
