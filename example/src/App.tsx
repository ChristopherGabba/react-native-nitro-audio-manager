// App.tsx
import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Button,
  Switch,
  Platform,
} from 'react-native';
import * as Device from 'expo-device';
import {
  getSystemVolume,
  getOutputLatency,
  getInputLatency,
  getCurrentInputRoutes,
  getCurrentOutputRoutes,
  forceOutputToSpeaker,
  cancelForcedOutputToSpeaker,
  activate,
  deactivate,
  getAudioSessionStatus,
  addListener,
  useIsHeadphonesConnected,
  PortDescription,
} from 'react-native-audio-manager';
import { appendWithLimit } from './utils';
import {
  iosTestCombinations,
  runIOSCategoryTests,
  TestResult,
} from './iosCombinations';

export default function App() {
  // simple pieces of state

  const [systemVolume, setSystemVolume] = useState<number>(getSystemVolume());
  const [outLatency, setOutLatency] = useState<number>(getOutputLatency());
  const [inLatency, setInLatency] = useState<number>(getInputLatency());
  const [inRoutes, setInRoutes] = useState<string>();
  const [outRoutes, setOutRoutes] = useState<any>();
  const [sessionStatus, setSessionStatus] = useState<any>(null);
  const { wired, wireless } = useIsHeadphonesConnected();
  const [isActivated, setIsActivated] = useState(false);

  const [lastFiveRouteChangeEvents, setLastFiveRouteChangeEvents] = useState<
    string[]
  >(Array(5).fill(''));
  const [lastFiveInterruptionEvents, setLastFiveInterruptionEvents] = useState<
    string[]
  >(Array(5).fill(''));

  const manageFiveMostRecentRouteChangeEvents = (event: string) => {
    setLastFiveRouteChangeEvents((events) => appendWithLimit(events, event, 5));
  };

  const manageFiveMostRecentInterruptionEvents = (event: string) => {
    setLastFiveInterruptionEvents((events) =>
      appendWithLimit(events, event, 5)
    );
  };

  // helper to pretty‑print routes
  const routesToString = (arr: PortDescription[]) =>
    arr.map((r) => `${r.portType}:${r.uid}`).join('\n') || 'none';

  // attach a route‑change listener so we can update UI
  useEffect(() => {
    const unsub = addListener('routeChange', (evt) => {
      manageFiveMostRecentRouteChangeEvents(
        `${evt.reason}\noldDevice: ${routesToString(evt.prevRoute)}\nnewDevice: ${routesToString(evt.currentRoute)}`
      );
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = addListener('audioInterruption', (evt) => {
      manageFiveMostRecentInterruptionEvents(
        `Interruption ${evt.type}: ${evt.reason}`
      );
    });
    return unsub;
  }, []);

  useEffect(() => {
    console.log('Added');
    const unsub = addListener('volume', (volume) => {
      console.log('Volume', volume);
    });
    return unsub;
  }, []);

  const [testResults, setTestResults] = useState<string[]>([]);
  const addToTestArray = (result: TestResult) => {
    setTestResults((existing) => {
      return [
        ...existing,
        `Test ${result.testId}: ${result.passResult ? '✅' : '❌'}`,
      ];
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.inner}>
        <Text style={styles.title}>Audio Manager Example App:</Text>

        <Text style={styles.heading}>Device Info:</Text>
        <Text style={styles.testNote}>
          Audio Control Can Vary by System Version and Phone Model
        </Text>
        <Text style={styles.monospaced}>
          Model: {Device.manufacturer}: {Device.modelName}
        </Text>
        <Text style={styles.monospaced}>Sys Version: {Device.osVersion}</Text>
        <Text style={styles.heading}>Volume</Text>
        <Text style={styles.testNote}>
          Test #1: Raise volume up and down on side of phone and tap button to
          check value.
        </Text>
        <View style={styles.row}>
          <Button
            title="Get System Volume"
            onPress={() => {
              const volume = getSystemVolume();
              console.log('Got volume', volume);
              setSystemVolume(volume);
            }}
          />
          <Text style={styles.monospaced}>{systemVolume.toFixed(2)}</Text>
        </View>
        <Text style={styles.heading}>Latency</Text>
        <Text style={styles.testNote}>
          Test #2: Plug in wired headphones and check latencies.
        </Text>
        <Text style={styles.testNote}>
          Test #3: Plug in bluetooth headphones and check latencies.
        </Text>
        <Text style={styles.testNote}>
          Test #4: Connect to car bluetooth like carplay and check latencies.
        </Text>
        <Text style={styles.testNote}>(Note: Returns -1 if unavailable)</Text>
        <View style={styles.row}>
          <Button
            title="Get Output Latency"
            onPress={() => setOutLatency(getOutputLatency())}
          />
          <Text style={styles.monospaced}>{outLatency.toFixed(4)} ms</Text>
        </View>
        <View style={styles.row}>
          <Button
            title="Get Input Latency"
            onPress={() => setInLatency(getInputLatency())}
          />
          <Text style={styles.monospaced}>{inLatency} ms</Text>
        </View>
        <Text style={styles.heading}>Audio Inputs / Outputs</Text>
        <Text style={styles.testNote}>
          Test #5: Connect headphones and tap "List Inputs" and "List Outputs".
          Should go up to 2.
        </Text>
        <Button
          title="Refresh Input / Outputs"
          onPress={() => {
            setInRoutes(routesToString(getCurrentInputRoutes()));
            setOutRoutes(routesToString(getCurrentOutputRoutes()));
          }}
        />
        <Text style={styles.value}>Inputs</Text>
        <Text style={styles.monospaced}>{inRoutes}</Text>
        <Text style={styles.value}>{inRoutes?.length ?? 0} ports</Text>
        <Text style={styles.value}>Outupts</Text>
        <Text style={styles.monospaced}>{outRoutes}</Text>
        <Text style={styles.value}>{inRoutes?.length ?? 0} ports</Text>
        <Text style={styles.heading}>Headphones Connected & Events</Text>
        <Text style={styles.testNote}>
          Test Method: Unplug / plug in headphones (wired, bluetooth, etc.)
        </Text>
        {lastFiveRouteChangeEvents.map((event, index) => {
          return (
            <Text style={styles.monospaced} key={`rce_${index}`}>
              {event}
            </Text>
          );
        })}
        <View style={styles.row}>
          <Text style={styles.monospaced}>
            Wired: {wired ? 'TRUE' : 'FALSE'}
          </Text>
          <Text style={styles.monospaced}>
            Wireless: {wireless ? 'TRUE' : 'FALSE'}
          </Text>
        </View>

        <Text style={styles.heading}>Audio Interruption Events</Text>
        <Text style={styles.testNote}>Requires active audio session</Text>
        <Text style={styles.testNote}>
          Test Method: Receive incomming call?
        </Text>
        {lastFiveInterruptionEvents.map((event, index) => {
          return (
            <Text style={styles.monospaced} key={`rce_${index}`}>
              {event}
            </Text>
          );
        })}
        <Text style={styles.heading}>Speaker Routing</Text>
        <View style={styles.row}>
          <Button title="Force to Speaker" onPress={forceOutputToSpeaker} />
          <Button title="Cancel Force" onPress={cancelForcedOutputToSpeaker} />
        </View>

        <Text style={styles.heading}>Session Lifecycle</Text>
        <View style={styles.row}>
          <Button
            title={isActivated ? 'Deactivate' : 'Activate'}
            onPress={async () => {
              if (isActivated) {
                await deactivate({
                  restorePreviousSessionOnDeactivation: true,
                });
              } else {
                await activate();
              }
              setIsActivated(!isActivated);
            }}
          />
          <Switch
            value={isActivated}
            onValueChange={async (v) => {
              if (v) await activate();
              else await deactivate();
              setIsActivated(v);
            }}
          />
        </View>

        <Text style={styles.heading}>Session Config</Text>
        <Button
          title="Get Status"
          onPress={() => setSessionStatus(getAudioSessionStatus())}
        />
        <Text style={styles.value}>
          {sessionStatus
            ? JSON.stringify(sessionStatus, null, 2)
            : 'no status yet'}
        </Text>
        <Button
          title="Run Category Tests"
          onPress={() => {
            console.log('Ran');
            setTestResults([]);
            runIOSCategoryTests(iosTestCombinations, (result) => {
              addToTestArray(result);
            });
          }}
        />
        {testResults.map((result, index) => {
          return (
            <Text style={styles.monospaced} key={`result_${index}`}>
              {result}
            </Text>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f7f7' },
  inner: { padding: 16 },
  title: { fontSize: 20, fontWeight: '600', textAlign: 'center' },
  heading: { fontSize: 18, fontWeight: '600', marginTop: 24 },
  testNote: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    justifyContent: 'space-between',
  },
  value: { marginLeft: 12, flex: 1 },
  monospaced: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    backgroundColor: '#eee',
    padding: 8,
    marginTop: 4,
  },
});
