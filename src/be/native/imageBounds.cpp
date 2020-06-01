#include <Magick++.h>
#include "imageBounds.h"

class ImageSizeWorker: public Napi::AsyncWorker {
public:
  ImageSizeWorker(Napi::Function& callback, std::string path) :
      Napi::AsyncWorker(callback), path(path) {
  }
  ~ImageSizeWorker() {
  }

  void Execute() {

    std::list < Magick::Image > frameList;

    readImages(&frameList, path);

    for (std::list<Magick::Image>::iterator it = frameList.begin();
        it != frameList.end(); it++) {

      Magick::Geometry dimensions = it->size();

      size_t currentWidth = dimensions.width();
      size_t currentHeight = dimensions.height();

      width = currentWidth > width ? currentWidth : width;
      height = currentHeight > height ? currentHeight : height;

    }

  }

  void OnOK() {
    Napi::HandleScope scope(Env());

    Callback().Call( { Env().Undefined(), Napi::Number::New(Env(), width),
        Napi::Number::New(Env(), height) });

  }

private:
  std::string path;
  size_t width = 0, height = 0;
};

Napi::Value getImageBounds(const Napi::CallbackInfo& args) {

  Napi::Env env = args.Env();

  Napi::Function callback = args[1].As<Napi::Function>();

  ImageSizeWorker* sizeWorker = new ImageSizeWorker(callback,
      args[0].As<Napi::String>());
  sizeWorker->Queue();

  return env.Undefined();

}
