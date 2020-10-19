#!/bin/bash

echo "Do you wish to install the command lynxchan for all users using a soft-link? (y,n)"
read answerCommand

echo "Do you wish to install a init script? Requires install as a command and an user called node on the system to run the engine, so it also must have permissions on the engine files. (systemd, upstart, openrc, blank for none)"
read answerInit

if [ -n "$answerInit" ]; then

  if getent passwd node  > /dev/null; then

    echo "Installing lynxchan service."

    if [ $answerInit == "upstart" ]; then

      rm -rf /usr/bin/log-manager
      cp ./log-manager.sh /usr/bin/log-manager
  
      rm -rf /etc/init/lynxchan.conf
      cp ./lynxchan.conf /etc/init/lynxchan.conf

      if [ ! -d /home/node ]; then
        echo "Creating node's home folder for logs."
        mkdir /home/node
        chown node /home/node 
        chmod 700 /home/node
      fi

      echo "Upstart daemon installed at /etc/init"

    elif [ $answerInit == "openrc" ]; then

      rm -rf /etc/init.d/lynxchan
      cp ./lynxchan.rc /etc/init.d/lynxchan

      if [ ! -d /home/node ]; then
        echo "Creating node's home folder for logs."
        mkdir /home/node
        chown node /home/node 
        chmod 700 /home/node
      fi

      echo "OpenRC service installed at /etc/init.d"

    elif [ $answerInit == "systemd" ]; then

      rm -rf /etc/systemd/system/lynxchan.service
      cp ./lynxchan.systemd /etc/systemd/system/lynxchan.service
      echo "SystemD service installed at /etc/systemd/system/"
    fi 

  else
    echo "User node does not exist. Add it to the system and run this script again to be able to install a service."
  fi
fi

if [ "$answerCommand" == "y" ]; then
  rm -rf /usr/bin/lynxchan

  ln -s $(readlink -f ..)/src/be/boot.js /usr/bin/lynxchan
  echo "Command lynxchan installed for all users using a link to src/be/boot.js."

fi
