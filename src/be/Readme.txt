Required modules:
mongodb
imagemagick
jsdom
Latest version of all them.

boot.js is the main file, run it using io.js to start the system. Keep in mind that if you ran setup.sh, you can just run the lynxchan command.
It accepts the following arguments:
debug: for development. Will not cache static files and will reload any module besides boot.js and systems.

The json api files will be stored on the api directory and acessed by the same subdomain. api.domain/function will use the file api/function.js.
The form api for support of users without js because they are retarded tin foilers are in the form directory and work the same as the api directory.
The engine directory will hold all scripts that provide functionality but are not to be accessed directory.
The systems directory will hold systems that require initialization and will not be rebooted if debug mode is used.

The following directories will be expected on the fe directory:
static: static files to be acessed by using the static subdomain.
templates: will hold the templates, so only the files will have to be specified on the settings.
