import { useEffect, useState } from 'react';
import {
  addListener,
  AudioManagerHybridObject,
  getSystemVolume,
} from './functions';
import { HeadphonesConnectedResult } from './types';

/**
 * A React hook that tracks wired and wireless headphone connection status.
 * @returns {HeadphonesConnectedResult} Object with `wired` and `wireless` boolean flags.
 * @example
 * const { wired, wireless } = useIsHeadphonesConnected();
 * <Text>{wired ? 'Wired' : wireless ? 'Wireless' : 'None'}</Text>
 */
export function useIsHeadphonesConnected(): HeadphonesConnectedResult {
  const [isWiredConnected, setIsWiredConnected] = useState(
    AudioManagerHybridObject.isWiredHeadphonesConnected()
  );
  const [isWirelessConnected, setIsWirelessConnected] = useState(
    AudioManagerHybridObject.isBluetoothHeadphonesConnected()
  );

  useEffect(() => {
    const unsubscribe = addListener('routeChange', () => {
      setIsWiredConnected(
        AudioManagerHybridObject.isWiredHeadphonesConnected()
      );
      setIsWirelessConnected(
        AudioManagerHybridObject.isBluetoothHeadphonesConnected()
      );
    });

    return () => {
      unsubscribe;
    };
  }, []);

  return { wired: isWiredConnected, wireless: isWirelessConnected };
}

/**
 * A React hook that tracks the device's system volume in real-time.
 * @returns {number} The current volume level (0.0 to 1.0).
 * @example
 * const volume = useVolume();
 * <Text>Volume: {(volume * 100).toFixed(0)}%</Text>
 */
export function useVolume(): number {
  const [volume, setVolume] = useState<number>(0);

  useEffect(() => {
    /**
     * Kick off initial volume fetch
     */
    getSystemVolume().then((initialVolume) => {
      setVolume(initialVolume);
    });
    /**
     * Apply listener
     */
    const unsubscribe = addListener('volume', (value) => {
      setVolume(value);
    });

    return () => {
      unsubscribe;
    };
  }, []);

  return volume;
}
