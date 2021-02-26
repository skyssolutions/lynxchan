# Dependencies
Required modules:
* http-proxy: used on sharding so the master server can act as a reverse-proxy and pass the request to slaves.
* mongodb: database driver.
* formidable: used when parsing requests to the form api.
* nodemailer: used to send e-mails for people resetting account passwords.
* nodemailer-direct-transport: used by nodemailer to send e-mails directly from the engine.
* parse5: used for handling DOM to create HTML from the templates.
* node-addon-api: used as a framework for the native functions.

The version of each one is specified on the package.json file.

A package.json file is included, so you can install all of them by just running `npm install` on this directory.

# Individual HTML cache
The engine will generate HTML caches for postings and log entries. These caches are for the whole cell containing the posting. Keep that in mind when developing, since it will be used unless the engine is running on front-end debug. You can flush them too, the command for doing so is in the list of arguments below.

# Application usage
`boot.js` is the main file, run it using Node.js to start the system. Keep in mind that if you ran `aux/setup.sh`, you can just run the `lynxchan` command or start the `lynxchan` service.
It accepts the following arguments:
* `--ip`, `-i`: ip. This ip will be used as the ip for all requests.
* `--tor-debug`, `-td`: tor debug. Will cause any request to be marked as a if it were coming from a TOR exit node.
* `--fe-debug`, `-fd`: front-end debug. Will not cache static files, disable individual HTML caches and reload the front-end templates.
* `--reload`, `-r`: will rebuild all pages on a running instance.
* `--reload-login`, `-rl`: will rebuild login page on boot.
* `--reload-banner`, `-rb`: will rebuild default banner on boot.
* `--reload-front`, `-rf`: will rebuild front-page on a running instance.
* `--reload-notfound`, `-rn`: will rebuild 404 page on boot.
* `--reload-thumb`, `-rt`: will rebuild generic thumbnail on boot.
* `--reload-audio`, `-ra`: will rebuild generic audio thumb on boot.
* `--reload-multiboard`, `-rbm`: will rebuild multiboard pages on a running instance.
* `--reload-spoiler`, `-rs`: will rebuild spoiler image on boot.
* `--reload-maintenance`, `-rm`: will rebuild maintenance page on boot.
* `--reload-maintenance-image`, `-rmi`: will rebuild maintenance image page on boot.
* `--reload-overboard`, `-ro`: reloads the overboard on a running instance.
* `--reload-logs`, `-rlog`: reloads logs on a running instance.
* `--reload-boards`, `-rboard`: reloads boards on a running instance. If a board uri is informed it will start from the informed board.
* `--reload-front-end`, `-rfe`: reloads the front-end files on a running instance, including cached static files. Will be ignored if maintenance mode is being changed on the same command or if no daemon was not informed.
* `--prune-files`, `-pf`: prunes files that no longer contains references to them. Its advisable to turn on maintenance mode before using this command to avoid race conditions.
* `--reload-graphs`, `-rg`: redraws daily graphs.
* `--no-daemon`, `-nd`: will not start listening to HTTP requests. For running commands while having a server running.
* `--create-account`, `-ca`: will create a new account. Require the use of the login, role and password parameters.
* `--login`, `-l`: informs a login.
* `--password`, `-p`: informs a password.
* `--global-role`, `-gr`: informs a role from 0 to 4, 0 meaning root user, 1 admin, 2 global volunteer, 3 global janitor and 4 regular user.
* `--set-role`, `-sr`: set a new role for an existing account. Will not be used if `-ca` is used. Takes a login and global role.
* `--maintenance`, `-m`: indicates a new value for maintenance mode on a running instance. The value will be parsed as JSON, so informing `true` or `false` will work, so as informing numbers that evaluate to false or true. Will be ignored if no daemon was not informed.
* `--disk-media`, `-dm`: disk media. If any boolean true value is passed, any media file on the db will transferred to the disk. Otherwise, any media file on the disk will be transferred to the db. Be warned to NOT RUN on slave nodes in a cluster and is also adviced to not have a daemon running while the transfer is ongoing.
* `--clear-individual-cache`, `-cc`: clears individual cache of postings and log entries.
* `--shutdown`, `-s`: orders a running instance to shut down. Will be ignored if no daemon was not informed or if either maintenance mode is being changed or if the front-end is being reloaded on the same command.
* `--set-password`, `-sp`: sets the password of the given account. Require the use of the login and password parameters.

