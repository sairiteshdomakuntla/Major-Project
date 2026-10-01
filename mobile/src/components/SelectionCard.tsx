import { Pressable, Text, View } from 'react-native';

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
        'min-h-[60px] w-full flex-row items-center gap-3 rounded-2xl border-2 p-4 active:opacity-80',
        selected ? 'border-sky-400 bg-slate-800' : 'border-slate-700 bg-slate-800/60',
        disabled ? 'opacity-50' : '',
      ].join(' ')}
    >
      {/* Selection indicator: check mark + shape, not color alone */}
      <View
        importantForAccessibility="no"
        className={[
          'h-7 w-7 items-center justify-center rounded-full border-2',
          selected ? 'border-sky-400 bg-sky-400' : 'border-slate-500',
        ].join(' ')}
      >
        {selected ? (
          <Text className="text-base font-bold text-slate-900">✓</Text>
        ) : null}
      </View>

      <View className="flex-1 gap-0.5">
        <Text
          className={`text-base ${selected ? 'font-bold text-slate-50' : 'font-medium text-slate-100'}`}
        >
          {title}
        </Text>
        {description ? (
          <Text className="text-sm text-slate-400">{description}</Text>
        ) : null}
      </View>

      {badge ? (
        <View className="rounded-full bg-slate-700 px-3 py-1">
          <Text className="text-xs font-medium text-slate-200">{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
