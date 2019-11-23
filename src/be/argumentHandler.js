'use strict';

// Handles the reading of terminal arguments

var informedArguments = {
  clearCache : {
    short : '-cc',
    long : '--clear-individual-cache',
    type : 'boolean'
  },
  shutdown : {
    short : '-s',
    long : '--shutdown',
    type : 'boolean'
  },
  ip : {
    short : '-i',
    long : '--ip',
    type : 'value'
  },
  diskMedia : {
    short : '-dm',
    long : '--disk-media',
    type : 'value'
  },
  setPassword : {
    short : '-sp',
    long : '--set-password',
    type : 'boolean'
  },
  pruneFiles : {
    short : '-pf',
    long : '--prune-files',
    type : 'boolean'
  },
  reloadFrontEnd : {
    short : '-rfe',
    long : '--reload-front-end',
    type : 'boolean'
  },
  torDebug : {
    short : '-td',
    long : '--tor-debug',
    type : 'boolean'
  },
  frontDebug : {
    short : '-fd',
    long : '--fe-debug',
    type : 'boolean'
  },
  maintenance : {
    short : '-m',
    long : '--maintenance',
    type : 'value'
  },
  reloadGraphs : {
    short : '-rg',
    long : '--reload-graphs',
    type : 'boolean'
  },
  noDaemon : {
    short : '-nd',
    long : '--no-daemon',
    type : 'boolean'
  },
  setRole : {
    short : '-sr',
    long : '--set-role',
    type : 'boolean'
  },
  createAccount : {
    short : '-ca',
    long : '--create-account',
    type : 'boolean'
  },
  reload : {
    short : '-r',
    long : '--reload',
    type : 'boolean'
  },
  reloadBoards : {
    short : '-rboard',
    long : '--reload-boards',
    type : 'boolean'
  },
  reloadMultiboard : {
    short : '-rmb',
    long : '--reload-multiboard',
    type : 'boolean'
  },
  reloadLogin : {
    short : '-rl',
    long : '--reload-login',
    type : 'boolean'
  },
  reloadLogs : {
    short : '-rlog',
    long : '--reload-logs',
    type : 'boolean'
  },
  reloadBanner : {
    short : '-rb',
    long : '--reload-banner',
    type : 'boolean'
  },
  reloadFront : {
    short : '-rf',
    long : '--reload-front',
    type : 'boolean'
  },
  reloadOverboard : {
    short : '-ro',
    long : '--reload-overboard',
    type : 'boolean'
  },
  reloadNotFound : {
    short : '-rn',
    long : '--reload-notfound',
    type : 'boolean'
  },
  reloadAudio : {
    short : '-ra',
    long : '--reload-audio',
    type : 'boolean'
  },
  noFork : {
    short : '-nf',
    long : '--no-fork',
    type : 'boolean'
  },
  reloadThumb : {
    short : '-rt',
    long : '--reload-thumb',
    type : 'boolean'
  },
  reloadSpoiler : {
    short : '-rs',
    long : '--reload-spoiler',
    type : 'boolean'
  },
  reloadMaintenance : {
    short : '-rm',
    long : '--reload-maintenance',
    type : 'boolean'
  },
  reloadMaintenanceImage : {
    short : '-rmi',
    long : '--reload-maintenance-image',
    type : 'boolean'
  },
  login : {
    short : '-l',
    long : '--login',
    type : 'value'
  },
  password : {
    short : '-p',
    long : '--password',
    type : 'value'
  },
  globalRole : {
    short : '-gr',
    long : '--global-role',
    type : 'value'
  }
};

var args = process.argv;

for ( var key in informedArguments) {

  if (!informedArguments.hasOwnProperty(key)) {
    continue;
  }

  var element = informedArguments[key];

  switch (element.type) {
  case 'value':
    var elementIndex = args.indexOf(element.short);
    if (elementIndex === -1) {
      elementIndex = args.indexOf(element.long);
    }

    if (elementIndex !== -1) {
      element.value = args[elementIndex + 1];
    }
    break;
  case 'boolean':
    element.informed = args.indexOf(element.short) > -1;

    if (!element.informed) {
      element.informed = args.indexOf(element.long) > -1;
    }

    break;
  }

}

exports.informedArguments = informedArguments;