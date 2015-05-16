#!/bin/bash

if [[ -s ~/hub1.log ]] ; then
timestamp() {
  date +"%F"
}

mv ~/lynxchan.log ~/lynxchan"_$(timestamp).log"

> ~/lynxchan.log
fi ;








