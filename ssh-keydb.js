#!/usr/bin/env node
var fs      = require("fs");
var program = require("commander");
var iprange = require("iprange");
var Client  = require("ssh2").Client;

program
  .version("0.2.0")
  .option("-r, --range <ip/netmask>",    "(required) IP Range to test")
  .option("-H, --hostsfile <file name>", "(optional) File with host names per line")
  .option("-p, --parallel <number>",     "(optional) Run <number> tests in parallel, default is \"1\"")
  .option("-f, --file <file name>",      "(optional) File name for key db, default is keydb.json")
  .option("-u, --user <user name>",      "(optional) User name for log in, default is \"root\"")
  .option("-t, --timeout <ms>",          "(optional) Timeout for handshake in ms, default is \"20000\"")
  .parse(process.argv);

if(!program.range && !program.hostsfile) {
	program.help();
}

var hosts;
if(program.hostsfile) {
	hosts = fs.readFileSync(program.hostsfile).toString().split("\n");
} else {
	hosts = iprange(program.range);
}

var keyDBLock = false; // Lock for keydb file, needed when running in parallel
// Process authorized_keys file retrieved from server
var processKeys = function(host, keys, success) {
	// Acquire keydb file lock
	if(keyDBLock === true) {
		// If locked try again later
		setTimeout(function() {
			processKeys(host, keys, success);
		}, 100);
		return;
	}
	keyDBLock = true;

	// Parse keydb file or create new empty object
	try {
		var keyDB = JSON.parse(fs.readFileSync(program.file || "keydb.json"));
	} catch(e) {
		keyDB = {};
	}

	// Remove current host from all keys
	for(var k in keyDB) {
		var servers = keyDB[k].servers;
		for(var s=0; s<servers.length; s++) {
			if(servers[s] === host) {
				servers.splice(s, 1);
			}
		}
	}

	// Process authorized_keys file
	var lines = keys.split("\n");
	for(var l=0; l<lines.length; l++) {
		var line = lines[l];
		// Check if it's a key
		if(line.split("ssh-").length > 1) {
			var keyLine = line.split(" ");
			var type = keyLine.shift();
			var key = keyLine.shift();
			var comment = keyLine.join(" ");

			// If key not in keydb yet, create it. Otherwise add host to servers
			if(keyDB[key] === undefined) {
				keyDB[key] = {
					type   : type,
					comment: comment,
					servers: [
						host
					]
				}
			} else if(keyDB[key].servers.indexOf(host) === -1) {
				keyDB[key].servers.push(host);
			}
		}
	}

	// Save keydb file
	fs.writeFileSync(program.file || "keydb.json", JSON.stringify(keyDB));  
	// Release lock
	keyDBLock = false;
	showSuccess(host);
}

// Connect to host and get authorized_keys file
var testHost = function(host, success, error) {
	try {
		var conn = new Client();
		conn.on("ready", function() {
			// Get authorized_keys file depending on the user
			var homedir = "/root/";
			if(program.user) {
				homedir = "/home/" + program.user + "/";
			}
			conn.exec("cat " + homedir + ".ssh/authorized_keys", function(err, stream) {
				if (err) {
					error(err, host);
				}
				var errorResponse = "";
				var keys = "";
				stream.on("close", function(code, signal) {
					conn.end();
					// Process keys when no error
					if(errorResponse === "") {
						processKeys(host, keys, success);
					} else {
						error(errorResponse, host);
					}
				}).on("data", function(data) {
					keys += data;
				}).stderr.on("data", function(data) {
					errorResponse += data;
				});
			});
		}).on("error", function(err) {
			error(err, host);
		}).connect({
			host: host,
			port: 22,
			username: program.user || "root",
			privateKey: "",
			agent: process.env.SSH_AUTH_SOCK,
			readyTimeout: parseInt(program.timeout) || 20000
		});
	} catch (err) {
		error(err, host);
	}
}

var showError = function(err, host) {
	while(host.length <= 20) {
		host += " ";
	}
	console.log(host + err);
	nextHost();
}

var showSuccess = function(host) {
	while(host.length <= 20) {
		host += " ";
	}
	console.log(host + "SUCCESS");
	nextHost();
}

var nextHost = function() {
	if(hosts.length === 0) {
		return;
	}
	testHost(hosts.shift(), showSuccess, showError);
}

var parallel = parseInt(program.parallel) || 1;
for(var i=0; i<parallel; i++) {
	nextHost();
}
