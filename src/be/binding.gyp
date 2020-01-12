{
  "targets": [
    {
      "target_name": "native",
      "sources": [
        "native/main.cpp",
        "native/captcha.cpp",
        "native/imageBounds.cpp"
      ],
      "include_dirs": [
        "<!@(pkg-config --cflags-only-I Magick++ | sed s/-I//g)",
        "<!@(node -p \"require('node-addon-api').include\")"
      ],
      "link_settings": {
        "libraries": [
          "<!@(pkg-config --libs-only-l Magick++)"
        ]
      },
      "cflags_cc!": [ "-fno-exceptions" ],
      "defines": [
        "MAGICKCORE_HDRI_ENABLE=0",
        "MAGICKCORE_QUANTUM_DEPTH=16"
      ]
    }
  ]
}
