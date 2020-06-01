#include <ctime>
#include <Magick++.h>
#include "captcha.h"

const int width = 300;
const int height = 100;

const int distortLimiter = 30;

const int minDistorts = 3;
const int maxDistorts = 5;

const int minCircles = 5;
const int maxCircles = 10;

const int minCircleSize = 15;
const int maxCircleSize = 30;

const int lineCount = 5;

const int minLineWidth = 10;
const int maxLineWidth = 20;

const double baseDistorts[] = { 0, 0, 0, 0, 0, 100, 0, 100, 300, 0, 300, 0, 300,
    100, 300, 100 };

const int baseDistortsLength = 4;

int rng(int min, int max) {
  return min + (rand() % (max - min + 1));
}

class CaptchaBuildWorker: public Napi::AsyncWorker {
public:
  CaptchaBuildWorker(Napi::Function& callback, std::string text,
      std::string font, int level) :
      Napi::AsyncWorker(callback), text(text), font(font), level(level) {
  }
  ~CaptchaBuildWorker() {
  }

  void Execute() {

    srand((unsigned) time(0));

    Magick::Geometry dimensions(width, height);

    Magick::Image textImage(dimensions, "white");

    textImage.fillColor("black");

    textImage.font(font);
    textImage.fontPointsize(70);

    textImage.annotate(text, MagickCore::CenterGravity);

    Magick::Image maskImage(dimensions, "white");

    if (!level) {

      const int circleCount = rng(minCircles, maxCircles);

      for (int i = 0; i < circleCount; i++) {

        const int startX = rng(width * 0.1, width * 0.9);
        const int startY = rng(height * 0.1, height * 0.9);

        const int size = rng(minCircleSize, maxCircleSize);

        maskImage.draw(
            Magick::DrawableCircle(startX, startY, rng(startX, startX + size),
                rng(startY, startY + size)));
      }
    } else {

      int lineOffSet = rng(-maxLineWidth, maxLineWidth) / level;

      for (int i = 0; i < lineCount * level; i++) {

        const int lineWidth = rng(minLineWidth, maxLineWidth) / level;

        maskImage.draw(
            Magick::DrawableRectangle(0, lineOffSet, width,
                lineWidth + lineOffSet));

        lineOffSet += rng(minLineWidth, maxLineWidth) / level + lineWidth;

      }
    }

    textImage.composite(maskImage, 0, 0, Magick::DifferenceCompositeOp);
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

    textImage.magick("JPEG");
    textImage.write(&imageBlob);

  }

  void OnOK() {
    Napi::HandleScope scope(Env());

    Callback().Call(
        { Env().Undefined(), Napi::Buffer<char>::Copy(Env(),
            (char*) imageBlob.data(), imageBlob.length()) });

  }

private:
  std::string text, font;
  int level;
  Magick::Blob imageBlob;
};

Napi::Value buildCaptcha(const Napi::CallbackInfo& args) {

  Napi::Env env = args.Env();

  Napi::Function callback = args[3].As<Napi::Function>();

  CaptchaBuildWorker* sizeWorker = new CaptchaBuildWorker(callback,
      args[0].As<Napi::String>(), args[1].As<Napi::String>(),
      args[2].As<Napi::Number>());
  sizeWorker->Queue();

  return env.Undefined();

}
