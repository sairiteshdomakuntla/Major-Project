import { Pressable, Text, View } from 'react-native';
import { Icon } from './Icon';

interface SelectionCardProps {
  title: string;
  description?: string;
  /** Trailing badge text, e.g. native script name or "Soon". */
  badge?: string;
  selected: boolean;
  disabled?: boolean;
  /** 'checkbox' for multi-select, 'radio' for single-select. */
  role?: 'checkbox' | 'radio';
  onPress: () => void;
  testID?: string;
}

/**
 * Reusable accessible selection card.
 * Selection is never communicated by color alone: a check badge with a
 * visible mark plus bold title reinforces the selected state, and
 * TalkBack announces it via accessibilityState + label suffix.
 */
export function SelectionCard({
  title,
  description,
  badge,
  selected,
  disabled = false,
  role = 'checkbox',
  onPress,
  testID,
}: SelectionCardProps) {
  const accessibilityLabel = disabled
    ? `${title}. Coming soon, not available yet.`
    : selected
      ? `${title}. Selected.`
      : `${title}. Not selected.`;

  return (
    <Pressable
      testID={testID}
      accessibilityRole={role}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={description}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      className={[
        'min-h-[60px] w-full flex-row items-center gap-3 rounded-[14px] p-4 active:opacity-80',
        selected ? 'border-2 border-[#0F766E] bg-[#F0FDFA]' : 'border border-[#E5E7EB] bg-white',
        disabled ? 'opacity-50' : '',
      ].join(' ')}
    >
      {/* Selection indicator: check mark + shape, not color alone */}
      <View
        importantForAccessibility="no"
        className={[
          'h-7 w-7 items-center justify-center rounded-full border-2',
          selected ? 'border-[#0F766E] bg-[#0F766E]' : 'border-[#D1D5DB]',
        ].join(' ')}
      >
        {selected ? (
          <Icon name="check" size={16} color="#FFFFFF" />
        ) : null}
      </View>

      <View className="flex-1 gap-0.5">
        <Text
          className={`text-base ${selected ? 'font-semibold text-[#111827]' : 'font-medium text-[#111827]'}`}
        >
          {title}
        </Text>
        {description ? (
          <Text className="text-sm text-[#6B7280]">{description}</Text>
        ) : null}
      </View>

      {badge ? (
        <View className="rounded-full border border-[#CCFBF1] bg-[#F0FDFA] px-3 py-1">
          <Text className="text-xs font-medium text-[#0F766E]">{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
