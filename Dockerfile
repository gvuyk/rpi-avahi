FROM resin/rpi-raspbian:jessie
 
RUN sudo apt-get update && apt-get install -y avahi-daemon supervisor curl ca-certificates
RUN curl -kL https://deb.nodesource.com/setup_6.x | sudo -E bash -
RUN sudo apt-get install -y nodejs

RUN mkdir /var/www
WORKDIR /var/www/
COPY package.json /var/www/package.json
RUN npm install
COPY avahi-daemon.conf /etc/avahi/avahi-daemon.conf
COPY template.service /var/www/template.service
COPY supervisord.conf /etc/supervisor/supervisord.conf
COPY updater.js /var/www/updater.js

VOLUME /var/run/docker.sock
CMD ["/usr/bin/supervisord"]