package com.margelo.nitro.audiomanager

import android.os.Build
import com.facebook.proguard.annotations.DoNotStrip
import android.media.AudioManager as SysAudioManager
import android.media.AudioDeviceInfo
import android.media.AudioDeviceCallback
import com.margelo.nitro.NitroModules
import android.content.Context
import com.margelo.nitro.core.*
import android.util.Log

data class Listener<T>(
  val id: Double,
  val callback: T
)

@DoNotStrip
class AudioManager : HybridAudioManagerSpec() {

  companion object {
    private const val TAG = "AudioManager"
  }

  private lateinit var am: SysAudioManager

  init {
    NitroModules.applicationContext?.let { ctx ->
      am = ctx.getSystemService(Context.AUDIO_SERVICE) as SysAudioManager
      Log.d(TAG, "AudioManager initialized via init{}")
    } ?: run {
      Log.e(TAG, "AudioManager: applicationContext was null")
    }
  }

  private val interruptionListeners = mutableListOf<Listener<(InterruptionEvent) -> Unit>>()
  private val routeChangeListeners = mutableListOf<Listener<(RouteChangeEvent) -> Unit>>()
  private var nextListenerId = 0.0
  private var lastRoute: Array<PortDescription> = emptyArray()

  private val focusCallback = SysAudioManager.OnAudioFocusChangeListener { focus ->
    val type = when (focus) {
      SysAudioManager.AUDIOFOCUS_LOSS,
      SysAudioManager.AUDIOFOCUS_LOSS_TRANSIENT             -> InterruptionType.BEGAN
      else                                                  -> InterruptionType.ENDED
    }

    val reason = when (focus) {
      SysAudioManager.AUDIOFOCUS_LOSS,
      SysAudioManager.AUDIOFOCUS_LOSS_TRANSIENT,
      SysAudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK   -> InterruptionReason.APPWASSUSPENDED

      else                                                 -> InterruptionReason.DEFAULT
    }

    val ev = InterruptionEvent(type, reason)
    interruptionListeners.forEach { it.callback(ev) }
  }

  private val deviceCallback = object : AudioDeviceCallback() {
    override fun onAudioDevicesAdded(added: Array<AudioDeviceInfo>) {
      dispatchRouteChange(RouteChangeReason.NEWDEVICEAVAILABLE)
    }
    override fun onAudioDevicesRemoved(removed: Array<AudioDeviceInfo>) {
      dispatchRouteChange(RouteChangeReason.OLDDEVICEUNAVAILABLE)
    }
  }

  override fun addInterruptionListener(callback: (InterruptionEvent) -> Unit): Double {
    if (interruptionListeners.isEmpty()) {
      am.requestAudioFocus(
        focusCallback,
        SysAudioManager.STREAM_MUSIC,
        SysAudioManager.AUDIOFOCUS_GAIN
      )
    }
    val id = nextListenerId++
    interruptionListeners += Listener(id, callback)
    return id
  }

  override fun removeInterruptionListeners(id: Double) {
    interruptionListeners.removeAll { it.id == id }
  }

  override fun addRouteChangeListener(callback: (RouteChangeEvent) -> Unit): Double {
    if (routeChangeListeners.isEmpty()) {
      lastRoute = am
        .getDevices(SysAudioManager.GET_DEVICES_OUTPUTS)
        .map { mapToPort(it) }
        .toTypedArray()

      am.registerAudioDeviceCallback(deviceCallback, null)
    }
    val id = nextListenerId++
    routeChangeListeners += Listener(id, callback)
    return id
  }

  override fun removeRouteChangeListeners(id: Double) {
    routeChangeListeners.removeAll { it.id == id }
    if (routeChangeListeners.isEmpty()) {
      am.unregisterAudioDeviceCallback(deviceCallback)
      lastRoute = emptyArray()
    }
  }

  private fun dispatchRouteChange(reason: RouteChangeReason) {
    val currentRoute = am
      .getDevices(SysAudioManager.GET_DEVICES_OUTPUTS)
      .map { mapToPort(it) }
      .toTypedArray()

    val ev = RouteChangeEvent(
      prevRoute    = lastRoute,
      currentRoute = currentRoute,
      reason       = reason
    )

    lastRoute = currentRoute

    routeChangeListeners.forEach { it.callback(ev) }
  }

