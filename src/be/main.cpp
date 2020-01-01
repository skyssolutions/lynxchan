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
				Magick::DrawableCircle(startX, startY,
						rng(startX, startX + size),
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

Napi::Object Init(Napi::Env env, Napi::Object exports) {
	exports.Set(Napi::String::New(env, "buildCaptcha"),
			Napi::Function::New(env, buildCaptcha));
	return exports;
}

NODE_API_MODULE(nativecaptcha, Init)
