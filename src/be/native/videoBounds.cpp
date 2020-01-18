extern "C" {
#include <libavformat/avformat.h>
}

#include "videoBounds.h"

bool silent = false;

class VideoSizeWorker: public Napi::AsyncWorker {
public:
  VideoSizeWorker(Napi::Function& callback, std::string path) :
      Napi::AsyncWorker(callback), path(path) {
  }
  ~VideoSizeWorker() {

    if (formatContext) {
      avformat_close_input(&formatContext);
    }

  }

  void Execute() {

    error = avformat_open_input(&formatContext, path.c_str(), NULL, NULL);

    if (error) {
      return;
    }

    error = avformat_find_stream_info(formatContext, NULL);

    if (error) {
      return;
    }

    int videoStream = -1;

    for (unsigned int i = 0; i < formatContext->nb_streams; i++) {
      if (formatContext->streams[i]->codecpar->codec_type == AVMEDIA_TYPE_VIDEO
          && videoStream < 0) {
        videoStream = i;
      }
    }

    if (videoStream < 0) {
      error = AVERROR_UNKNOWN;
      return;
    }

    AVCodecParameters* codecParameters =
        formatContext->streams[videoStream]->codecpar;

    if (!codecParameters) {
      error = AVERROR_UNKNOWN;
      return;
    }

    width = codecParameters->width;
    height = codecParameters->height;

  }

  void OnOK() {
    Napi::HandleScope scope(Env());

    if (error) {

      char errorBuffer[256];

      av_strerror(error, errorBuffer, 256);

      errorStr = "Error processing " + path + ": " + errorBuffer;
    }

    Callback().Call(
        { error ? Napi::String::New(Env(), errorStr) : Env().Undefined(),
            Napi::Number::New(Env(), width), Napi::Number::New(Env(), height) });

  }

private:
  std::string path, errorStr;
  int error;
  size_t width = 0, height = 0;
  AVFormatContext* formatContext = NULL;
};

Napi::Value getVideoBounds(const Napi::CallbackInfo& args) {

  if (!silent) {
    silent = true;
    av_log_set_level (AV_LOG_QUIET);
  }

  Napi::Env env = args.Env();

  Napi::Function callback = args[1].As<Napi::Function>();

  VideoSizeWorker* sizeWorker = new VideoSizeWorker(callback,
      args[0].As<Napi::String>());
  sizeWorker->Queue();

  return env.Undefined();

}