Arguments that are meant to inform values should be used in the following manner:
`argument value`

Examples:
`lynxchan -r -nd` = rebuild all pages and do not start a server.
`lynxchan -ca -l login -p pass -gr 0` = create an account with login login, password pass with root global role and then start the server.
`lynxchan -rf -rb -nd` = reload the saved front-page and the default banner and do not start a server.

# Directory structure
The json api files will be stored on the `api` directory and accessed by the `/.api/` path. `/.api/function` will use the file `api/function.js`.
The form api for support of users without js because they are retarded tin foilers are in the `form` directory and are accessed using `domain/function.js`.
The `engine` directory will hold all scripts that provide functionality but are not to be accessed directly. There are also some few files directly under the `src/be` directory.
The `addons` directory are used to store the addons that can be loaded. After placing an addon on this directory, it should also be included in the `addons` general setting array.
And finally, the `settings` directory hold the settings files.

The following directories will be expected on the front-end directory:
* `static`: static files to be accessed by using the `/.static/` path.
* `templates`: will hold the templates, so only the files will have to be specified on the settings.

# Ban duration
The syntax for setting ban durations uses the following fields:
* `y`: year.
* `M`: month.
* `d`: day.
* `h`: hour.
* `m`: minute.

So if you write "2d 1h" it will create a 49 hour ban. The order of amounts and spacing doesn`t matter. The same could be "1h 2d".

# Templates
A file called `templateSettings.json` should be located on the front-end directory pointing the correct templates to be used, located on the templates directory. Inform only the name of the file. Refer to `doc/Templates.txt` for information on how to structure the templates.

# SSL
To use SSL, enable the setting `ssl` and place the key file named `ssl.key` and the certificate named `ssl.cert` on the src/be directories. Optionally, place the chain file named as `ssl.chain` to be able to provide the whole chain too. After that, restart the engine. Remember to also inform the key passphrase if it requires one.

# Back-end settings
Settings files that goes into the settings directory:
`general.json`: contains general settings for the application. Holds the following settings:
* `unlockHistory`(Boolean): if true, users that can't see plain text ips can still see a user's history across boards.
* `disableBanCaptcha`(Boolean): if true, bans will never require captchas for anyone.
* `useHttp2`(Boolean): if true, the engine will use HTTP2 for HTTPS.
* `lowercaseBoardUris`(Boolean): if true, all new boards will use lowercase uris.
* `trustedProxies`(Array): list of ips of the trusted proxies. Trusted proxies will have the x-forwarded-for taken in account to get the ip. By default, localhost and the lynxchan cluster master are also trusted proxies. Also, if the first trusted proxy is '*', then all requests will be treated as coming from trusted proxies.
* `dontProcessLinks`(Boolean): when set to true, links on posts won't be processed into hyperlinks.
* `fileLimit`(Number): total limit of uploaded files on the whole site. Defaults to 1000.
* `verbose`(Boolean): if true, will activate all verbose modes.
* `authenticationLimit`(Number): maximum amounts an account can perform authentication in a single minute.
* `disable304`(Boolean): if true, will never use http status 304.
* `torDNSBL`: DNSBL that should be used to detect tor exit nodes instead of the official list. See https://www.dan.me.uk/dnsbl .
* `captchaLimit`(Number): maximum amount of new captchas served to the same ip per minute. Ignores tor detection.
* `address`: ip to bind the server on. Defaults to `0.0.0.0`.
* `port`(Number): port to listen for http. Defaults to 80.
* `imageFont`: font to be used on images. Defaults to DejaVu-Sans.
* `ssl`(Number): SSL mode. If 0 it won`t be used, if 1 it will be used, if 2 all plain HTTP requests will be redirected to their HTTPS equivalent.
* `sslPass`: optional passphrase for the ssl key.
* `fileProcessingLimit`(Number): limit of files the engile will process in a single request. Defaults to 10.
* `validateMimes`(Boolean): indicates if uploaded files should have it's mime validated through the 'file' command. 
* `unboundBoardLimits`(Boolean): when set to true, board limits can surpass global limits.
* `redactModNames`(Boolean): when set to true will redact mod names on logs and edit indicators. 
* `fePath`: absolute path to the directory containing the fe files. Defaults to the relative path to the src/fe directory. The directory indicated must have the `templateSettings.json` file. If you are using the front-end at the default path, the template settings must be sitting directly inside the `src/fe` directory.
* `pageSize`(Number): amount of threads on each board page. Defaults to 10.
* `latestPostCount`(Number): number of latest posts to be displayed on each thread in board pages. Defaults to 5.
* `latestPostPinned`(Number): number of latest posts to displayed on each pinned thread in board pages. Ignored if greater than 'latestPostCount'. Defaults to 1.
* `autoSageLimit`(Number): how many posts a thread must hit at once so it becomes impossible to bump. Defaults to 500.
* `maxThreadCount`(Number): maximum amount of threads allowed per board. Defaults to 50.
* `tempDirectory`: path for temporary files. Defaults to `/tmp`.
* `emailSender`: e-mail to be used as sender on automated e-mails. Defaults to `noreply@mychan.com`.
* `captchaExpiration`: expiration in minutes of captchas. Defaults to 5 minutes.
* `siteTitle`: name to be used as the title of the front-page. Defaults to the `titDefaultChanTitle` entry on the language pack.
* `maxRequestSizeMB`: maximum size in megabytes of incoming requests. Defaults to 2MB.
* `maxFileSizeMB`: maximum size in megabytes of individual uploaded files. Defaults to infinity.
* `acceptedMimes`(Array): accepted mimes on uploads. Defaults to `[ 'image/png', 'image/jpeg', 'image/gif', 'image/bmp', 'video/webm', 'audio/mpeg', 'video/mp4', 'video/ogg', 'audio/ogg', 'audio/webm' ]`.
* `maxFiles`(Number): maximum amount of files on each post. Defaults to 3.
* `defaultBanMessage`: default ban message to be used for banned content when the person applying the ban does not submit a message. Defaults to the `miscDefaultBanMessage` entry on the language pack.
* `disableAccountCreation`(Boolean): disables account creation for users.
* `boardCreationRequirement`(Number): minimum global role required for board creation.
* `defaultAnonymousName`: Default anonymous name if none is set for the board. Defaults to the `miscDefaultAnonymous` entry on the language pack.
* `topBoardsCount`(Number): amount of boards to be listed in the top boards.
* `boardsPerPage`(Number): amount of boards to be listed in boards.js. Defaults to 50.
* `dnsbl`(Array): dnsbl domains to be used to check against posts.
* `torSource`: url to the list of TOR exit nodes ips. Defaults to `https://check.torproject.org/exit-addresses`.
* `languagePackPath`: absolute path to an optional language pack.
* `mediaThumb`(Boolean): if true, videos and music will generate thumbs instead of using the generic ones. Requires ffmpeg installed.
* `maxBoardRules`(Number): maximum amount of rules that board owners can set. Defaults to 20.
* `thumbSize`(Number): maximum size for both width and height for generated thumbnails. Defaults to 128.
* `maintenance`(Boolean): if set to true, the site will refuse any request to dynamic pages or functions used to interact with the system. Only static files and files on gridfs will be output to the user.
* `multipleReports`(Boolean): if true, allows for multiple postings to be reported at once.
* `maxFilters`(Number): maximum amount of filters a board owner can set. Defaults to 20.
* `maxBoardVolunteers`(Number: maximum amount of volunteers a board can have. Defaults to 20.
* `maxBannerSizeKB`(Number): maximum size in kilobytes for board banners. Defaults to 200KB.
* `maxFlagSizeKB`(Number): maximum size in kilobytes for board flags. Defaults to 32KB.
* `floodTimerSec`(Number): time in seconds required between postings, deletions and reports from the same ip. Not applicable to TOR users, but applicable to block bypasses. Defaults to 10. For thread creation, a separate timer using 10x the regular interval will be used.
* `maxBoardTags`(Number): maximum amount of tags each board can have. Defaults to 5.
* `disableFloodCheck`(Boolean): indicates if the flood checks should be disabled. This shouldn't affect performance at all, since it's meant to be used for benchmarking purposes.
* `clearIpMinRole`(Number): minimum global role required for users to see non-hashed ips from posts and perform global deletions from ip.
* `thumbExtension`: forces all thumbs to use this extension. Keeps gifs from being animated as a side-effect, even if `gif` is used.
* `allowGlobalBoardModeration`(Boolean): if true, global staff will be allowed to act as board moderators too.
* `addons`(Array): array of addons to be loaded. They will be loaded in the order they appear in this array.
* `maxFilterLength`(Number): maximum length allowed for filters. Defaults to 32.
* `useGlobalBanners`(Boolean): indicates if boards should use global banners. 
* `allowVolunteerSettings(Boolean)`: indicates if board volunteers are allowed to change board settings.
* `allowBoardCustomJs`(Boolean): if true, boards are allowed to have custom javascript.
* `globalLatestPosts`(Number): amount of global latest posts to be displayed on the front-page.
* `forceCaptcha`(Boolean): makes all boards use captcha.
* `overboard`: uri of the overboard.
* `overBoardThreadCount`(Number): amount of threads that should be shown at the overboard. Defaults to 50.
* `bypassMaxPosts`(Number): how many uses a block bypass will have before expires. Defaults to 30.
* `bypassDurationHours`(Number): how many hours a block bypass will last. Defaults to 24
* `bypassMode`(Number): mode used for bypass. 0 means that it won`t be enabled. 1 means that users caught in range bans and TOR users (if TOR is allowed to use block bypass) will be able to post if they get a bypass token. 2 means that anyone will only be able to post if they get a bypass token. Defaults to 0.
* `multiboardThreadCount`(Number): amount of threads to be displayed on the multi-board. If none is set, multi-board will not be enabled.
* `rssDomain`: domain used on links on the RSS feeds. Defaults to ''. 
* `globalLatestImages`(Number): amount of global latest images to be displayed on the front-page.
* `master`: ip of the master.
* `slaves`(Array): ips of the slaves.
* `frontPageStats`(Boolean): indicates if total posts made on existing boards and total unique ips on the last 24 hours should be displayed on the front-page.
* `pruningMode`(Number): The pruning mode to be used. 0 means no pruning at all. 1 means pruning files as soon as they become orphaned. 2 means prune orphaned files weekly.
* `torPort`(Number): port that when used, will always mark the request as if it came from a TOR ip.
* `sfwOverboard`: uri to be used for the sfw overboard.
* `requireConfirmationForBoardCreation`(Boolean): if activated, only accounts with verified e-mails are able to create boards.
* `CSP`: Content security policy directives. Example: `default-src 'self'`
* `onlySfwLatestImages`(Boolean): makes so only SFW images are displayed on the front-page.
* `inactivityThreshold`(Number): amount of days an user must be inactive so he and his boards will be marked as inactive.
* `mediaPageSize`(Number): amount of files to be displayed at once on the media management page. Defaults to 100.
* `messageLength`(Number): character limit for posted messages. Defaults to 4096.
* `ffmpegGifs`(Boolean): indicates if ffmpeg should be used to generate animated gif thumbnails. It yields lower quality thumbnails but they are smaller and are processed much faster.
* `spamIpsSource`: complete url to be used to fetch spammer's ips. It has to be able to be processed by the `unzip` command and contain the ips in plain text separated by commas. Defaults to `https://www.stopforumspam.com/downloads/bannedips.zip`. The ip list is downloaded every midnight UTC or if the file `spamData` can't be found on the `src/be` directory.
* `checkboxVersatileBlockBypass`(Boolean): indicates if people caught in the spam list or range bans are allowed to use the block bypass, given the block bypass is not disabled.
* `disableSpamCheck`(Boolean): indicates if the spam check should be skipped. Meant to be used on emergencies where its not possible at all to obtain the spam ip list.
* `disableCatalogPosting`(Boolean): removes the thread creation form from the board`s catalogs.
* `ipExpirationDays`(Number): amount of days to wait before removing the ip from postings counting from it's date of creation. Null or any value below 1 means that ips should never be removed. The schedule that clears the ips is run hourly.
* `torPostingLevel`(Number): indicates the permission level for TOR posting. 0 means no posting at all, 1 means posting with a block bypass and 2 means regular posting.
* `allowTorFiles`(Boolean): when posting, allows TOR users to post files.
* `useCacheControl`(Boolean): the cache-control header will be used instead of expire. It might help with services like cloudflare.
* `verboseApis`(Boolean): causes both the json api and the form api to print what is being both input and output.
* `verboseCache`(Boolean): causes the cache handler to print reads and writes.
* `verboseGridfs`(Boolean): causes the gridFsHandler to print information about it's operations.
* `verboseQueue`(Boolean): causes the message queue to print information about it's operations.
* `verboseMisc`(Boolean): causes any message being output outside of the other modes to be printed.
* `verboseGenerator`(Boolean): causes the cache generator to print information about it's operations.
* `useAlternativeLanguages`(Boolean): enables checking for user's language so one of the alternative languages can be used for his request.
* `incSpamIpsSource`(Boolean): complete url to be used to fetch latest additions to the spam ip database. Same rules for `spamIpsSource` apply, except that ips are separated by new lines instead of commas. Downloaded every hour. Defaults to `https://www.stopforumspam.com/downloads/listed_ip_1.zip`.
* `flagNameLength`(Number): maximum size allowed for custom flags names. Defaults to 32.
* `allowBlockedToReport`(Boolean): allows users that were banned or blocked to report content, including TOR users if they are not allowed to post.
* `clusterPort`(Number): port used for cluster communication.
* `emailDomainWhiteList`(Array): array of whitelisted e-mail domains. If any domain is defined, then users can only use e-mails from these domains. Otherwise every domain is accepted.
* `boardMessageLength`(Number): maximum size for board messages. Defaults to 256.
* `staticExpiration`(Number): amount of minutes that static files served from cache will inform as expiration when requested. Defaults to 60.
* `maxBoardHashBans`(Number): limit for board hash bans boards can have. Defaults to 128.
* `omitUnindexedContent`(Boolean): causes content from unindexes boards to not be displayed on the front-page or overboards.
* `disableLatestPostings`(Boolean): disables the setting that allows staff to see the latest postings of boards they can moderate and removes the link to this feature from the account page.
* `allowBoardStaffArchiving`(Boolean): allows board staff to archive threads.
* `maxBoardGeneralBans`(Number): limit for board range and ASN bans boards can have. Defaults to 128. It will be ignored when banning from an existing post. They are counted separately.
* `useSendmail`(Boolean): causes e-mails to be sent through your sendmail command instead of directly.
* `archiveThreshold`(Number): if set, threads with at least this many replies will be automatically archived instead of being pruned.
* `maxBoardBanners`(Number): maximum amount of banners that boards are allowed to have. Defaults to 16.
* `stripExif`(Boolean): if set, will remove exit data from files using exiftool.
* `diskMedia`(Boolean): if set, media files and thumbs will be stored in disk instead of the database.
* `captchaMode`(Number): level of captcha security. 0 is easy, 1 is moderate and 2 is hard. Defaults to 1.
* `disableEmail`(Boolean): silently disables sending any e-mails from the server.
* `noReportCaptcha`(Boolean): disables the need for captcha when reporting.
* `reportCategories`(Array): array with possible report categories.
* `wsPort`(Number): port to be used for notification web socket. Can't be any of the other ports used.
* `wssPort`(Number): port to be used for secure notification websocket. A regular websocket won't work under a page loaded through ssl. It will use the same files used for regular ssl. Can't be any of the other ports used.
* `latestPostsAmount`(Number): amount of posts to be displayed on the /last/ version of threads and on latestPostings. Defaults to 50.
* `bypassValidationRange`(Number): maximum limit of the block bypass validation code that must be brute forced so the bypass can be used. A minimum of 1000 is recommended.

`db.json`: contains database connection information.
* `address`: address of the database.
* `port`: port the database is using.
* `database`: database to use.
* `user`: login to use on the database.
* `password`: password to use on the database.
* `ssl`(Boolean): will connect to the database using SSL.
`user` is optional and `password` will only be used if login is informed.

Settings files must contain a json object where each key defined here will have its corresponding value.

# GridFS
Meta-data of files on gridfs will have the following values:
* `onDisk`: if true, the contents of the file are stored on disk instead of the db.
* `boardUri`: board to which the file belongs to. If undefined, file is a default site file.
* `lastModified`(Date): date of the last modification of the file.
* `boards`(Array): array of boards present on the multi-board page cache.
* `expiration`(Date): date of the expiration of the file, marking it to be removed.
* `compressed`(Boolean): if true, it means the file has or is a compressed version.
* `status`(Number): http status to be used when outputting this page. Defaults to 200 when outputting.
* `date`(Number): date to which the file refers to.
* `sha256`: hash for media files.
* `languages`(Array): array of languages that this page is aimed at.
* `referenceFile`: version of the default language for a file. Used for alternative language files. 
* `type`: type of file. May hold one of the following values: 
  * `media`
  * `captcha` 
  * `banner`
  * `flag`
  * `graph`
  * `custom`
