import React, { useState } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  View,
  Platform,
  ViewStyle,
  TextStyle,
  Animated,
} from 'react-native';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'success' | 'outline' | 'ghost';
type ButtonSize = 'small' | 'medium' | 'large';

interface ButtonProps {
  onPress: () => void;
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export default function Button({
  onPress,
  children,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  style,
  textStyle,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const [scaleValue] = useState(new Animated.Value(1));
  const [isHovered, setIsHovered] = useState(false);

  const handlePressIn = () => {
    if (!isDisabled) {
      Animated.spring(scaleValue, {
        toValue: 0.96,
        useNativeDriver: true,
      }).start();
    }
  };

  const handlePressOut = () => {
    if (!isDisabled) {
      Animated.spring(scaleValue, {
        toValue: 1,
        friction: 5,
        tension: 40,
        useNativeDriver: true,
      }).start();
    }
  };

  const getVariantStyles = (): ViewStyle => {
    const getBackgroundColor = () => {
      if (isDisabled) {
        switch (variant) {
          case 'primary': return '#9CA3AF';
          case 'secondary': return '#E5E7EB';
          case 'danger': return '#FCA5A5';
          case 'success': return '#86EFAC';
          default: return 'transparent';
        }
      }
      if (isHovered && Platform.OS === 'web') {
        switch (variant) {
          case 'primary': return '#2563EB';
          case 'secondary': return '#E5E7EB';
          case 'danger': return '#DC2626';
          case 'success': return '#059669';
          case 'outline': return '#EFF6FF';
          case 'ghost': return '#F3F4F6';
          default: return '#3B82F6';
        }
      }
      switch (variant) {
        case 'primary': return '#3B82F6';
        case 'secondary': return '#F3F4F6';
        case 'danger': return '#EF4444';
        case 'success': return '#10B981';
        case 'outline':
        case 'ghost': return 'transparent';
        default: return '#3B82F6';
      }
    };

    const baseStyle: ViewStyle = {
      backgroundColor: getBackgroundColor(),
      ...Platform.select({
        web: {
          transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          boxShadow: !isDisabled && isHovered ? '0 4px 12px rgba(0, 0, 0, 0.1)' : 'none',
        } as any,
      }),
    };

    switch (variant) {
      case 'secondary':
        return {
          ...baseStyle,
          borderWidth: 1,
          borderColor: isDisabled ? '#D1D5DB' : isHovered ? '#D1D5DB' : '#E5E7EB',
        };
      case 'outline':
        return {
          ...baseStyle,
          borderWidth: 2,
          borderColor: isDisabled ? '#D1D5DB' : isHovered ? '#2563EB' : '#3B82F6',
        };
      default:
        return baseStyle;
    }
  };

  const getSizeStyles = (): ViewStyle => {
    switch (size) {
      case 'small':
        return {
          paddingVertical: 8,
          paddingHorizontal: 14,
          borderRadius: 8,
        };
      case 'medium':
        return {
          paddingVertical: 12,
          paddingHorizontal: 20,
          borderRadius: 10,
        };
      case 'large':
        return {
          paddingVertical: 16,
          paddingHorizontal: 28,
          borderRadius: 12,
        };
      default:
        return {};
    }
  };

  const getTextVariantStyles = (): TextStyle => {
    switch (variant) {
      case 'primary':
      case 'danger':
      case 'success':
        return { color: '#FFFFFF' };
      case 'secondary':
        return { color: '#374151' };
      case 'outline':
        return { color: isDisabled ? '#9CA3AF' : '#3B82F6' };
      case 'ghost':
        return { color: isDisabled ? '#9CA3AF' : '#3B82F6' };
      default:
        return { color: '#FFFFFF' };
    }
  };

  const getTextSizeStyles = (): TextStyle => {
    switch (size) {
      case 'small':
        return { fontSize: 14, fontWeight: '600' as const };
      case 'medium':
        return { fontSize: 16, fontWeight: '600' as const };
      case 'large':
        return { fontSize: 18, fontWeight: '700' as const };
      default:
        return { fontSize: 16, fontWeight: '600' as const };
    }
  };

  return (
    <Animated.View
      style={[
        { transform: [{ scale: scaleValue }] },
        fullWidth && styles.fullWidth,
      ]}
    >
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isDisabled}
        activeOpacity={1}
        style={[
          styles.button,
          getVariantStyles(),
          getSizeStyles(),
          isDisabled && styles.disabled,
          style,
        ]}
        {...Platform.select({
          web: {
            onMouseEnter: () => setIsHovered(true),
            onMouseLeave: () => setIsHovered(false),
          } as any,
          default: {},
        })}
      >
        <View style={styles.content}>
          {loading ? (
            <ActivityIndicator
              size="small"
              color={variant === 'secondary' || variant === 'outline' || variant === 'ghost' ? '#3B82F6' : '#FFFFFF'}
            />
          ) : (
            <>
              {icon && iconPosition === 'left' && <View style={styles.iconLeft}>{icon}</View>}
              {typeof children === 'string' ? (
                <Text style={[styles.text, getTextVariantStyles(), getTextSizeStyles(), textStyle]}>
                  {children}
                </Text>
              ) : (
                children
              )}
              {icon && iconPosition === 'right' && <View style={styles.iconRight}>{icon}</View>}
            </>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      web: {
        userSelect: 'none',
      } as any,
    }),
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  text: {
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.6,
  },
  fullWidth: {
    width: '100%',
  },
  iconLeft: {
    marginRight: 4,
  },
  iconRight: {
    marginLeft: 4,
  },
});
