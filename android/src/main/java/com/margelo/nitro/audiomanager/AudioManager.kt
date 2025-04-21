package com.margelo.nitro.audiomanager

import com.facebook.proguard.annotations.DoNotStrip
import android.media.AudioManager as SysAudioManager
import com.facebook.react.bridge.ReactApplicationContext
import android.content.Context
import com.margelo.nitro.core.*
import android.util.Log

@DoNotStrip
class AudioManager(reactContext: ReactApplicationContext) : HybridAudioManagerSpec() {

    private val ctx: Context = reactContext
    private var am: SysAudioManager? = null

    private val logTag = "AudioManagerModule"

    init {
        Log.d(logTag, "Initializing AudioManager Module...") // Log initialization start
        try {
            am = ctx.getSystemService(Context.AUDIO_SERVICE) as? SysAudioManager
            if (am == null) {
                Log.e(logTag, "AudioManager (am) failed to initialize - getSystemService returned null or context invalid?")
            } else {
                Log.d(logTag, "AudioManager (am) initialized successfully.")
            }
        } catch (e: Exception) {
            Log.e(logTag, "Exception during AudioManager initialization", e)
        }
    }

    override fun getSystemVolume(): Double {
        Log.d(logTag, "getSystemVolume called.") // Log when the method is entered

        // *** CRITICAL NULL CHECK ***
        if (am == null) {
            Log.e(logTag, "getSystemVolume called but AudioManager (am) is null!")
            // Throw a meaningful exception back to JS
            throw IllegalStateException("AudioManager native instance is not initialized.")
            // Alternatively, return an error value like -1.0, but throwing is often clearer
            // return -1.0
        }

        try {
            // Now we know 'am' is not null, but use safe call ?. or !!. assertion
            // Using !!. means "I'm sure it's not null here", will crash if it somehow is.
            val current = am!!.getStreamVolume(SysAudioManager.STREAM_MUSIC)
            val max = am!!.getStreamMaxVolume(SysAudioManager.STREAM_MUSIC)

            Log.d(logTag, "Current Volume: $current, Max Volume: $max") // Log retrieved values

            return if (max > 0) current.toDouble() / max.toDouble() else 0.0
        } catch (e: Exception) { // Catch potential exceptions during volume retrieval
            Log.e(logTag, "Exception occurred inside getSystemVolume", e)
            // Rethrow the exception so JS gets an error, wrapping the original cause
            throw RuntimeException("Native error in getSystemVolume: ${e.message}", e)
        }
    }

  override fun activate(): Promise<Unit> = Promise.async {
    // no-op
  }

  override fun deactivate(restorePreviousSessionOnDeactivation: Boolean): Promise<Unit> = Promise.async {
    // no-op
  }

  override fun getOutputLatency(): Double = 0.0

  override fun getInputLatency(): Double = 0.0

  override fun getAvailableInputs(): Array<PortDescription> = arrayOf()

  override fun getCurrentInputRoutes(): Array<PortDescription> = arrayOf()

  override fun getCurrentOutputRoutes(): Array<PortDescription> = arrayOf()

  override fun forceOutputToSpeaker() { }

  override fun cancelForcedOutputToSpeaker() { }

  override fun addInterruptionListener(callback: (InterruptionEvent) -> Unit): Double = 0.0

  override fun removeInterruptionListeners(id: Double) { }

  override fun addRouteChangeListener(callback: (RouteChangeEvent) -> Unit): Double = 0.0

  override fun removeRouteChangeListeners(id: Double) { }

  override fun isWiredHeadphonesConnected(): Boolean = false

  override fun isBluetoothHeadphonesConnected(): Boolean = false

  override fun getAudioSessionStatus(): AudioSessionStatus = AudioSessionStatus(
    category = AudioSessionCategory.AMBIENT,
    mode = AudioSessionMode.DEFAULT,
    categoryOptions = arrayOf(),
    routeSharingPolicy = AudioSessionRouteSharingPolicy.DEFAULT,
    isOutputtingAudioElsewhere = false,
    allowHapticsAndSystemSoundsDuringRecording = false,
    prefersNoInterruptionsFromSystemAlerts = false,
    prefersInterruptionOnRouteDisconnect = false,
    isEchoCancelledInputEnabled = false,
    isEchoCancelledInputAvailable = false
  )

  override fun configureAudioSession(
    category: String,
    mode: String,
    policy: String,
    categoryOptions: Array<String>,
    prefersNoInterruptionFromSystemAlerts: Boolean,
    prefersInterruptionOnRouteDisconnect: Boolean,
    allowHapticsAndSystemSoundsDuringRecording: Boolean,
    prefersEchoCancelledInput: Boolean
  ) {
    // Configure session here or leave no-op for now
  }
}
