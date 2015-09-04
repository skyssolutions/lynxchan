# Status:
Beta

# About
**LynxChan** is a chan engine designed with the following goals in mind:
1. Support users not using javascript for the basic functions.
2. Provide every functionality through a json based RPC.
3. Support the most amount of users with the least hardware power.
4. Having a modular front-end so people can easily create and use different templates.

# Required software
* [Io.js](http://iojs.org), I suggest installing from source code. Just remember to checkout the latest tag instead of using the latest commit. I recommend using version 2.5.0 for production. I had random crashes with both 3.2.0 and 3.3.0.
* [MongoDB](https://www.mongodb.org/)
* [ImageMagick](http://www.imagemagick.org/script/index.php)
* [ffmpeg](https://www.ffmpeg.org/) if mediaThumb setting is enabled. Requires zlib-devel on centOS.
* [A front-end](https://gitlab.com/mrseth/LynxChanFront-Placeholder) that must either be placed on the `src/fe` directory or have it's absolute path set on the general.json file. Read the readme.md on src/be for more information about how to configure the path for the front-end.

# Automatic install
1. Required: browse to `aux` and run the script `setup.sh` that will prompt for the install of a front-end, default settings and libraries. Browsing to the `aux` directory is required because the scripts use relative paths to this directory.
2. Optional: run the script `root-setup.sh` that will prompt for the install of a command using a soft-link to `src/be/boot.js`. This script must be run as root. It will also try to install a service if you provide the argument `systemd` or `upstart` and have an user called `iojs`.
  
# Manual install
1. Create the required settings file in the `src/be/settings` directory. Instructions can be found at `src/be/readme.md`. There is also a directory called settings.example with a set of functional settings.
2. Browse to `src/be` and run `npm install`.
3. Clone a front-end to the `src/fe` directory or clone to anywhere and set it's correct location on `src/be/settings/general.json`.

# Running
You can either run the `lynxchan` command or start the `lynxchan` service if you ran the `aux/root-setup.sh` script. You could just run the `src/be/boot.js` file. Run ``` sudo setcap 'cap_net_bind_service=+ep' `which iojs` ``` to be able to run it on port 80 without root access.

# Documentation
As in many things, I am very anal about documentation.
You can find all the information you need at the documents in `doc`.

# Front-end
The front end are static files and templates. They are handled as a separate project and you can use them on any location in the system. But the path to its files will default to `src/fe`.
Note that the front-end directory is in the ignore. I am designing this project to have a modular front-end, so theres no point in having a default front-end in the repository. 
* [Definitive front-end](https://github.com/lleaff/LynxChanFront) is the definitive version developed by lleaff. It is prettier and has more features. Requires gulp to be built.
* [Placeholder front-end](https://gitlab.com/mrseth/LynxChanFront-Placeholder) is usually more up to date, but has less features and is kind of rough.

# Back-end
The back-end project is a [Nodeclipse](http://www.nodeclipse.org/) project with lint and formatting defined. IMO eclipse is a shit, but it makes it very practical to automatically format and clean everything.
Coding standard: [Felix's Node style guide](https://github.com/felixge/node-style-guide). Additionally, all files that reach 1k LOC must be split into multiple files inside a module representing the original file.
More information can be found at [src/be/Readme.md](src/be/Readme.md).

# Supported systems
GNU/Linux

# Aux
There a couple of utility scripts there besides the install one. Rotating logs for the upstart service, removing installs and such.

# License
MIT. Do whatever you want, I don't even know what is written there. I just know you can't sue me.

# Development priority
Infra-structure > features > cosmetic features > polish.

# Contributing
I would rather not having other people writing the initial code for the engine, but if you wish to suggest and discuss features or contribute to a default front-end to replace the placeholder ones I am using, you can find me under the name StephenLynx on #lynxchan at Rizon or e-mail me at sergio.a.vianna@gmail.com.

[WHAT IS THE INTERNET? WHAT IS A CHAN?](http://8chan.co)
