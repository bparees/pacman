pacman on Red Hat's OpenShift PaaS
==================================
This git repository is a sample Node application to help you get started
with using Node on Red Hat's OpenShift PaaS.

The app uses canvas and nodejs to render multi-player pacman and uses 
socket.io ( http://www.socket.io ) to communicate between the players and
viewers ( yeah, you get into viewing mode if its a full house ).

This app is a fork off the original pacman app (great job tjgillies!!) and
has changes to use MongoDB in lieu of redis, use specific env variables
for OpenShift + a few other improvements to make it a wee bit more
resilient. The app is playable on Red Hat's OpenShift PaaS at:
     http://pacman-ramr.rhcloud.com:8000/


Okay, now onto how can you get this app running on OpenShift.

Steps to get pacman running on OpenShift
----------------------------------------

Create an account at http://openshift.redhat.com/

Create a namespace, if you haven't already do so

    rhc domain create -n <yournamespace>

Create a nodejs-0.10 application (you can name it anything via -a)

    rhc app create -a pacman -t nodejs-0.10

Add MongoDB support to your application

    rhc app cartridge add -a pacman -c mongodb-2.2

Add this `github pacman` repository

    cd pacman
    git remote add upstream -m master git://github.com/ramr/pacman.git
    git pull -s recursive -X theirs upstream master
    
Then push the repo to OpenShift

    git push

That's it, you can now checkout your application on either of the
experimental websocket enabled ports:

    http://pacman-$yournamespace.rhcloud.com:8000
    OR
    https://pacman-$yournamespace.rhcloud.com:8443


Note: If you connect to the standard 80/443 ports
          ( http[s]://pacman-$yournamespace.rhcloud.com ),
      the application will fallback to using xhr-polling.


