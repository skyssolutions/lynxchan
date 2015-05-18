Required modules:
mongodb
imagemagick
jsdom
Latest version of all them.

boot.js is the main file, run it using io.js to start the system. Keep in mind that if you ran setup.sh, you can just run the lynxchan command or start the lynxchan service.
It accepts the following arguments:
--debug, -d: for development. Will not cache static files and will reload any module besides the ones directly under the be directory.
--reload, -r: will rebuild all pages on boot.
--no-daemon, -nd: will not start listening. For rebuilding pages while having a server running.

The json api files will be stored on the api directory and acessed by the same subdomain. api.domain/function will use the file api/function.js.
The form api for support of users without js because they are retarded tin foilers are in the form directory and work the same as the api directory.
The engine directory will hold all scripts that provide functionality but are not to be accessed directly.

The following directories will be expected on the fe directory:
static: static files to be acessed by using the static subdomain.
templates: will hold the templates, so only the files will have to be specified on the settings.
A file called templateSettings.json should be located on the fe directory pointing the correct templates to be used, located on the templates directory. Inform only the name of the file.
index: template for the site's main page.
boardPage: template for the pages of the board.
threadPage: template for the page of a thread.
notFoundPage: template for the 404 page.

Settings files that goes into the settings directory:
general.json:
verbose(Boolean): if true, will output text for debugging on several points, like IO on the json api.
disable304: if true, will never use http status 304.
address: ip to bind the server on. Defaults to 127.0.0.1
port(Number): port to listen for http. Defaults to 8080.
ssl(Boolean): if true, will listen to https on port 443.
fePath: absolute path to the directory containing the fe files. Defaults to the relative path to the src/fe diretory.

db.json:
address: address of the database.
port: port the database is using.
database: database to use.
login: login to use on the database.
password: password to use on the database.
login is option and password will only be used if login is informed.
Settings files must contain a json object where each key defined here will have its corresponding value.

Metadata of files on gridfs will have the following values:
boardUri: board to which the file belongs to. If undefined, file is a default site file.
postId(Number): id of the post the file belongs to.
originalName: original name of the file.
type: type of file. May hold one of the following values:
    board: file is a board page.
    thread: file is a thread page.
    media: file is a media file.
status(Number): http status to be used when outputting this page. Defaults to 200 when outputting.

