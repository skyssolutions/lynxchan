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
* `--no-daemon`, `-nd`: will not start listening. For rebuilding pages while having a server running.
* `--create-account`, `-ca`: will create a new account. Require the use of the login, role and password parameters.
* `--login`, `-l`: informs a login.
* `--password`, `-p`: informs a password.
* `--global-role`, `-gr`: informs a role.

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
A file called `templateSettings.json` should be located on the front-end directory pointing the correct templates to be used, located on the templates directory. Inform only the name of the file.
* `index`: template for the site's main page.
* `boardPage`: template for the pages of the board.
* `threadPage`: template for the page of a thread.
* `notFoundPage`: template for the 404 page.
* `errorPage`: template used for the error page.
* `messagePage`: template used for the general message page.
* `opCell`: template for the OP's.
* `postCell`: template for thread replies.
* `thumb`: image to be used for generic thumbnails.
* `loginPage`: template to be used for the login screen.
* `accountPage`: template to be used for the account page.
* `recoveryEmail`: template to be used for the e-mail sent after a recovery request is created.
* `resetEmail`: template to be used for the e-mail sent after the account's password is reset.
* `globalManagement`: template for the site management.
* `staffCell`: template for the global staff members.
* `bManagement`: template for board management.
* `volunteerCell`: template used for the board volunteers.
* `reportCell`: template used for reports.
* `closedReportsPage`: template used for the page of closed reports.
* `closedReportCell`: template used for the closed reports cell.
* `bansPage`: template used for the bans page.
* `banCell`: template used for the bans cell.
* `uploadCell`: template used for uploads cell.
* `banPage`: template used for the ban page.

# Back-end settings
Settings files that goes into the settings directory:
`general.json`: contains general settings for the application. Holds the following settings:
* `verbose`(Boolean): if true, will output text for debugging on several points, like IO on the json api.
* `disable304`: if true, will never use http status 304.
* `address`: ip to bind the server on. Defaults to 127.0.0.1
* `port`(Number): port to listen for http. Defaults to 8080.
* `ssl`(Boolean): if true, will listen to https on port 443.
* `fePath`: absolute path to the directory containing the fe files. Defaults to the relative path to the src/fe directory.
* `pageSize`(Number): amount of threads on each board page.
* `previewPostCount`(Number): number of preview posts on a thread.
* `autoSageLimit`(Number): how many posts a thread must hit at once so it becomes impossible to bump.
* `maxThreadCount`(Number): maximum amount of threads allowed per board.
* `tempDirectory`: path for temporary files. Defaults to '/tmp'.
* `emailSender`: e-mail to be used as sender on automated e-mails.
* `captchaExpiration`: expiration in minutes of captchas. Defaults to 1 minute.
* `captchaFonts`(Array): array of absolute paths to font files in the system to be used in the captcha. Optional.
* `siteTitle`: name to be used as the title of the front-page.
* `maxRequestSizeMB`: maximum size in megabytes of incoming requests. Defaults to 2MB.
* `maxFileSizeMB`: maximum size in megabytes of individual uploaded files. Defaults to infinity.
* `acceptedMimes`(Array): accepted mimes on uploads. Defaults to `[ 'image/png', 'image/jpeg', 'image/gif' ]`.

`db.json`: contains database connection information.
* `address`: address of the database.
* `port`: port the database is using.
* `database`: database to use.
* `login`: login to use on the database.
* `password`: password to use on the database.

`login` is optional and `password` will only be used if login is informed.

Settings files must contain a json object where each key defined here will have its corresponding value.

# GridFS
Metadata of files on gridfs will have the following values:
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

