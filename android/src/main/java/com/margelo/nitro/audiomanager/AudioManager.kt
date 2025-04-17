package com.margelo.nitro.audiomanager
  
import com.facebook.proguard.annotations.DoNotStrip

@DoNotStrip
class AudioManager : HybridAudioManagerSpec() {
  override fun multiply(a: Double, b: Double): Double {
    return a * b
  }
}
