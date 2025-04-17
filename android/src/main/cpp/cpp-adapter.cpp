#include <jni.h>
#include "audiomanagerOnLoad.hpp"

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  return margelo::nitro::audiomanager::initialize(vm);
}
