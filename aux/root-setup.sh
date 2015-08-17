#!/bin/bash

echo "Do you wish to install the command lynxchan for all users using a soft-link? (y,n)"
read answerCommand

if getent passwd iojs  > /dev/null; then

  if [ -z $1 ]; then
    echo "No automatic daemon install. You can inform the options upstart, systemd or sysvinit if you wish. Except the sysvinit isn't implemented. You can use one of the available daemon scripts and mannually install it."
  elif [ $1 == "upstart" ]; then
    echo "Upstart daemon installed at /etc/init"

    rm -rf /usr/bin/log-manager
    cp ./log-manager.sh /usr/bin/log-manager
  
    rm -rf /etc/init/lynxchan.conf
    cp ./lynxchan.conf /etc/init/lynxchan.conf

    if [ ! -d /home/iojs ]; then
      echo "Creating iojs's home folder for logs."
      mkdir /home/iojs
      chown node /home/iojs 
      chmod 600 /home/iojs
    fi
  elif [ $1 == "sysvinit" ]; then
    echo "Sorry, but this option is unavailable, I haven't used a system with sysvinit yet, so I didn't had the chance to implement it."
  elif [ $1 == "systemd" ]; then
    echo "SystemD service installed at /etc/systemd/system/"

    rm -rf /etc/systemd/system/lynxchan.service
    cp ./lynxchan.systemd /etc/systemd/system/lynxchan.service
  else
    echo "Unrecognized option install "$1"."
  fi

  echo "Service installation complete. If you are using upstart, don't forget to add logManager as a cronjob for the iojs user so the logs are rotated properly."

else
  echo "User iojs does not exist. Add it to the system and run this script again to be able to install a service."
fi

if [ "$answerCommand" == "y" ]; then
  rm -rf /usr/bin/lynxchan

  ln -s $(readlink -f ..)/src/be/boot.js /usr/bin/lynxchan
  echo "Command lynxchan installed for all users using a link to src/be/boot.js."

fi
