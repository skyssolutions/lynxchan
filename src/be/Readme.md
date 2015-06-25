# Dependencies
Required modules:
* mongodb: database driver.
* gm: used for creating thumbnails.
* jsdom: used for handling DOM to create HTML from the templates.
* multiparty: used when parsing requests to the form api.
* bcrypt: used for encrypting passwords.
* nodemailer: used to send e-mails for people resetting account passwords.

Latest version of all them.

A package.json file is included, so you can install all of them by just running `npm install` on this directory.

# Application usage
`boot.js` is the main file, run it using Io.js to start the system. Keep in mind that if you ran `aux/setup.sh`, you can just run the `lynxchan` command or start the `lynxchan` service.
It accepts the following arguments:
* `--debug`, `-d`: for development. Will not cache static files and will reload any module besides the ones directly under the be directory. It will also cause errors to crash and will clean any file in the temporary directory older than one minute every minute.
* `--reload`, `-r`: will rebuild all pages on boot.
* `--reload-login`, `-rl`: will rebuild login page on boot.
* `--no-daemon`, `-nd`: will not start listening. For rebuilding pages while having a server running.
* `--create-account`, `-ca`: will create a new account. Require the use of the login, role and password parameters.
* `--login`, `-l`: informs a login.
* `--password`, `-p`: informs a password.
* `--global-role`, `-gr`: informs a role.
* `--set-role`, `-sr`: set a new role for an existing account. Will not be used if `-ca` is used.

Arguments that are meant to inform values should be used in the following manner:
`argument value`

# Directory structure
The json api files will be stored on the api directory and accessed by the same sub-domain. `api.domain/function` will use the file `api/function.js`.
The form api for support of users without js because they are retarded tin foilers are in the form directory and are accessed using `domain/function.js`.
The `engine` directory will hold all scripts that provide functionality but are not to be accessed directly. There are also some few files directly under the `src/be` directory.

The following directories will be expected on the front-end directory:
* `static`: static files to be accessed by using the static sub-domain.
* `templates`: will hold the templates, so only the files will have to be specified on the settings.

# Templates
A file called `templateSettings.json` should be located on the front-end directory pointing the correct templates to be used, located on the templates directory. Inform only the name of the file. Refer to `doc/Templates.txt` for informations on how to structure the templates.

# Back-end settings
Settings files that goes into the settings directory:
`general.json`: contains general settings for the application. Holds the following settings:
* `verbose`(Boolean): if true, will output text for debugging on several points, like IO on the json api.
* `disable304`: if true, will never use http status 304.
* `address`: ip to bind the server on. Defaults to `0.0.0.0`.
* `port`(Number): port to listen for http. Defaults to 80.
* `ssl`(Boolean): if true, will listen to https on port 443.
* `fePath`: absolute path to the directory containing the fe files. Defaults to the relative path to the src/fe directory.
* `pageSize`(Number): amount of threads on each board page. Defaults to 10.
* `latestPostCount`(Number): number of latest posts to be displayed on each thread in board pages. Defaults to 5.
* `autoSageLimit`(Number): how many posts a thread must hit at once so it becomes impossible to bump. Defaults to 500.
* `maxThreadCount`(Number): maximum amount of threads allowed per board. Defaults to 50.
* `tempDirectory`: path for temporary files. Defaults to `/tmp`.
* `emailSender`: e-mail to be used as sender on automated e-mails. Defaults to `noreply@mychan.com`.
* `captchaExpiration`: expiration in minutes of captchas. Defaults to 5 minutes.
* `captchaFonts`(Array): array of absolute paths to font files in the system to be randomly used in the captcha. Optional.
* `siteTitle`: name to be used as the title of the front-page. Defaults to `My chan`.
* `maxRequestSizeMB`: maximum size in megabytes of incoming requests. Defaults to 2MB.
* `maxFileSizeMB`: maximum size in megabytes of individual uploaded files. Defaults to infinity.
* `acceptedMimes`(Array): accepted mimes on uploads. Defaults to `[ 'image/png', 'image/jpeg', 'image/gif' ]`.
* `maxFiles`(Number): maximum amount of files on each post. Defaults to 3.
* `defaultBanMessage`: default ban message to be used for banned content when the person applying the ban does not submit a message. Defaults to `(USER WAS BANNED FOR THIS POST)`;
* `disableAccountCreation`(Boolean): disables account creation for users.
* `restrictBoardCreation`(Boolean): disables board creation for users with global role greater than 1.
* `logPageSize`(Number): amount of log entries to be displayed at once. Defaults to 50.

`db.json`: contains database connection information.
* `address`: address of the database.
* `port`: port the database is using.
* `database`: database to use.
* `login`: login to use on the database.
* `password`: password to use on the database.

`login` is optional and `password` will only be used if login is informed.

Settings files must contain a json object where each key defined here will have its corresponding value.

# GridFS
Meta-data of files on gridfs will have the following values:
* `boardUri`: board to which the file belongs to. If undefined, file is a default site file.
* `expiration`: time of when the file is expired and no longer valid.
* `threadId`(Number): id of the thread the file belongs to.
* `postId`(Number): id of the post the file belongs to.
* `status`(Number): http status to be used when outputting this page. Defaults to 200 when outputting.
* `type`: type of file. May hold one of the following values: 
  * `board`
  * `thread` 
  * `media`
  * `captcha` 
  * `banner`
  * `catalog`
  * `preview`