  override fun getSystemVolume(): Double {
    val current = am.getStreamVolume(SysAudioManager.STREAM_MUSIC)
    val max     = am.getStreamMaxVolume(SysAudioManager.STREAM_MUSIC)
    return if (max > 0) current.toDouble() / max.toDouble() else 0.0
  }


  override fun activate(): Promise<Unit> = Promise.async {
    // no-op
  }

  override fun deactivate(restorePreviousSessionOnDeactivation: Boolean): Promise<Unit> = Promise.async {
    // no-op
  }

  /**
   * Returns the buffer‑size / sample‑rate = seconds of latency per buffer.
   * E.g. 256 frames @ 48 000 Hz ≈ 5.3 ms = 0.0053 s
   */
  override fun getOutputLatency(): Double {
    val srStr    = am.getProperty(SysAudioManager.PROPERTY_OUTPUT_SAMPLE_RATE)
    val bufStr   = am.getProperty(SysAudioManager.PROPERTY_OUTPUT_FRAMES_PER_BUFFER)

    if (srStr == null || bufStr == null) {
      Log.w(TAG, "Output latency props unavailable")
      return -1.0
    }

    val sampleRate     = srStr.toIntOrNull() ?: return -1.0
    val framesPerBuf   = bufStr.toIntOrNull() ?: return -1.0

    return framesPerBuf.toDouble() / sampleRate.toDouble()
  }

