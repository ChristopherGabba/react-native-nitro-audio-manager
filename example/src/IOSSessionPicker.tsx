import { Dropdown, MultiSelect } from 'react-native-element-dropdown';
import { AudioSessionCategory } from 'react-native-nitro-audio-manager';
import React, { useState, useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';

const AudioSessionCompatibleModes: Record<string, string[]> = {
  Ambient: ['Default', 'SpokenAudio'],
  SoloAmbient: ['Default', 'SpokenAudio'],
  Playback: ['Default', 'MoviePlayback', 'SpokenAudio', 'Measurement'],
  Record: [
    'Default',
    'VideoRecording',
    'VideoChat',
    'Measurement',
    'SpokenAudio',
  ],
  PlayAndRecord: [
    'Default',
    'Measurement',
    'SpokenAudio',
    'VoiceChat',
    'VideoChat',
    'GameChat',
    'VideoRecording',
    'VoicePrompt',
  ],
  MultiRoute: ['Default', 'SpokenAudio'],
} as const;

/**
 * Mapping of AudioSessionCategory to valid combinations of AVAudioSessionCategoryOptions.
 * Each array represents a valid set of options that can be used together.
 */
const AudioSessionCompatibleCategoryOptions = {
  Ambient: ['MixWithOthers'],
  SoloAmbient: [],
  Playback: [
    'MixWithOthers',
    'DuckOthers',
    'InterruptSpokenAudioAndMixWithOthers',
  ],
  Record: ['AllowBluetoothHFP'],
  PlayAndRecord: [
    'MixWithOthers',
    'DuckOthers',
    'InterruptSpokenAudioAndMixWithOthers',
    'AllowBluetoothHFP',
    'AllowBluetoothA2DP',
    'AllowAirPlay',
    'DefaultToSpeaker',
    'OverrideMutedMicrophoneInterruption',
  ],
  MultiRoute: [
    'MixWithOthers',
    'DuckOthers',
    'InterruptSpokenAudioAndMixWithOthers',
  ],
} as const;

export type IOSSessionPickerValue = {
  category: string;
  mode: string | null;
  option: string[];
};

type IOSSessionPickerProps = {
  onChange?: (value: IOSSessionPickerValue) => void;
};

export const IOSSessionPicker = ({ onChange }: IOSSessionPickerProps) => {
  const categoryOptions = Object.entries(AudioSessionCategory).map(
    ([, value]) => ({
      label: value,
      value: value,
    })
  );

  const modeOptionsMap = AudioSessionCompatibleModes as Record<
    string,
    string[]
  >;

  const categoryOptionsMap = Object.fromEntries(
    Object.entries(AudioSessionCompatibleCategoryOptions).map(
      ([key, value]) => [key, [...value] as string[]]
    )
  ) as Record<string, string[]>;

  const [selectedCategory, setSelectedCategory] = useState<string>(
    categoryOptions[0].value
  );
  const [selectedMode, setSelectedMode] = useState<string | null>(null);

  const [selectedCategoryOption, setSelectedCategoryOption] = useState<
    string[]
  >([]);

  const compatibleModes = useMemo(() => {
    return (modeOptionsMap[selectedCategory] || []).map((mode) => ({
      label: mode,
      value: mode,
    }));
  }, [selectedCategory, modeOptionsMap]);

  const compatibleCategoryOptions = useMemo(() => {
    return (categoryOptionsMap[selectedCategory] || []).map((opt) => ({
      label: opt,
      value: opt,
    }));
  }, [selectedCategory, categoryOptionsMap]);

  const handleChange = (
    newCategory: string,
    newMode: string | null,
    newOption: string[]
  ) => {
    if (onChange) {
      onChange({
        category: newCategory,
        mode: newMode,
        option: newOption,
      });
    }
  };

  return (
    <View>
      <Text style={styles.heading}>Session Config</Text>
      <Text style={styles.testNote}>
        Pick a category, then a compatible mode and option:
      </Text>
      <Dropdown
        style={styles.margin}
        data={categoryOptions}
        labelField="label"
        valueField="value"
        value={selectedCategory}
        onChange={(item) => {
          setSelectedCategory(item.value);
          setSelectedMode(null);
          setSelectedCategoryOption([]);
          handleChange(item.value, null, []);
        }}
        placeholder="Select Category"
      />
      <Dropdown
        style={styles.margin}
        data={compatibleModes}
        labelField="label"
        valueField="value"
        value={selectedMode}
        onChange={(item) => {
          setSelectedMode(item.value);
          handleChange(selectedCategory, item.value, selectedCategoryOption);
        }}
        placeholder="Select Mode"
        disable={compatibleModes.length === 0}
      />
      <MultiSelect
        style={styles.margin}
        data={compatibleCategoryOptions}
        labelField="label"
        valueField="value"
        value={selectedCategoryOption}
        onChange={(items) => {
          setSelectedCategoryOption(items);
          handleChange(selectedCategory, selectedMode, items);
        }}
        placeholder="Select Category Option"
        disable={compatibleCategoryOptions.length === 0}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  margin: { margin: 12 },
  heading: { fontSize: 18, fontWeight: '600', marginTop: 24 },
  testNote: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 5,
  },
  value: { marginLeft: 12, flex: 1, marginTop: 10 },
  monospaced: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    backgroundColor: '#eee',
    padding: 8,
    marginTop: 4,
  },
});
