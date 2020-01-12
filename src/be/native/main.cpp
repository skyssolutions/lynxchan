#include <napi.h>
#include "captcha.h"
#include "imageBounds.h"

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set(Napi::String::New(env, "buildCaptcha"),
      Napi::Function::New(env, buildCaptcha));
  exports.Set(Napi::String::New(env, "getImageBounds"),
      Napi::Function::New(env, getImageBounds));
  return exports;
}

NODE_API_MODULE(nativecaptcha, Init)
