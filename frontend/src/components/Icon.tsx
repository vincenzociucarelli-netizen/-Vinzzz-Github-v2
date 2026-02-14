// Reliable Icon component using emoji fallback for web compatibility
// This replaces @expo/vector-icons/Ionicons which doesn't work well on Expo Web
// Usage: import { Icon } from '../../src/components/Icon';
//        <Icon name="arrow-back" size={24} color="#fff" />
import React from 'react';
import { Text } from 'react-native';

// Map Ionicons names to emoji equivalents
const iconMap: { [key: string]: string } = {
  // Navigation
  'arrow-back': '←',
  'arrow-back-outline': '←',
  'arrow-forward': '→',
  'arrow-forward-outline': '→',
  'chevron-back': '‹',
  'chevron-back-outline': '‹',
  'chevron-forward': '›',
  'chevron-forward-outline': '›',
  'chevron-down': '▼',
  'chevron-down-outline': '▼',
  'chevron-up': '▲',
  'chevron-up-outline': '▲',
  'close': '✕',
  'close-outline': '✕',
  'close-circle': '⊗',
  'close-circle-outline': '⊗',
  'menu': '☰',
  'menu-outline': '☰',
  
  // Actions
  'add': '+',
  'add-outline': '+',
  'add-circle': '⊕',
  'add-circle-outline': '⊕',
  'remove': '−',
  'remove-outline': '−',
  'checkmark': '✓',
  'checkmark-outline': '✓',
  'checkmark-circle': '✅',
  'checkmark-circle-outline': '☑',
  'create': '✏️',
  'create-outline': '✏️',
  'pencil': '✏️',
  'pencil-outline': '✏️',
  'trash': '🗑️',
  'trash-outline': '🗑️',
  'copy': '📋',
  'copy-outline': '📋',
  'share': '↗️',
  'share-outline': '↗️',
  'share-social': '📤',
  'share-social-outline': '📤',
  'download': '⬇️',
  'download-outline': '⬇️',
  'upload': '⬆️',
  'upload-outline': '⬆️',
  'refresh': '🔄',
  'refresh-outline': '🔄',
  'sync': '🔄',
  'sync-outline': '🔄',
  'save': '💾',
  'save-outline': '💾',
  'print': '🖨️',
  'print-outline': '🖨️',
  
  // User & People
  'person': '👤',
  'person-outline': '👤',
  'person-circle': '👤',
  'person-circle-outline': '👤',
  'person-add': '👥',
  'person-add-outline': '👥',
  'people': '👥',
  'people-outline': '👥',
  'log-in': '🚪',
  'log-in-outline': '🚪',
  'log-out': '🚪',
  'log-out-outline': '🚪',
  
  // Communication
  'mail': '✉️',
  'mail-outline': '✉️',
  'call': '📞',
  'call-outline': '📞',
  'chatbubble': '💬',
  'chatbubble-outline': '💬',
  'chatbubbles': '💬',
  'chatbubbles-outline': '💬',
  'notifications': '🔔',
  'notifications-outline': '🔔',
  'alert': '⚠️',
  'alert-outline': '⚠️',
  'alert-circle': '⚠️',
  'alert-circle-outline': '⚠️',
  'warning': '⚠️',
  'warning-outline': '⚠️',
  'information': 'ℹ️',
  'information-outline': 'ℹ️',
  'information-circle': 'ℹ️',
  'information-circle-outline': 'ℹ️',
  'help': '❓',
  'help-outline': '❓',
  'help-circle': '❓',
  'help-circle-outline': '❓',
  
  // Media
  'image': '🖼️',
  'image-outline': '🖼️',
  'images': '🖼️',
  'images-outline': '🖼️',
  'camera': '📷',
  'camera-outline': '📷',
  'videocam': '🎥',
  'videocam-outline': '🎥',
  'play': '▶️',
  'play-outline': '▶️',
  'play-circle': '▶️',
  'play-circle-outline': '▶️',
  'pause': '⏸️',
  'pause-outline': '⏸️',
  'stop': '⏹️',
  'stop-outline': '⏹️',
  'volume-high': '🔊',
  'volume-high-outline': '🔊',
  'volume-mute': '🔇',
  'volume-mute-outline': '🔇',
  
  // Files & Documents
  'document': '📄',
  'document-outline': '📄',
  'document-text': '📄',
  'document-text-outline': '📄',
  'documents': '📄',
  'documents-outline': '📄',
  'folder': '📁',
  'folder-outline': '📁',
  'file-tray': '📥',
  'file-tray-outline': '📥',
  'attach': '📎',
  'attach-outline': '📎',
  
  // Calendar & Time
  'calendar': '📅',
  'calendar-outline': '📅',
  'time': '🕐',
  'time-outline': '🕐',
  'alarm': '⏰',
  'alarm-outline': '⏰',
  'stopwatch': '⏱️',
  'stopwatch-outline': '⏱️',
  'hourglass': '⏳',
  'hourglass-outline': '⏳',
  
  // Location
  'location': '📍',
  'location-outline': '📍',
  'navigate': '🧭',
  'navigate-outline': '🧭',
  'map': '🗺️',
  'map-outline': '🗺️',
  'compass': '🧭',
  'compass-outline': '🧭',
  'home': '🏠',
  'home-outline': '🏠',
  
  // Commerce
  'cart': '🛒',
  'cart-outline': '🛒',
  'card': '💳',
  'card-outline': '💳',
  'cash': '💵',
  'cash-outline': '💵',
  'wallet': '👛',
  'wallet-outline': '👛',
  'pricetag': '🏷️',
  'pricetag-outline': '🏷️',
  'gift': '🎁',
  'gift-outline': '🎁',
  
  // Settings & Tools
  'settings': '⚙️',
  'settings-outline': '⚙️',
  'cog': '⚙️',
  'cog-outline': '⚙️',
  'options': '⋯',
  'options-outline': '⋯',
  'ellipsis-horizontal': '⋯',
  'ellipsis-horizontal-outline': '⋯',
  'ellipsis-vertical': '⋮',
  'ellipsis-vertical-outline': '⋮',
  'build': '🔧',
  'build-outline': '🔧',
  'construct': '🔨',
  'construct-outline': '🔨',
  'key': '🔑',
  'key-outline': '🔑',
  'lock-closed': '🔒',
  'lock-closed-outline': '🔒',
  'lock-open': '🔓',
  'lock-open-outline': '🔓',
  'shield': '🛡️',
  'shield-outline': '🛡️',
  'shield-checkmark': '🛡️',
  'shield-checkmark-outline': '🛡️',
  
  // Search & Filter
  'search': '🔍',
  'search-outline': '🔍',
  'filter': '⚙️',
  'filter-outline': '⚙️',
  
  // Favorites & Rating
  'star': '⭐',
  'star-outline': '☆',
  'heart': '❤️',
  'heart-outline': '♡',
  'thumbs-up': '👍',
  'thumbs-up-outline': '👍',
  'thumbs-down': '👎',
  'thumbs-down-outline': '👎',
  'bookmark': '🔖',
  'bookmark-outline': '🔖',
  'flag': '🚩',
  'flag-outline': '🚩',
  
  // Sports
  'trophy': '🏆',
  'trophy-outline': '🏆',
  'medal': '🏅',
  'medal-outline': '🏅',
  'fitness': '💪',
  'fitness-outline': '💪',
  'basketball': '🏀',
  'basketball-outline': '🏀',
  'football': '🏈',
  'football-outline': '🏈',
  'american-football': '🏈',
  'american-football-outline': '🏈',
  
  // Eye & View
  'eye': '👁️',
  'eye-outline': '👁️',
  'eye-off': '🙈',
  'eye-off-outline': '🙈',
  
  // Status indicators
  'checkmark-done': '✓✓',
  'checkmark-done-outline': '✓✓',
  'radio-button-on': '⬤',
  'radio-button-on-outline': '⬤',
  'radio-button-off': '○',
  'radio-button-off-outline': '○',
  'checkbox': '☑️',
  'checkbox-outline': '☐',
  'square': '◻️',
  'square-outline': '□',
  'circle': '⬤',
  'circle-outline': '○',
  
  // Business
  'business': '🏢',
  'business-outline': '🏢',
  'briefcase': '💼',
  'briefcase-outline': '💼',
  'clipboard': '📋',
  'clipboard-outline': '📋',
  'stats-chart': '📊',
  'stats-chart-outline': '📊',
  'bar-chart': '📊',
  'bar-chart-outline': '📊',
  'pie-chart': '📊',
  'pie-chart-outline': '📊',
  'trending-up': '📈',
  'trending-up-outline': '📈',
  'trending-down': '📉',
  'trending-down-outline': '📉',
  
  // QR & Code
  'qr-code': '▣',
  'qr-code-outline': '▣',
  'barcode': '▤',
  'barcode-outline': '▤',
  'scan': '📱',
  'scan-outline': '📱',
  
  // Weather & Nature
  'sunny': '☀️',
  'sunny-outline': '☀️',
  'moon': '🌙',
  'moon-outline': '🌙',
  'cloud': '☁️',
  'cloud-outline': '☁️',
  'rainy': '🌧️',
  'rainy-outline': '🌧️',
  'thunderstorm': '⛈️',
  'thunderstorm-outline': '⛈️',
  'snow': '❄️',
  'snow-outline': '❄️',
  
  // Expand/Contract
  'expand': '⤢',
  'expand-outline': '⤢',
  'contract': '⤡',
  'contract-outline': '⤡',
  
  // Miscellaneous
  'grid': '⊞',
  'grid-outline': '⊞',
  'list': '☰',
  'list-outline': '☰',
  'apps': '⊞',
  'apps-outline': '⊞',
  'layers': '☷',
  'layers-outline': '☷',
  'sparkles': '✨',
  'flash': '⚡',
  'flash-outline': '⚡',
  'bulb': '💡',
  'bulb-outline': '💡',
  'color-palette': '🎨',
  'color-palette-outline': '🎨',
  'brush': '🖌️',
  'brush-outline': '🖌️',
  'text': 'Aa',
  'text-outline': 'Aa',
  'globe': '🌍',
  'globe-outline': '🌍',
  'earth': '🌍',
  'earth-outline': '🌍',
  'link': '🔗',
  'link-outline': '🔗',
  'unlink': '⛓️',
  'wifi': '📶',
  'wifi-outline': '📶',
  'bluetooth': '📱',
  'battery-full': '🔋',
  'battery-charging': '🔋',
  'power': '⏻',
  'exit': '🚪',
  'exit-outline': '🚪',
  
  // Default fallback
  'default': '•',
};

interface IconProps {
  name: string;
  size?: number;
  color?: string;
  style?: any;
}

// Main Icon component - use this
export const Icon: React.FC<IconProps> = ({ name, size = 24, color = '#000', style }) => {
  const emoji = iconMap[name] || iconMap['default'];
  
  return (
    <Text style={[{ fontSize: size * 0.85, color, textAlign: 'center', lineHeight: size }, style]}>
      {emoji}
    </Text>
  );
};

// Ionicons-compatible wrapper for easy migration
// This allows: <Ionicons name="arrow-back" size={24} color="#fff" />
export const Ionicons: React.FC<IconProps> = Icon;

export default Icon;
