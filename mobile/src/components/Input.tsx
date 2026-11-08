import React, { useState } from 'react';
import {
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { Icon, IconName } from './Icon';

export interface InputProps extends TextInputProps {
  label?: string;
  helperText?: string;
  error?: string;
  leftIcon?: IconName;
  rightIcon?: IconName;
  onRightIconPress?: () => void;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
}

export function Input({
  label,
  helperText,
  error,
  leftIcon,
  rightIcon,
  onRightIconPress,
  containerStyle,
  inputStyle,
  editable = true,
  onFocus,
  onBlur,
  ...props
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);

  const hasError = Boolean(error);

  let borderStyle = 'border-[#D1D5DB]';
  if (hasError) {
    borderStyle = 'border-[#DC2626]';
  } else if (isFocused) {
    borderStyle = 'border-[#0F766E]';
  }

  return (
    <View className="gap-1.5 w-full" style={containerStyle}>
      {label ? (
        <Text className="text-[13px] font-medium text-[#111827]">{label}</Text>
      ) : null}

      <View
        className={`min-h-[48px] flex-row items-center rounded-[12px] border px-3.5 ${borderStyle} ${
          !editable ? 'bg-[#F3F4F6]' : 'bg-[#F8FAFC]'
        }`}
      >
        {leftIcon ? (
          <View className="mr-2.5">
            <Icon
              name={leftIcon}
              size={18}
              color={hasError ? '#DC2626' : isFocused ? '#0F766E' : '#6B7280'}
            />
          </View>
        ) : null}

        <TextInput
          editable={editable}
          placeholderTextColor="#9CA3AF"
          className="flex-1 text-[14px] leading-5 text-[#111827]"
          style={inputStyle}
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          {...props}
        />

        {rightIcon ? (
          <View className="ml-2.5">
            <Icon
              name={rightIcon}
              size={18}
              color={hasError ? '#DC2626' : isFocused ? '#0F766E' : '#6B7280'}
            />
          </View>
        ) : null}
      </View>

      {hasError ? (
        <Text className="text-[12px] text-[#991B1B]">{error}</Text>
      ) : helperText ? (
        <Text className="text-[12px] text-[#6B7280]">{helperText}</Text>
      ) : null}
    </View>
  );
}

