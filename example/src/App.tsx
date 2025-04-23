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

import {
  getSystemVolume,
  getOutputLatency,
  getInputLatency,
  getAvailableInputs,
  getCurrentInputRoutes,
  getCurrentOutputRoutes,
  forceOutputToSpeaker,
  cancelForcedOutputToSpeaker,
  activate,
  deactivate,
  getAudioSessionStatus,
  configureAudioSession,
  addListener,
  useIsHeadphonesConnected,
  AudioSessionCategory,
  AudioSessionMode,
  AudioSessionRouteSharingPolicy,
} from 'react-native-audio-manager';

export default function App() {
  // simple pieces of state
  const [systemVolume, setSystemVolume] = useState<number>(0);
  const [outLatency, setOutLatency] = useState<number>(0);
  const [inLatency, setInLatency] = useState<number>(0);
  const [inputs, setInputs] = useState<any[]>([]);
  const [inRoutes, setInRoutes] = useState<any[]>([]);
  const [outRoutes, setOutRoutes] = useState<any[]>([]);
  const [sessionStatus, setSessionStatus] = useState<any>(null);
  const { wired, wireless } = useIsHeadphonesConnected();
  const [isActivated, setIsActivated] = useState(false);
  const [lastEvent, setLastEvent] = useState<string>('–');

  // helper to pretty‑print routes
  const routesToString = (arr: any[]) =>
    arr.map((r) => `${r.portType}:${r.uid}`).join('\n') || 'none';

  // attach a route‑change listener so we can update UI
  useEffect(() => {
    const unsub = addListener('routeChange', (evt) => {
      setLastEvent(`routeChange: ${evt.reason}`);
      setInRoutes(getCurrentInputRoutes());
      setOutRoutes(getCurrentOutputRoutes());
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsub = addListener('audioInterruption', (evt) => {
      setLastEvent(`audioInterruption: ${evt.reason}`);
    });
    return unsub;
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.inner}>
        <Text style={styles.heading}>System Metrics</Text>
        <View style={styles.row}>
          <Button
            title="Get Volume"
            onPress={() => setSystemVolume(getSystemVolume())}
          />
          <Text style={styles.value}>{systemVolume.toFixed(2)}</Text>
        </View>
        <View style={styles.row}>
          <Button
            title="Get Out Latency"
            onPress={() => setOutLatency(getOutputLatency())}
          />
          <Text style={styles.value}>{outLatency} ms</Text>
        </View>
        <View style={styles.row}>
          <Button
            title="Get In Latency"
            onPress={() => setInLatency(getInputLatency())}
          />
          <Text style={styles.value}>{inLatency} ms</Text>
        </View>
        <View style={styles.row}>
          <Button
            title="List Inputs"
            onPress={() => setInputs(getAvailableInputs())}
          />
          <Text style={styles.value}>{inputs.length} ports</Text>
        </View>

        <Text style={styles.heading}>Audio Routes</Text>
        <View style={styles.row}>
          <Button
            title="Refresh Routes"
            onPress={() => {
              setInRoutes(getCurrentInputRoutes());
              setOutRoutes(getCurrentOutputRoutes());
            }}
          />
        </View>
        <Text style={styles.subheading}>Inputs</Text>
        <Text style={styles.monospaced}>{routesToString(inRoutes)}</Text>
        <Text style={styles.subheading}>Outputs</Text>
        <Text style={styles.monospaced}>{routesToString(outRoutes)}</Text>

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
          title="Configure Play & Record"
          onPress={() =>
            configureAudioSession({
              category: AudioSessionCategory.PlayAndRecord,
              mode: AudioSessionMode.Default,
              policy: AudioSessionRouteSharingPolicy.Default,
            })
          }
        />

        <Text style={styles.heading}>Headphones Connected</Text>
        <Text style={styles.value}>Wired: {wired ? 'yes' : 'no'}</Text>
        <Text style={styles.value}>Wireless: {wireless ? 'yes' : 'no'}</Text>

        <Text style={styles.heading}>Last Event</Text>
        <Text style={styles.monospaced}>{lastEvent}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7f7f7' },
  inner: { padding: 16 },
  heading: { fontSize: 18, fontWeight: '600', marginTop: 24 },
  subheading: { fontSize: 14, fontWeight: '500', marginTop: 12 },
  row: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  value: { marginLeft: 12, flex: 1 },
  monospaced: {
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }),
    backgroundColor: '#eee',
    padding: 8,
    marginTop: 4,
  },
});
