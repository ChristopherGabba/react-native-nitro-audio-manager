import { Platform } from 'react-native';
import {
  AudioSessionCategory,
  AudioSessionCategoryOptions,
  AudioSessionConfiguration,
  AudioSessionMode,
  configureAudio,
  getAudioStatus,
} from 'react-native-nitro-audio-manager';

export type TestResult = { testId: number; passResult: boolean };
export type TestConfig = { testId: number; shouldPass: boolean };

type TestCombination = AudioSessionConfiguration<
  AudioSessionCategory,
  AudioSessionMode,
  AudioSessionCategoryOptions,
  boolean
> &
  TestConfig;

export async function runIOSCategoryTests(
  combinations: TestCombination[],
  onTestFinished: (result: TestResult) => void
) {
  for (const test of combinations) {
    try {
      await configureAudio({
        ios: {
          ...test,
        },
      });
      const status = getAudioStatus();

      if (Platform.OS === 'ios' && status && 'category' in status) {
        const categoriesMatched = status.category === test.category;
        const modesMatched = status.mode === test.mode;
        const optionWasInStatus = test.categoryOptions?.every((item) =>
          status.categoryOptions.includes(item)
        );

        const testPassedSuccessfully =
          categoriesMatched && modesMatched && optionWasInStatus;

        onTestFinished({
          passResult: testPassedSuccessfully === test.shouldPass,
          testId: test.testId,
        });
      }
    } catch (error) {
      onTestFinished({
        passResult: test.shouldPass === false,
        testId: test.testId,
      });
    }
  }
}

