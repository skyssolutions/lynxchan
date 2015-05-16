LynxChan:
LynxChan is a chan engine designed with the following goals in mind:
1- Support users not using javascript for the basic functions.
2- Provide every functionality through a json based RPC.
3- Pre-generate pages to reduce load.

Required software: io.js, mongodb, imagemagick.


Back-end:
The back-end project is a nodeclipse project with lint and formatting defined.
You can find nodeclipse at http://www.nodeclipse.org/
Coding standard: https://github.com/felixge/node-style-guide
The front-end files will not be included in this repository.
More information can be found at src/be/Readme.txt

The aux doc contains scripts for installation. When running setup.sh you can provide the arguments systemd or upstart to select one of these two init systems.
After the setup a service called lynxchan will be installed as well a command.
