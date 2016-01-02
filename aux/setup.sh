#!/bin/bash

echo "Do you wish to download the default front-end to the default location? (y,n)"
read answerFrontEnd

echo "Do you wish to install the libraries? Requires node.js installed. (y,n)"
read answerLibs

echo "Do you wish to install the default settings from the example? (0.0.0.0:8080 to listen to requests, expects a database at localhost:27017) (y,n)"
read answerSettings

stable="n"

if [ "$stable" == "n" ]; then

  echo "Do you wish to change to the latest stable version? (y,n)"
  echo "Warning: if you have already started the server and inserted data, the server might not work after you change to the latest stable version. You can fix this by dropping the db and starting it again or using a different db."
  echo "Smaller warning: this operation will try to also checkout the respective tag on the front-end for this version, this part of the operation will only work if you have installed the placeholder front-end at /src/fe, like this scripts installs it."
  read answerStable

fi

if [ "$answerFrontEnd" == "y" ]; then
  
  git clone https://gitgud.io/LynxChan/LynxChanFront-Placeholder.git ../src/fe
  cd ../src/fe
  git checkout master
  cd ../../aux

  echo "Default front-end installed."

fi

if [ "$answerStable" == "y" ]; then

  cd ..
 
  git checkout 1.4.x
   
  cd src/fe
   
  git checkout 1.4.0

  cd ../../aux

  echo "Changed to latest stable version: 1.4.x"

fi

if [ "$answerSettings" == "y" ]; then

  cd ../src/be

  cp -r settings.example settings

  cd ../../aux

  echo "Default settings installed. The server will listen on 0.0.0.0:8080 and expects the database to be acessible at localhost:27017.  If you wish to change the settings, look for them at src/be/settings."

fi

if [ "$answerLibs" == "y" ]; then

  cd ../src/be
  npm install
  cd ../../aux

  echo "Libraries installed."

fi
