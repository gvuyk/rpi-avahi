var fs = require("fs");
var Dockerode = require('dockerode');
var docker = new Dockerode({socketPath: '/var/run/docker.sock'});
var services_dir = "/etc/avahi/services";
var template_file = "template.service"
var addService_events = ['exec_start', 'start', 'unpause'];
var removeService_events = ['die', 'pause'];	//'stop' event not necessary, see: https://docs.docker.com/engine/reference/api/docker_remote_api/

//remove preexisting avahi service files (in case container is being restarted)
cleanServicesDir();

//look for declared services on running containers
console.log('Getting list of running containers');
docker.listContainers(function (error, containers)
{
	if(!error)
	{
		if(containers.length > 0)
		{
			console.log('Looking for declared mdns services');
			var containerIds = containers.map(function(container){return container.Id;})
			readMdnsServicesFromContainers(containerIds, function(servicesFromContainers)
			{
				if(servicesFromContainers.length > 0)
				{
					console.log('Adding services');
					for(var i=0; i<servicesFromContainers.length; i++)
					{
						if(!serviceFileExists(servicesFromContainers[i].name))
						{
							console.log(' - '+servicesFromContainers[i].name);
							createServiceFile(servicesFromContainers[i].name, servicesFromContainers[i].type, servicesFromContainers[i].port);
						}else{
							console.log(' - '+servicesFromContainers[i].name + '[already exists]');
						}
					}
				}else{
					console.log('No services found');
				}
			});
		}else{
			console.log('No container found running');
		}
	}else{
		console.log(error);
	}
});

//handle docker events
docker.getEvents({}, function (error, eventstream)
{
	if(!error)
	{
		eventstream.on('data', function (eventbuffer)
		{
			var event = JSON.parse(eventbuffer.toString('utf8'));
			if(event.Type == 'container')
			{
				var eventname = event.status;
				var containerId = event.id;
				if(addService_events.indexOf(eventname) > -1)
				{
					//check for services
					console.log('"'+eventname+'" event on container '+containerId);
					readMdnsServicesFromContainer(containerId, function(servicesFromContainer)
					{
						if(servicesFromContainer.length > 0)
						{
							console.log("Adding services")
							for(var i=0; i<servicesFromContainer.length; i++)
							{
								if(!serviceFileExists(servicesFromContainer[i].name))
								{
									console.log(' - '+servicesFromContainer[i].name);
									createServiceFile(servicesFromContainer[i].name, servicesFromContainer[i].type, servicesFromContainer[i].port);
								}else{
									console.log(' - '+servicesFromContainers[i].name + '[already exists]');
								}
							}
						}else{
							console.log('No service to add');
						}
					});
				}
				if(removeService_events.indexOf(eventname) > -1)
				{
					//check for services
					console.log('"'+eventname+'"" event on container '+containerId);
					readMdnsServicesFromContainer(containerId, function(servicesFromContainer)
					{
						if(servicesFromContainer.length > 0)
						{
							console.log('Removing services');
							for(var i=0; i<servicesFromContainer.length; i++)
							{
								if(serviceFileExists(servicesFromContainer[i].name))
								{
									console.log(' - '+servicesFromContainer[i].name);
									removeService(servicesFromContainer[i]);
								}else{
									console.log(' - '+servicesFromContainer[i].name+' [was not there anymore]');
								}
							}
						}else{
							console.log('No service to remove');
						}
					});
				}
			}
		});
	} else {
		console.log(error.message);
	}
});

function readMdnsServicesFromContainers(containerIds, callback)
{
	var mdnsservices = [];
	var remainingContainers = containerIds.length;
	containerIds.forEach(function(containerId)
	{
		readMdnsServicesFromContainer(containerId, function(foundservices)
		{
			mdnsservices = mdnsservices.concat(foundservices);
			remainingContainers--;
			if(remainingContainers == 0)
			{
				callback(mdnsservices);
			}
		})
	});
}
function readMdnsServicesFromContainer(containerId, callback)
{
	var container = docker.getContainer(containerId);
	container.inspect(function (error, data)
	{
		if(!error)
		{
			var env = data.Config.Env;
			var mdnsservices = [];
			env.forEach(function(envvar)
			{
				if(envvar.split('=')[0] == "AVAHISERVICES")
				{
					mdnsservices = JSON.parse(envvar.split('=')[1]);
				}
			});
			callback(mdnsservices);
		}else{
			console.log("Error inspecting container "+containerId);
			console.log(error);
		}
	})
}

function removeService(service)
{
	fs.unlinkSync(services_dir+"/"+service.name+'.service');
}

function serviceFileExists(servicename)
{
	var files = fs.readdirSync(services_dir);
	for(var i=0; i<files.length; i++)
	{
		if(files[i].match(servicename+'.service'))
		{
			return true;
		}
	}
	return false;
}

function createServiceFile(name, type, port)
{
	//read service file template
	var template = fs.readFileSync(template_file);
	var serviceconfig = template.toString();
	serviceconfig = serviceconfig.replace(/\{\{service_name\}\}/g, name);
	serviceconfig = serviceconfig.replace(/\{\{service_type\}\}/g, type);
	serviceconfig = serviceconfig.replace(/\{\{service_port\}\}/g, port);
	fs.writeFileSync(services_dir+'/'+name+'.service', serviceconfig);
}

function cleanServicesDir()
{
	var files = fs.readdirSync(services_dir);
	if(files.length > 0)
	{
		console.log("Removing old services");
		files.forEach(function(filename){
			console.log(' - '+filename.split('.')[0]);
			fs.unlinkSync(services_dir+"/"+filename);
		});
		console.log('Done');
	}
}