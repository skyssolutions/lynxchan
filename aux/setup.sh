#!/bin/bash

echo "Do you wish to download the default front-end to the default location? (y,n)"
read answerFrontEnd

echo "Do you wish to install the libraries? Requires io.js installed. (y,n)"
read answerLibs

echo "Do you wish to install the default settings from the example? (127.0.0.1:8080 to listen to requests, expects a database at localhost:27017) (y,n)"
read answerSettings

if [ "$answerFrontEnd" == "y" ]; then
  git clone https://gitlab.com/mrseth/LynxChanFront-Placeholder.git ../src/fe
  cd ../src/fe
  git checkout master
  cd ../../aux

  echo "Default front-end installed."

fi

if [ "$answerLibs" == "y" ]; then
  cd ../src/be
  npm install
  cd ../../aux

echo "Libraries installed."

fi

if [ "$answerSettings" == "y" ]; then
  cd ../src/be

  cp -r settings.example settings

  cd ../../aux

  echo "Default settings installed. The server will listen on 127.0.0.1:8080 and expects the database to be acessible at localhost:27017.  If you wish to change the settings, look for them at src/be/settings."
fi