// AI GENERATED COMBINATIONS FOR TESTING.
// THERE ARE A LOT MORE BUT THIS IS A ROBUST START
export const iosTestCombinations: TestCombination[] = [
  // Test 1: Valid Playback with MixWithOthers
  {
    testId: 1,
    shouldPass: true,
    category: AudioSessionCategory.Playback,
    mode: AudioSessionMode.Default,
    categoryOptions: [AudioSessionCategoryOptions.MixWithOthers],
  },
  // Test 2: Valid PlayAndRecord with VideoRecording
  {
    testId: 2,
    shouldPass: true,
    category: AudioSessionCategory.PlayAndRecord,
    mode: AudioSessionMode.VideoRecording,
    categoryOptions: [AudioSessionCategoryOptions.MixWithOthers],
  },
  // Test 3: Invalid Record with MixWithOthers
  {
    testId: 3,
    shouldPass: false,
    category: AudioSessionCategory.Record,
    mode: AudioSessionMode.Measurement,
    categoryOptions: [AudioSessionCategoryOptions.MixWithOthers],
  },
  // Test 4: AllowBluetoothA2DP is set by default on SoloAmbient so this is not allowed
  {
    testId: 4,
    shouldPass: false,
    category: AudioSessionCategory.SoloAmbient,
    mode: AudioSessionMode.Default,
    categoryOptions: [AudioSessionCategoryOptions.AllowBluetoothA2DP],
  },
  // Test 5: Valid SoloAmbient with AllowBluetoothA2DP
  {
    testId: 5,
    shouldPass: false,
    category: AudioSessionCategory.SoloAmbient,
    mode: AudioSessionMode.Default,
    categoryOptions: [AudioSessionCategoryOptions.AllowBluetoothA2DP],
  },
  // Test 6: Valid PlayAndRecord with AllowBluetoothHFP
  {
    testId: 6,
    shouldPass: true,
    category: AudioSessionCategory.PlayAndRecord,
    mode: AudioSessionMode.VoiceChat,
    categoryOptions: [AudioSessionCategoryOptions.AllowBluetoothHFP],
  },
  // Test 7: Invalid Playback with AllowBluetoothHFP
  {
    testId: 7,
    shouldPass: false,
    category: AudioSessionCategory.Playback,
    mode: AudioSessionMode.MoviePlayback,
    categoryOptions: [AudioSessionCategoryOptions.AllowBluetoothHFP],
  },
  // Test 8: Valid MultiRoute with DuckOthers
  {
    testId: 8,
    shouldPass: true,
    category: AudioSessionCategory.MultiRoute,
    mode: AudioSessionMode.Default,
    categoryOptions: [AudioSessionCategoryOptions.DuckOthers],
  },
  // Test 9: Valid PlayAndRecord with AllowAirPlay
  {
    testId: 9,
    shouldPass: true,
    category: AudioSessionCategory.PlayAndRecord,
    mode: AudioSessionMode.VideoChat,
    categoryOptions: [AudioSessionCategoryOptions.AllowAirPlay],
  },
  // Test 10: Invalid Record with AllowAirPlay
  {
    testId: 10,
    shouldPass: false,
    category: AudioSessionCategory.Record,
    mode: AudioSessionMode.Default,
    categoryOptions: [AudioSessionCategoryOptions.AllowAirPlay],
  },
  // Test 11: Valid PlayAndRecord with DefaultToSpeaker
  {
    testId: 11,
    shouldPass: true,
    category: AudioSessionCategory.PlayAndRecord,
    mode: AudioSessionMode.GameChat,
    categoryOptions: [AudioSessionCategoryOptions.DefaultToSpeaker],
  },
  // Test 12: Valid Playback with InterruptSpokenAudioAndMixWithOthers
  {
    testId: 12,
    shouldPass: true,
    category: AudioSessionCategory.Playback,
    mode: AudioSessionMode.SpokenAudio,
    categoryOptions: [
      AudioSessionCategoryOptions.InterruptSpokenAudioAndMixWithOthers,
    ],
  },
  // Test 13: Valid Record with OverrideMutedMicrophoneInterruption
  {
    testId: 13,
    shouldPass: true,
    category: AudioSessionCategory.Record,
    mode: AudioSessionMode.Default,
    categoryOptions: [
      AudioSessionCategoryOptions.OverrideMutedMicrophoneInterruption,
    ],
  },
  // Test 14: Invalid Ambient with OverrideMutedMicrophoneInterruption
  {
    testId: 14,
    shouldPass: false,
    category: AudioSessionCategory.Ambient,
    mode: AudioSessionMode.Default,
    categoryOptions: [
      AudioSessionCategoryOptions.OverrideMutedMicrophoneInterruption,
    ],
  },
  // Test 15: Valid PlayAndRecord with Multiple Options
  {
    testId: 15,
    shouldPass: true,
    category: AudioSessionCategory.PlayAndRecord,
    mode: AudioSessionMode.Default,
    categoryOptions: [
      AudioSessionCategoryOptions.MixWithOthers,
      AudioSessionCategoryOptions.AllowBluetoothHFP,
      AudioSessionCategoryOptions.DefaultToSpeaker,
    ],
  },
  // Test 16: Valid Playback with DuckOthers and MixWithOthers
  {
    testId: 16,
    shouldPass: true,
    category: AudioSessionCategory.Playback,
    mode: AudioSessionMode.MoviePlayback,
    categoryOptions: [
      AudioSessionCategoryOptions.DuckOthers,
      AudioSessionCategoryOptions.MixWithOthers,
    ],
  },
  // Test 17: Invalid SoloAmbient with DuckOthers
  {
    testId: 17,
    shouldPass: false,
    category: AudioSessionCategory.SoloAmbient,
    mode: AudioSessionMode.Default,
    categoryOptions: [AudioSessionCategoryOptions.DuckOthers],
  },
  // Test 18: Valid Record with AllowBluetoothHFP
  {
    testId: 18,
    shouldPass: true,
    category: AudioSessionCategory.Record,
    mode: AudioSessionMode.Measurement,
    categoryOptions: [AudioSessionCategoryOptions.AllowBluetoothHFP],
  },
  // Test 19: Valid MultiRoute with MixWithOthers
  {
    testId: 19,
    shouldPass: true,
    category: AudioSessionCategory.MultiRoute,
    mode: AudioSessionMode.Default,
    categoryOptions: [AudioSessionCategoryOptions.MixWithOthers],
  },
  // Test 20: Totally valid.
  {
    testId: 20,
    shouldPass: true,
    category: AudioSessionCategory.PlayAndRecord,
    mode: AudioSessionMode.VideoRecording,
    categoryOptions: [AudioSessionCategoryOptions.AllowBluetoothA2DP],
  },
  // Test 21: Valid Ambient with No Options
  {
    testId: 21,
    shouldPass: true,
    category: AudioSessionCategory.Ambient,
    mode: AudioSessionMode.Default,
    categoryOptions: [],
  },
  // Test 22: AllowBluetoothA2DP is only allowed to apply
  {
    testId: 22,
    shouldPass: false,
    category: AudioSessionCategory.Playback,
    mode: AudioSessionMode.Default,
    categoryOptions: [AudioSessionCategoryOptions.AllowBluetoothA2DP],
  },
  // Test 23: Invalid MultiRoute with AllowBluetoothHFP
  {
    testId: 23,
    shouldPass: false,
    category: AudioSessionCategory.MultiRoute,
    mode: AudioSessionMode.Default,
    categoryOptions: [AudioSessionCategoryOptions.AllowBluetoothHFP],
  },
  // Test 24: Valid PlayAndRecord with VoiceChat and MixWithOthers
  {
    testId: 24,
    shouldPass: true,
    category: AudioSessionCategory.PlayAndRecord,
    mode: AudioSessionMode.VoiceChat,
    categoryOptions: [AudioSessionCategoryOptions.MixWithOthers],
  },
  // Test 25: Valid Record with No Options
  {
    testId: 25,
    shouldPass: true,
    category: AudioSessionCategory.Record,
    mode: AudioSessionMode.Default,
    categoryOptions: [],
  },
  // Test 26: Invalid Playback with DefaultToSpeaker
  {
    testId: 26,
    shouldPass: false,
    category: AudioSessionCategory.Playback,
    mode: AudioSessionMode.Default,
    categoryOptions: [AudioSessionCategoryOptions.DefaultToSpeaker],
  },
  // Test 27: Valid MultiRoute with InterruptSpokenAudioAndMixWithOthers
  {
    testId: 27,
    shouldPass: true,
    category: AudioSessionCategory.MultiRoute,
    mode: AudioSessionMode.SpokenAudio,
    categoryOptions: [
      AudioSessionCategoryOptions.InterruptSpokenAudioAndMixWithOthers,
    ],
  },
  // Test 28: Valid PlayAndRecord with OverrideMutedMicrophoneInterruption
  {
    testId: 28,
    shouldPass: true,
    category: AudioSessionCategory.PlayAndRecord,
    mode: AudioSessionMode.Default,
    categoryOptions: [
      AudioSessionCategoryOptions.OverrideMutedMicrophoneInterruption,
    ],
  },
  // Test 29: Invalid Ambient with AllowAirPlay
  {
    testId: 29,
    shouldPass: false,
    category: AudioSessionCategory.Ambient,
    mode: AudioSessionMode.Default,
    categoryOptions: [AudioSessionCategoryOptions.AllowAirPlay],
  },
  // Test 30: Valid SoloAmbient with No Options
  {
    testId: 30,
    shouldPass: true,
    category: AudioSessionCategory.SoloAmbient,
    mode: AudioSessionMode.Default,
    categoryOptions: [],
  },
];
