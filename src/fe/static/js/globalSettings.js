var globalSettings = {};

globalSettings.init = function() {

  api.convertButton('saveFormButton', globalSettings.save,
      'globalSettingsField');

  globalSettings.siteSettingsRelation = {

    fieldSlaves : {
      setting : 'slaves',
      type : 'string'
    },
    checkboxSendmail : {
      type : 'boolean',
      setting : 'useSendmail',
    },
    checkboxDiskMedia : {
      type : 'boolean',
      setting : 'diskMedia',
    },
    checkboxRedactModNames : {
      type : 'boolean',
      setting : 'redactModNames',
    },
    checkboxUnboundBoardLimits : {
      type : 'boolean',
      setting : 'unboundBoardLimits',
    },
    checkboxGlobalBanners : {
      type : 'boolean',
      setting : 'useGlobalBanners',
    },
    fieldLatestPostPinned : {
      type : 'string',
      setting : 'latestPostPinned',
    },
    checkboxStripExif : {
      type : 'boolean',
      setting : 'stripExif',
    },
    checkboxValidateMimes : {
      type : 'boolean',
      setting : 'validateMimes',
    },
    checkboxDisableLatestPostings : {
      type : 'boolean',
      setting : 'disableLatestPostings',
    },
    checkboxVerboseCache : {
      type : 'boolean',
      setting : 'verboseCache',
    },
    checkboxVolunteerSettings : {
      type : 'boolean',
      setting : 'allowVolunteerSettings',
    },
    checkboxVerboseGenerator : {
      type : 'boolean',
      setting : 'verboseGenerator',
    },
    checkboxDontProcessLinks : {
      type : 'boolean',
      setting : 'dontProcessLinks',
    },
    checkboxHttp2 : {
      type : 'boolean',
      setting : 'useHttp2',
    },
    checkboxBoardStaffArchiving : {
      type : 'boolean',
      setting : 'allowBoardStaffArchiving',
    },
    checkboxVerboseQueue : {
      type : 'boolean',
      setting : 'verboseQueue',
    },
    checkboxOmitUnindexedContent : {
      type : 'boolean',
      setting : 'omitUnindexedContent',
    },
    fieldMaxBoardHashBans : {
      type : 'string',
      setting : 'maxBoardHashBans',
    },
    fieldMaxBoardGeneralBans : {
      type : 'string',
      setting : 'maxBoardGeneralBans',
    },
    fieldLatestPostsAmount : {
      type : 'string',
      setting : 'latestPostsAmount',
    },
    fieldFileProcessingLimit : {
      type : 'string',
      setting : 'fileProcessingLimit',
    },
    fieldMaxFilterLength : {
      type : 'string',
      setting : 'maxFilterLength',
    },
    fieldImageFont : {
      type : 'string',
      setting : 'imageFont',
    },
    checkboxVerboseGridfs : {
      type : 'boolean',
      setting : 'verboseGridfs',
    },
    checkboxBlockedReport : {
      type : 'boolean',
      setting : 'allowBlockedToReport',
    },
    checkboxVerboseMisc : {
      type : 'boolean',
      setting : 'verboseMisc',
    },
    checkboxVerboseApis : {
      type : 'boolean',
      setting : 'verboseApis',
    },
    checkboxDisableCatalogPosting : {
      type : 'boolean',
      setting : 'disableCatalogPosting',
    },
    checkboxDisableCatalogPosting : {
      type : 'boolean',
      setting : 'disableCatalogPosting',
    },
    checkboxAllowTorFiles : {
      type : 'boolean',
      setting : 'allowTorFiles',
    },
    checkboxUseAlternativeLanguages : {
      type : 'boolean',
      setting : 'useAlternativeLanguages',
    },
    fieldIpExpiration : {
      type : 'string',
      setting : 'ipExpirationDays'
    },
    fieldAuthenticationLimit : {
      type : 'string',
      setting : 'authenticationLimit'
    },
    fieldClusterPort : {
      type : 'string',
      setting : 'clusterPort'
    },
    fieldIncrementalSpamIpsSource : {
      type : 'string',
      setting : 'incSpamIpsSource'
    },
    fieldMaxBoardBanners : {
      type : 'string',
      setting : 'maxBoardBanners'
    },
    fieldMaster : {
      setting : 'master',
      type : 'string'
    },
    fieldFileLimit : {
      setting : 'fileLimit',
      type : 'string'
    },
    fieldTorDNSL : {
      setting : 'torDNSBL',
      type : 'string'
    },
    fieldTrustedProxies : {
      setting : 'trustedProxies',
      type : 'string'
    },
    fieldMessageLength : {
      setting : 'messageLength',
      type : 'string'
    },
    fieldTorPort : {
      setting : 'torPort',
      type : 'string'
    },
    fieldBoardMessageLength : {
      setting : 'boardMessageLength',
      type : 'string'
    },
    fieldSpamIpsSource : {
      setting : 'spamIpsSource',
      type : 'string'
    },
    fieldCaptchaLimit : {
      setting : 'captchaLimit',
      type : 'string'
    },
    fieldDnsbl : {
      setting : 'dnsbl',
      type : 'string'
    },
    fieldAddress : {
      setting : 'address',
      type : 'string'
    },
    fieldMediaPageSize : {
      setting : 'mediaPageSize',
      type : 'string'
    },
    fieldBypassHours : {
      type : 'string',
      setting : 'bypassDurationHours',
    },
    fieldRssDomain : {
      setting : 'rssDomain',
      type : 'string'
    },
    fieldInactivityThreshold : {
      setting : 'inactivityThreshold',
      type : 'string'
    },
    fieldCSP : {
      setting : 'CSP',
      type : 'string'
    },
    fieldPort : {
      setting : 'port',
      type : 'string'
    },
    fieldSfwOverboard : {
      setting : 'sfwOverboard',
      type : 'string'
    },
    fieldMultiBoardThreadCount : {
      setting : 'multiboardThreadCount',
      type : 'string'
    },
    fieldSslPass : {
      setting : 'sslPass',
      type : 'string'
    },
    fieldGlobalLatestPosts : {
      setting : 'globalLatestPosts',
      type : 'string'
    },
    fieldOverBoardThreads : {
      setting : 'overBoardThreadCount',
      type : 'string'
    },
    fieldFePath : {
      setting : 'fePath',
      type : 'string'
    },
    fieldBypassPosts : {
      setting : 'bypassMaxPosts',
      type : 'string'
    },
    fieldOverboard : {
      setting : 'overboard',
      type : 'string'
    },
    fieldPageSize : {
      setting : 'pageSize',
      type : 'string'
    },
    fieldMaxTags : {
      setting : 'maxBoardTags',
      type : 'string'
    },
    fieldArchiveThreshold : {
      setting : 'archiveThreshold',
      type : 'string'
    },
    fieldLatestPostsCount : {
      setting : 'latestPostCount',
      type : 'string'
    },
    fieldAutoSageLimit : {
      setting : 'autoSageLimit',
      type : 'string'
    },
    fieldThreadLimit : {
      setting : 'maxThreadCount',
      type : 'string'
    },
    fieldSiteTitle : {
      setting : 'siteTitle',
      type : 'string'
    },
    fieldTempDir : {
      setting : 'tempDirectory',
      type : 'string'
    },
    fieldSenderEmail : {
      setting : 'emailSender',
      type : 'string'
    },
    fieldCaptchaExpiration : {
      setting : 'captchaExpiration',
      type : 'string'
    },
    fieldMaxRequestSize : {
      setting : 'maxRequestSizeMB',
      type : 'string'
    },
    fieldMaxFileSize : {
      setting : 'maxFileSizeMB',
      type : 'string'
    },
    fieldMaxFiles : {
      setting : 'maxFiles',
      type : 'string'
    },
    fieldBanMessage : {
      setting : 'defaultBanMessage',
      type : 'string'
    },
    fieldAnonymousName : {
      setting : 'defaultAnonymousName',
      type : 'string'
    },
    fieldTopBoardsCount : {
      setting : 'topBoardsCount',
      type : 'string'
    },
    fieldFlagNameLength : {
      setting : 'flagNameLength',
      type : 'string'
    },
    fieldStaticExpiration : {
      setting : 'staticExpiration',
      type : 'string'
    },
    fieldBoardsPerPage : {
      setting : 'boardsPerPage',
      type : 'string'
    },
    fieldTorSource : {
      setting : 'torSource',
      type : 'string'
    },
    fieldLanguagePack : {
      setting : 'languagePackPath',
      type : 'string'
    },
    fieldMaxRules : {
      setting : 'maxBoardRules',
      type : 'string'
    },
    fieldThumbSize : {
      setting : 'thumbSize',
      type : 'string'
    },
    fieldMaxFilters : {
      setting : 'maxFilters',
      type : 'string'
    },
    fieldMaxVolunteers : {
      setting : 'maxBoardVolunteers',
      type : 'string'
    },
    fieldGlobalLatestImages : {
      setting : 'globalLatestImages',
      type : 'string'
    },
    fieldMaxBannerSize : {
      setting : 'maxBannerSizeKB',
      type : 'string'
    },
    fieldMaxFlagSize : {
      setting : 'maxFlagSizeKB',
      type : 'string'
    },
    fieldThumbExtension : {
      setting : 'thumbExtension',
      type : 'string'
    },
    fieldFloodInterval : {
      setting : 'floodTimerSec',
      type : 'string'
    },
    checkboxVerbose : {
      setting : 'verbose',
      type : 'boolean'
    },
    checkboxFfmpegGifs : {
      setting : 'ffmpegGifs',
      type : 'boolean'
    },
    checkboxDisable304 : {
      setting : 'disable304',
      type : 'boolean'
    },
    checkboxAllowCustomJs : {
      setting : 'allowBoardCustomJs',
      type : 'boolean'
    },
    checkboxDisableSpamCheck : {
      setting : 'disableSpamCheck',
      type : 'boolean'
    },
    comboPruningMode : {
      setting : 'pruningMode',
      type : 'combo'
    },
    checkboxFrontPageStats : {
      setting : 'frontPageStats',
      type : 'boolean'
    },
    comboSsl : {
      setting : 'ssl',
      type : 'combo'
    },
    checkboxGlobalBoardModeration : {
      setting : 'allowGlobalBoardModeration',
      type : 'boolean'
    },
    checkboxVersatileBlockBypass : {
      setting : 'allowVersatileBlockBypass',
      type : 'boolean'
    },
    checkboxMediaThumb : {
      setting : 'mediaThumb',
      type : 'boolean'
    },
    checkboxGlobalCaptcha : {
      setting : 'forceCaptcha',
      type : 'boolean'
    },
    checkboxMaintenance : {
      setting : 'maintenance',
      type : 'boolean'
    },
    checkboxMultipleReports : {
      setting : 'multipleReports',
      type : 'boolean'
    },
    checkboxSFWLatestImages : {
      setting : 'onlySfwLatestImages',
      type : 'boolean'
    },
    checkboxDisableFloodCheck : {
      setting : 'disableFloodCheck',
      type : 'boolean'
    },
    checkboxDisableAccountCreation : {
      setting : 'disableAccountCreation',
      type : 'boolean'
    },
    fieldAcceptedMimes : {
      setting : 'acceptedMimes',
      type : 'string'
    },
    fieldAddons : {
      setting : 'addons',
      type : 'string'
    },
    comboBoardCreationRequirement : {
      setting : 'boardCreationRequirement',
      type : 'combo'
    },
    comboCaptchaMode : {
      setting : 'captchaMode',
      type : 'combo'
    },
    comboBypassMode : {
      setting : 'bypassMode',
      type : 'combo'
    },
    comboTorPostingLevel : {
      type : 'combo',
      setting : 'torPostingLevel',
    },
    comboMinClearIpRole : {
      setting : 'clearIpMinRole',
      type : 'combo'
    }
  };

};

globalSettings.save = function() {

  var parameters = {};

  for ( var key in globalSettings.siteSettingsRelation) {

    var item = globalSettings.siteSettingsRelation[key];

    switch (item.type) {
    case 'string':
      parameters[item.setting] = document.getElementById(key).value.trim();
      break;
    case 'boolean':
      if (document.getElementById(key).checked) {
        parameters[item.setting] = true;
      }
      break;
    case 'combo':
      var combo = document.getElementById(key);
      parameters[item.setting] = combo.options[combo.selectedIndex].value;
      break;

    }

  }

  api.formApiRequest('saveGlobalSettings', parameters,
      function requestComplete(status, data) {

        if (status === 'ok') {
          alert('New settings saved.');
        } else {
          alert(status + ': ' + JSON.stringify(data));
        }

      });

};

globalSettings.init();