  /**
   * On Android S+ you can query the input buffer size; on older releases it’s not exposed.
   */
  override fun getInputLatency(): Double {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val inFramesStr = am.getProperty("android.media.property.INPUT_FRAMES_PER_BUFFER")
      val srStr       = am.getProperty(SysAudioManager.PROPERTY_OUTPUT_SAMPLE_RATE)
      val inFrames    = inFramesStr?.toIntOrNull() ?: return -1.0
      val sr          = srStr?.toIntOrNull()      ?: return -1.0
      return inFrames.toDouble() / sr.toDouble()
    }
    // Property not computable in older versions
    return -1.0
  }

  private fun mapToPort(device: AudioDeviceInfo): PortDescription {
    val type = when (device.type) {
      AudioDeviceInfo.TYPE_BUILTIN_MIC             -> PortType.BUILTINMIC
      AudioDeviceInfo.TYPE_WIRED_HEADSET,
      AudioDeviceInfo.TYPE_WIRED_HEADPHONES        -> PortType.HEADSETMIC
      AudioDeviceInfo.TYPE_LINE_ANALOG,
      AudioDeviceInfo.TYPE_LINE_DIGITAL            -> PortType.LINEIN

      AudioDeviceInfo.TYPE_BLUETOOTH_A2DP          -> PortType.BLUETOOTHA2DP
      AudioDeviceInfo.TYPE_BLUETOOTH_SCO           -> PortType.BLUETOOTHHFP

      AudioDeviceInfo.TYPE_HDMI                    -> PortType.HDMI
      AudioDeviceInfo.TYPE_USB_DEVICE,
      AudioDeviceInfo.TYPE_USB_HEADSET             -> PortType.USBAUDIO

      AudioDeviceInfo.TYPE_BUILTIN_SPEAKER         -> PortType.BUILTINSPEAKER
      AudioDeviceInfo.TYPE_BUILTIN_EARPIECE,
      AudioDeviceInfo.TYPE_TELEPHONY               -> PortType.BUILTINRECEIVER

      else                                         -> PortType.UNKNOWN
    }

    return PortDescription(
      portName               = device.productName?.toString() ?: "Unknown",
      portType               = type,
      uid = device.id.toString(),
      channels = device.channelCounts.takeIf { it.isNotEmpty() }?.map { it.toDouble() }?.toDoubleArray(),
      isDataSourceSupported = true,
      selectedDataSourceId = null 
    )
  }

  override fun getAvailableInputs(): Array<PortDescription> {

    val inputs: Array<AudioDeviceInfo> =
      am.getDevices(SysAudioManager.GET_DEVICES_INPUTS)

    return inputs
      .map { device -> mapToPort(device) }
      .toTypedArray()
  }

  override fun getCurrentInputRoutes(): Array<PortDescription> {

    val inputs = am.getDevices(SysAudioManager.GET_DEVICES_INPUTS)

    val active: AudioDeviceInfo? = when {
      @Suppress("DEPRECATION")
      am.isWiredHeadsetOn -> inputs.firstOrNull {
        it.type == AudioDeviceInfo.TYPE_WIRED_HEADSET ||
        it.type == AudioDeviceInfo.TYPE_WIRED_HEADPHONES
      }

      @Suppress("DEPRECATION")
      am.isBluetoothScoOn -> inputs.firstOrNull {
        it.type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO
      }

      else -> inputs.firstOrNull {
        it.type == AudioDeviceInfo.TYPE_BUILTIN_MIC
      }
    }

    val chosen = active ?: inputs.firstOrNull()

    return active
      ?.let { arrayOf(mapToPort(it)) }
      ?: arrayOf()
  }

  override fun getCurrentOutputRoutes(): Array<PortDescription>  {
    val outputs = am.getDevices(SysAudioManager.GET_DEVICES_OUTPUTS)

    val active: AudioDeviceInfo? = when {
      @Suppress("DEPRECATION")
      am.isBluetoothA2dpOn -> outputs.firstOrNull {
        it.type == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP
      }

      @Suppress("DEPRECATION")
      am.isWiredHeadsetOn -> outputs.firstOrNull {
        it.type == AudioDeviceInfo.TYPE_WIRED_HEADPHONES ||
        it.type == AudioDeviceInfo.TYPE_WIRED_HEADSET
      }

      @Suppress("DEPRECATION")
      am.isSpeakerphoneOn -> outputs.firstOrNull {
        it.type == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER
      }

      else -> outputs.firstOrNull {
        it.type == AudioDeviceInfo.TYPE_BUILTIN_EARPIECE ||
        it.type == AudioDeviceInfo.TYPE_TELEPHONY
      }
    }

    return active
      ?.let { arrayOf(mapToPort(it)) }
      ?: arrayOf()
  }

  override fun forceOutputToSpeaker() { }

  override fun cancelForcedOutputToSpeaker() { }

  override fun isWiredHeadphonesConnected(): Boolean {
    val outputs: Array<AudioDeviceInfo> = am.getDevices(SysAudioManager.GET_DEVICES_OUTPUTS)
    return outputs.any { device ->
      device.type == AudioDeviceInfo.TYPE_WIRED_HEADPHONES ||
      device.type == AudioDeviceInfo.TYPE_WIRED_HEADSET
    }
  }

  override fun isBluetoothHeadphonesConnected(): Boolean {
    val outputs: Array<AudioDeviceInfo> = am.getDevices(SysAudioManager.GET_DEVICES_OUTPUTS)
    return outputs.any { device ->
      device.type == AudioDeviceInfo.TYPE_BLUETOOTH_A2DP ||
      device.type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO
    }
  }

  override fun getAudioSessionStatusIOS(): AudioSessionStatus? {
    // no-op
    return null
  }

  override fun getAudioManagerStatusAndroid(): AudioManagerStatus? {
    val mode = when {
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.M &&
        am.mode == SysAudioManager.MODE_CALL_SCREENING ->
          AudioMode.CALLSCREENING

      am.mode == SysAudioManager.MODE_RINGTONE ->
          AudioMode.RINGTONE

      am.mode == SysAudioManager.MODE_IN_CALL ->
          AudioMode.INCALL

      am.mode == SysAudioManager.MODE_IN_COMMUNICATION ->
          AudioMode.INCOMMUNICATION

      else ->
          AudioMode.NORMAL
    }

    val ringer = when (am.ringerMode) {
      SysAudioManager.RINGER_MODE_SILENT  -> RingerMode.SILENT
      SysAudioManager.RINGER_MODE_VIBRATE -> RingerMode.VIBRATE
      else                                -> RingerMode.NORMAL
    }

    return AudioManagerStatus(
      mode       = mode,
      ringerMode = ringer
    )
  }

  override fun configureAudioSessionIOS(
    category: String,
    mode: String,
    policy: String,
    categoryOptions: Array<String>,
    prefersNoInterruptionFromSystemAlerts: Boolean,
    prefersInterruptionOnRouteDisconnect: Boolean,
    allowHapticsAndSystemSoundsDuringRecording: Boolean,
    prefersEchoCancelledInput: Boolean
  ) {
    // no-op
  }
}
