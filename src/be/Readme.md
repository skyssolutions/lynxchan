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
* `--tor-debug`, `-tr`: tor debug. Will cause any request to be marked as a if it were coming from a TOR exit node. 
* `--reload`, `-r`: will rebuild all pages on boot.
* `--reload-login`, `-rl`: will rebuild login page on boot.
* `--reload-banner`, `-rb`: will rebuild default banner on boot.
* `--reload-front`, `-rf`: will rebuild front-page on boot.
* `--reload-notfound`, `-rn`: will rebuild 404 page on boot.
* `--reload-thumb`, `-rt`: will rebuild generic thumbnail on boot.
* `--reload-audio`, `-ra`: will rebuild generic audio thumb on boot.
* `--rebuild-spoiler`, `-rs`: will rebuild spoiler image on boot.
* `--rebuild-maintenance`, `-rm`: will rebuild maintenance page on boot.
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
* `fePath`: absolute path to the directory containing the fe files. Defaults to the relative path to the src/fe directory. The directory indicated must have the `templateSettings.json` file. If you are using the front-end at the default path, the template settings must be sitting directly inside the `src/fe` directory.
* `pageSize`(Number): amount of threads on each board page. Defaults to 10.
* `latestPostCount`(Number): number of latest posts to be displayed on each thread in board pages. Defaults to 5.
* `autoSageLimit`(Number): how many posts a thread must hit at once so it becomes impossible to bump. Defaults to 500.
* `maxThreadCount`(Number): maximum amount of threads allowed per board. Defaults to 50.
* `tempDirectory`: path for temporary files. Defaults to `/tmp`.
* `emailSender`: e-mail to be used as sender on automated e-mails. Defaults to `noreply@mychan.com`.
* `captchaExpiration`: expiration in minutes of captchas. Defaults to 5 minutes.
* `captchaFonts`(Array): array of absolute paths to font files in the system to be randomly used in the captcha. Optional.
* `siteTitle`: name to be used as the title of the front-page. Defaults to the `titDefaultChanTitle` entry on the language pack.
* `maxRequestSizeMB`: maximum size in megabytes of incoming requests. Defaults to 2MB.
* `maxFileSizeMB`: maximum size in megabytes of individual uploaded files. Defaults to infinity.
* `acceptedMimes`(Array): accepted mimes on uploads. Defaults to `[ 'image/png', 'image/jpeg', 'image/gif', 'image/bmp' ]`.
* `maxFiles`(Number): maximum amount of files on each post. Defaults to 3.
* `defaultBanMessage`: default ban message to be used for banned content when the person applying the ban does not submit a message. Defaults to the `miscDefaultBanMessage` entry on the language pack.
* `disableAccountCreation`(Boolean): disables account creation for users.
* `restrictBoardCreation`(Boolean): disables board creation for users with global role greater than 1.
* `logPageSize`(Number): amount of log entries to be displayed at once. Defaults to 50.
* `defaultAnonymousName`: Default anonymous name if none is set for the board. Defaults to the `miscDefaultAnonymous` entry on the language pack.
* `topBoardsCount`(Number): amount of boards to be listed in the top boards. Defaults to 25. 
* `boardsPerPage`(Number): amount of boards to be listed in boards.js. Defaults to 50.
* `torSource`: url to the list of TOR exit nodes ips. Defaults to `https://check.torproject.org/exit-addresses`.
* `blockTor`(Boolean): if true, TOR users will be blocked.
* `languagePackPath`: absolute path to an optional language pack.
* `mediaThumb`(Boolean): if true, videos and music will generate thumbs instead of using the generic ones. Requires ffmpeg installed.
* `maxBoardRules`(Number): maximum amount of rules that board owners can set. Defaults to 20.
* `thumbSize`(Number): maximum size for both width and height for generated thumbnails. Defaults to 128.
* `maintenance`(Boolean): if set to true, the site will refuse any request to dynamic pages or functions used to interact with the system. Only static files and files on gridfs will be output to the user.
* `multipleReports`(Boolean): if true, allows for multiple postings to be reported at once.
* `maxFilters`(Number): maximum amount of filters a board owner can set. Defaults to 20.
* `maxBoardVolunteers`: maximum amount of volunteers a board can have. Defaults to 20.
* `maxBannerSizeKB`: maximum size in kilobytes for board banners. Defaults to maximum upload file and to 200KB if there is no maximum upload size. Will be ignored if larger or equal than maximum upload size.
* `maxFlagSizeKB`: maximum size in kilobytes for board flags. Defaults to 32KB.

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
  * `rules`
  * `flag`
