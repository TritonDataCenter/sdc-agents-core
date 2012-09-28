#!/usr/node/bin/node

var dns = require('dns');
var path = require('path');
var util = require('util');
var execFile = require('child_process').execFile;

function execFileParseJSON(bin, args, callback) {
    execFile(bin, args, function (error, stdout, stderr) {
        if (error) {
            return callback(new Error(stderr.toString()));
        }
        var obj = JSON.parse(stdout.toString());
        return callback(null, obj);
    });
}

function sdcConfig(callback) {
    execFileParseJSON('/bin/bash', [ '/lib/sdc/config.sh', '-json' ],
        function (error, config) {
            if (error) {
                return callback(error);
            }
            return callback(null, config);
        });
}

function bootparams(callback) {
    execFile('/usr/bin/bootparams', [], function (error, stdout, stderr) {
        if (error) {
            return callback(error);
        }

        var config = {};
        stdout.toString().split('\n').forEach(function (line) {
            var idx = line.indexOf('=');
            var k = line.substr(0, idx);
            var v = line.substr(idx+1);
            if (k) {
                config[k] = v;
            }
        });

        return callback(null, config);
    });
}

function getAMQPConfig(callback) {
    var amqp = {};

    function setAMQPConfig(login, password, host, port, vhost) {
        amqp.login    = login || 'guest';
        amqp.password = password || 'guest';
        amqp.host     = host || 'localhost';
        amqp.port     = port || 5672;
        amqp.vhost    = vhost || '/';
    }

    bootparams(function (error, config) {
        var headnode = config.headnode === 'true';
        var rabbitmq;

        if (headnode) {
            return sdcConfig(function (sdcerror, sdcconfig) {
                rabbitmq = sdcconfig.rabbitmq.split(':');
                if (!rabbitmq) {
                    throw (
                        new Error(
                        'Could not find "rabbitmq" parameter from'
                        + ' /lib/sdc/config.sh'));
                }

                setAMQPConfig.apply(undefined, rabbitmq);
                return callback(null, amqp);
            });
        } else {
            rabbitmq = config.rabbitmq.split(':');
            if (!rabbitmq) {
                throw (
                    new Error(
                        'Could not find "rabbitmq" in'
                        + ' sysinfo "Boot Parameters"'));
            }
            setAMQPConfig.apply(undefined, rabbitmq);
            return callback(null, amqp);
        }
    });
}

function sysinfo(callback) {
    execFileParseJSON('/usr/bin/sysinfo', [], function (error, config) {
        if (error) {
            return callback(error);
        }
        return callback(null, config);
    });
}

getAMQPConfig(function (error, amqp) {
    console.log('amqp_login='+amqp.login);
    console.log('amqp_password='+amqp.password);
    console.log('amqp_host='+amqp.host);
    console.log('amqp_port='+amqp.port);
});
