**LynxChan** is a chan engine designed with the following goals in mind:
1. Support users not using javascript for the basic functions.
2. Provide every functionality through a json based RPC.
3. Pre-generate pages to reduce load.
4. Support the most amount of users with the least hardware power.
5. Having a modular front-end so people can easily create and use different templates.

# License
MIT. Do whatever you want, I don't even know what is written there. I just know you can't sue me.

#Required software
* [Io.js](http://iojs.org)
* mongodb
* imagemagick

#Dependencies
Browse to `src/be` and run `npm install`.
There are about a half-dozen. They are defined in the `package.json` file, so you don't have to worry with details.

#Install
1. Create the required settings file in the `src/be/settings` directory. Instructions can be found at `src/be/readme.md`.
2. Create the user `iojs` on the system and make sure he has access to the `src/be` directory and the designed front-end directory.
3. Run `aux/setup.sh` as root. Optionally add either the argument `upstart` or `systemd` to install a service to act as a daemon using the `iojs` user.

#Running
You can either run the `lynxchan` command or start the `lynxchan` service. You could just run the `src/be/boot.js` file. Install is optional. Except step 0.

#Aux
There a couple of utility scripts there besides the install one. Rotating logs for the upstart service, removing installs and such.

#Documentation
As in many things, I am very anal about documentation.
You can find all the information you need at the documents in `doc`.

#Front-end
The front end are static files and templates. They are handled as a separate project and you can use them on any location in the system. But the path to its files will default to `src/fe`.
Note that the front-end directory is in the ignore. I am designing this project to have a modular front-end, so theres no point in having a default front-end in the repository.

#Back-end
The back-end project is a [nodeclipse](http://www.nodeclipse.org/) project with lint and formatting defined. IMO eclipse is a shit, but it makes it very practical to automatically format and clean everything
Coding standard: [Felix's Node style guide](https://github.com/felixge/node-style-guide)
More information can be found at `src/be/Readme.md`.

#Contributing
I would rather not having other people writing the initial code for the engine, but if you wish to suggest and discuss features or contribute to a default front-end to replace the placeholder ones I am using, you can find me under the name StephenLynx on #/tech/ at Rizon or e-mail me at sergio.a.vianna@gmail.com.

#WHAT IS THE INTERNET? WHAT IS A CHAN?*
8chan.co
