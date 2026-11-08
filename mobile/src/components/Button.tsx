import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { Icon, IconName } from './Icon';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger'
  | 'success';

export interface ButtonProps extends Omit<PressableProps, 'style'> {
  title?: string;
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  iconPosition?: 'left' | 'right';
  style?: ViewStyle;
  textStyle?: TextStyle;
  children?: React.ReactNode;
}

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  iconPosition = 'left',
  style,
  textStyle,
  children,
  ...props
}: ButtonProps) {
  const isInteractive = !disabled && !loading;

  const minHeight = size === 'sm' ? 44 : size === 'lg' ? 52 : 48;
  const paddingHorizontal = size === 'sm' ? 14 : size === 'lg' ? 20 : 16;
  const fontSize = size === 'sm' ? 13 : 14;

  let bgClass = 'bg-[#0F766E]';
  let borderClass = 'border-0';
  let textColor = '#FFFFFF';
  let spinnerColor = '#FFFFFF';

  switch (variant) {
    case 'secondary':
      bgClass = 'bg-[#F3F4F6]';
      borderClass = 'border border-[#E5E7EB]';
      textColor = '#111827';
      spinnerColor = '#0F766E';
      break;
    case 'outline':
      bgClass = 'bg-white';
      borderClass = 'border border-[#D1D5DB]';
      textColor = '#111827';
      spinnerColor = '#0F766E';
      break;
    case 'ghost':
      bgClass = 'bg-transparent';
      borderClass = 'border-0';
      textColor = '#0F766E';
      spinnerColor = '#0F766E';
      break;
    case 'danger':
      bgClass = 'bg-[#DC2626]';
      borderClass = 'border-0';
      textColor = '#FFFFFF';
      spinnerColor = '#FFFFFF';
      break;
    case 'success':
      bgClass = 'bg-[#15803D]';
      borderClass = 'border-0';
      textColor = '#FFFFFF';
      spinnerColor = '#FFFFFF';
      break;
    case 'primary':
    default:
      bgClass = 'bg-[#0F766E]';
      borderClass = 'border-0';
      textColor = '#FFFFFF';
      spinnerColor = '#FFFFFF';
      break;
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !isInteractive, busy: loading }}
      disabled={!isInteractive}
      className={`flex-row items-center justify-center rounded-[12px] ${bgClass} ${borderClass} ${
        !isInteractive ? 'opacity-50' : 'active:opacity-80'
      }`}
      style={[
        {
          minHeight,
          minWidth: 44,
          paddingHorizontal,
        },
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator size="small" color={spinnerColor} />
      ) : (
        <View className="flex-row items-center gap-2">
          {icon && iconPosition === 'left' ? (
            <Icon name={icon} size={18} color={textColor} />
          ) : null}
          {title ? (
            <Text
              className="font-semibold"
              style={[{ color: textColor, fontSize }, textStyle]}
            >
              {title}
            </Text>
          ) : (
            children
          )}
          {icon && iconPosition === 'right' ? (
            <Icon name={icon} size={18} color={textColor} />
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

