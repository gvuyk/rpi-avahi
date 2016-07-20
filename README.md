# rpi-avahi
Dockerfile for a container that creates/removes Avahi services based on other containers, to be broadcasted through the host network

- Services are read from other container's `AVAHISERVICES` environment var (json array) and kept updated by listening to docker events on the host<br>
- This container doesn't necessarily need to be run after all other containers


### Examples
Running this container:<br>
`docker run --net=host -d -v /var/run/docker.sock:/var/run/docker.sock gvuyk/rpi-avahi`<br>

Other containers, where the services are located:<br>
`docker run -e 'AVAHISERVICES=[{"name": "mqttserver","type": "_mqtt._tcp","port": 1883}]' IMAGE_NAME`<br>

### Notes
<a href="https://www.raspbian.org/">Raspbian</a> comes with avahi-daemon preinstalled.<br>
There shouldn't be more than 1 instance of Avahi working with the same host, if you check the logs, you'll see Avahi complaining about this
