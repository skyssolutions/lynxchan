#include <napi.h>
#include <stdio.h>
#include <ctime>
#include <Magick++.h>

const int width = 300;
const int height = 100;

const int distortLimiter = 30;

const int minDistorts = 3;
const int maxDistorts = 5;

const int minCircles = 5;
const int maxCircles = 10;

const int minCircleSize = 15;
const int maxCircleSize = 30;

const double baseDistorts[] = { 0, 0, 0, 0, 0, 100, 0, 100, 300, 0, 300, 0, 300,
    100, 300, 100 };

const int baseDistortsLength = 4;

int rng(int min, int max) {
  return min + (rand() % (max - min + 1));
}

Napi::Value buildCaptcha(const Napi::CallbackInfo& args) {

  Napi::Env env = args.Env();

  std::string text = args[0].As<Napi::String>();
  std::string font = args[1].As<Napi::String>();

  srand((unsigned) time(0));

  Magick::Geometry dimensions(width, height);

  Magick::Image textImage(dimensions, "white");

  textImage.fillColor("black");

  textImage.font(font);
  textImage.fontPointsize(70);

  textImage.annotate(text, MagickCore::CenterGravity);

  Magick::Image circleImage(dimensions, "white");

  const int circleCount = rng(minCircles, maxCircles);

  for (int i = 0; i < circleCount; i++) {

    const int startX = rng(width * 0.1, width * 0.9);
    const int startY = rng(height * 0.1, height * 0.9);

    const int size = rng(minCircleSize, maxCircleSize);

    circleImage.draw(
        Magick::DrawableCircle(startX, startY, rng(startX, startX + size),
            rng(startY, startY + size)));
  }

  textImage.composite(circleImage, 0, 0, Magick::DifferenceCompositeOp);
  textImage.negate();

  const int distortCount = rng(minDistorts, maxDistorts);

  const int distortArrayLength = (distortCount + baseDistortsLength) * 4;

  double distorts[distortArrayLength];

  memcpy(distorts, baseDistorts, baseDistortsLength * 4 * sizeof(double));

  const double portionSize = width / distortCount;

  for (int i = 0; i < distortCount; i++) {

    const int distortOriginX = rng(portionSize * i, portionSize * (1 + i));
    const int distortOriginY = rng(0, height);

    const int offset = (baseDistortsLength + i) * 4;

    distorts[offset] = distortOriginX;
    distorts[offset + 1] = distortOriginY;
    distorts[offset + 2] = rng(distortOriginX - distortLimiter,
        distortOriginX + distortLimiter);
    distorts[offset + 3] = rng(distortOriginY - distortLimiter,
        distortOriginY + distortLimiter);

  }

  textImage.distort(Magick::ShepardsDistortion, distortArrayLength, distorts);

  textImage.blur(0, 1);

  Magick::Blob imageBlob;

  textImage.magick("JPEG");
  textImage.write(&imageBlob);

  return Napi::Buffer<char>::Copy(env, (char*) imageBlob.data(),
      imageBlob.length());
}

class SizeWorker: public Napi::AsyncWorker {
public:
  SizeWorker(Napi::Function& callback, std::string path) :
      Napi::AsyncWorker(callback), path(path) {
  }
  ~SizeWorker() {
  }

  void Execute() {

    std::list < Magick::Image > frameList;

    try {
      readImages(&frameList, path);
    } catch (Magick::Exception exception) {
      error = exception.what();
      failed = true;
      return;
    }

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

    Callback().Call(
        { failed ? Napi::String::New(Env(), error) : Env().Undefined(),
            Napi::Number::New(Env(), width), Napi::Number::New(Env(), height) });

  }

private:
  std::string path, error;
  bool failed = false;
  size_t width = 0, height = 0;
};

Napi::Value getImageBounds(const Napi::CallbackInfo& args) {

  Napi::Env env = args.Env();

  if (args.Length() < 2) {
    Napi::TypeError::New(env, "Not enough arguments.").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  if (!args[0].IsString() || !args[1].IsFunction()) {
    Napi::TypeError::New(env,
        "Argument 1 must be a string and argument 2 must be a function").ThrowAsJavaScriptException();
    return env.Undefined();
  }

  Napi::Function callback = args[1].As<Napi::Function>();

  SizeWorker* sizeWorker = new SizeWorker(callback, args[0].As<Napi::String>());
  sizeWorker->Queue();

  return env.Undefined();

}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set(Napi::String::New(env, "buildCaptcha"),
      Napi::Function::New(env, buildCaptcha));
  exports.Set(Napi::String::New(env, "getImageBounds"),
      Napi::Function::New(env, getImageBounds));
  return exports;
}

NODE_API_MODULE(nativecaptcha, Init)
