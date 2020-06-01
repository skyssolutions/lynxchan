#include <Magick++.h>
#include "imageThumb.h"

class ImageThumbWorker: public Napi::AsyncWorker {
public:
  ImageThumbWorker(Napi::Function& callback, std::string path,
      std::string destination, int size) :
      Napi::AsyncWorker(callback), path(path), destination(destination), size(
          size) {
  }
  ~ImageThumbWorker() {
  }

  void Execute() {

    std::list < Magick::Image > frameList;
    std::list < Magick::Image > coalescedList;

    readImages(&frameList, path);

    coalesceImages(&coalescedList, frameList.begin(), frameList.end());

    frameList.clear();

    bool multi = destination.substr(destination.length() - 2) == "_t";
    if (!multi) {
      multi = destination.substr(destination.length() - 4) == ".gif";
    }

    for (std::list<Magick::Image>::iterator it = coalescedList.begin();
        it != coalescedList.end() && (multi || it == coalescedList.begin());
        it++) {

      Magick::Image image = (*it);
      image.resize(Magick::Geometry(size, size));
      frameList.push_back(image);

    }

    writeImages(frameList.begin(), frameList.end(), destination);

  }

  void OnOK() {

    Napi::HandleScope scope(Env());

    Callback().Call( { });

  }

private:
  std::string path, destination;
  int size;
};

Napi::Value imageThumb(const Napi::CallbackInfo& args) {

  Napi::Env env = args.Env();

  Napi::Function callback = args[3].As<Napi::Function>();

  ImageThumbWorker* sizeWorker = new ImageThumbWorker(callback,
      args[0].As<Napi::String>(), args[1].As<Napi::String>(),
      args[2].As<Napi::Number>());
  sizeWorker->Queue();

  return env.Undefined();

}
